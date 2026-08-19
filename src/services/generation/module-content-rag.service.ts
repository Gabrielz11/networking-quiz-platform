// src/services/generation/module-content-rag.service.ts
//
// Geração de conteúdo de módulo com RAG v2 (caminho canônico).
//
// Pipeline:
//   1. Recuperação multi-query com diversidade e orçamento de tokens
//   2. Construção do mapa de evidências
//   3. Montagem do prompt v2 com evidências e proibições
//   4. Geração do conteúdo
//   5. Correção de tabelas Markdown malformadas
//   6. Salvar como DRAFT (contentStatus = "DRAFT")
//   7. Criar snapshot imutável de contexto
//   8. Enfileirar avaliação RAGAS com ID do snapshot
//
// Diferença de module-content-preview.service.ts:
//   - Este serviço salva o conteúdo gerado no banco de dados
//   - Usa similaridade vetorial (pgvector) para injetar contexto relevante
//   - Produz mapa de evidências e snapshot para rastreabilidade

import { ModuleRepository, moduleRepository as defaultModuleRepo } from "@/repositories/module.repository";
import { LlmRouter } from "@/services/ai/llm-router";
import { CONTENT_TIMEOUT_MS } from "@/services/ai/types";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { RAG_CONTENT_V2_PROMPT, RAG_CONTENT_PROMPT_VERSION } from "@/lib/prompts/rag-content-v2.prompt";
import { prisma } from "@/lib/prisma";
import { computeContentHash, computeContextHash } from "@/lib/rag/eval/hash.utils";
import { enqueueRagEvaluation } from "@/lib/rag/jobs/queues/evaluation-queue";
import { retrieveWithCoverage } from "@/lib/rag/core/multi-query-retriever";
import { buildEvidenceMap } from "@/services/generation/evidence-map.service";
import { fixMarkdownTables } from "@/services/generation/utils/markdown-table-fixer";
import type { ContextChunkSnapshot, EvidenceMap, RetrievedChunk } from "@/lib/rag/types";

const logger = new Logger("ModuleContentRagService");

export class ModuleContentRagService {
    constructor(private moduleRepo: ModuleRepository) { }

    async generateModuleContentWithRag(input: { moduleId: string }) {
        const { moduleId } = input;

        logger.info("generate", "Iniciando geração RAG v2", { moduleId });

        // ── 1. Buscar módulo ─────────────────────────────────────────────────
        const moduleRecord = await this.moduleRepo.findById(moduleId);
        if (!moduleRecord) {
            throw new Error("Módulo não encontrado.");
        }

        // ── 2. Recuperação multi-query com diversidade ───────────────────────
        const retrieval = await retrieveWithCoverage({
            moduleId,
            title: moduleRecord.title,
            description: moduleRecord.description,
        });

        if (retrieval.chunks.length === 0) {
            throw new Error("Não há material processado para este módulo.");
        }

        logger.info("generate", "Chunks recuperados com cobertura", {
            moduleId,
            totalChunks: retrieval.chunks.length,
            totalCandidates: retrieval.totalCandidates,
            queriesUsed: retrieval.queriesUsed.length,
            truncated: retrieval.truncatedIds.size,
            chunks: retrieval.chunks.map((c, i) => ({
                index: i + 1,
                fileName: c.fileName,
                section: c.sectionTitle ?? "—",
                score: `${(c.score * 100).toFixed(1)}%`,
                chars: c.content.length,
                truncated: retrieval.truncatedIds.has(c.id),
            })),
        });

        // ── 3. Construir mapa de evidências ──────────────────────────────────
        const evidenceMap = await buildEvidenceMap(retrieval.chunks, moduleId);

        if (evidenceMap.totalFacts === 0) {
            logger.warn("generate", "Mapa de evidências vazio — gerando com prompt v1 como fallback", { moduleId });
        }

        // ── 4. Montar contexto e prompt ──────────────────────────────────────
        const contextText = this.formatContextText(retrieval.chunks, retrieval.truncatedIds);
        const evidenceMapText = this.formatEvidenceMap(evidenceMap, retrieval.chunks);

        const prompt = RAG_CONTENT_V2_PROMPT
            .replace("{{MODULE_TITLE}}", moduleRecord.title)
            .replace("{{MODULE_DESCRIPTION}}", moduleRecord.description ?? "Não fornecida")
            .replace("{{EVIDENCE_MAP}}", evidenceMapText)
            .replace("{{CONTEXT_TEXT}}", contextText);

        // ── 5. Gerar conteúdo ────────────────────────────────────────────────
        const resultText = await LlmRouter.generateText(prompt, {
            pipeline: "CONTENT_GEN",
            modelName: env.CONTENT_GENERATION_MODEL,
            temperature: env.CONTENT_GENERATION_TEMPERATURE,
            timeoutMs: CONTENT_TIMEOUT_MS,
            maxTokens: env.CONTENT_GENERATION_MAX_TOKENS,
            moduleId,
        });

        let content = resultText;
        let description = "Resumo detalhado gerado pelo assistente pedagógico.";

        const descMatch = resultText.match(/<description>([\s\S]*?)<\/description>/i);
        if (descMatch) {
            description = descMatch[1].trim();
            content = resultText.replace(descMatch[0], "").trim();
        }

        if (!content) {
            logger.error("generate", "IA retornou vazio", { resultText });
            throw new Error("A IA gerou a resposta, mas o conteúdo veio vazio. Tente novamente.");
        }

        // ── 6. Corrigir tabelas Markdown malformadas e remover marcadores [Fonte N] ──
        content = fixMarkdownTables(content);
        content = stripSourceTags(content);
        description = stripSourceTags(description);

        // ── 7. Salvar como DRAFT ─────────────────────────────────────────────
        const updatedModule = await this.moduleRepo.update(moduleId, {
            content,
            description,
            contentStatus: "DRAFT",
        });

        logger.info("generate", "Conteúdo gerado e salvo como DRAFT", { moduleId });

        // ── 8. Criar snapshot imutável ───────────────────────────────────────
        const contextChunkSnapshots = this.buildContextSnapshots(
            retrieval.chunks,
            retrieval.truncatedIds,
        );
        const contextHashValue = computeContextHash(contextChunkSnapshots);
        const responseHash = computeContentHash(content);

        const snapshot = await prisma.ragGenerationSnapshot.create({
            data: {
                moduleId,
                contextChunks: contextChunkSnapshots as any,
                contextHash: contextHashValue,
                contextOrder: retrieval.chunks.map(c => c.id),
                evidenceMap: evidenceMap as any,
                promptVersion: RAG_CONTENT_PROMPT_VERSION,
                promptText: prompt,
                model: env.CONTENT_GENERATION_MODEL,
                temperature: env.CONTENT_GENERATION_TEMPERATURE,
                maxTokens: env.CONTENT_GENERATION_MAX_TOKENS,
                responseText: content,
                responseHash,
            },
        });

        logger.info("generate", "Snapshot de geração criado", {
            moduleId,
            snapshotId: snapshot.id,
            contextHash: contextHashValue.slice(0, 12),
            responseHash: responseHash.slice(0, 12),
        });

        // ── 9. Enfileirar avaliação RAGAS ────────────────────────────────────
        if (env.RAG_EVALUATION_ENABLED) {
            try {
                const contentHash = computeContentHash(content);
                const sourceChunkIds = retrieval.chunks.map((c) => c.id);

                // Marcar avaliações anteriores de outros hashes como OUTDATED
                await prisma.ragEvaluation.updateMany({
                    where: {
                        moduleId,
                        metric: "faithfulness",
                        NOT: { contentHash },
                    },
                    data: { status: "OUTDATED" },
                });

                // Upsert: criar PENDING ou resetar se já existir para o mesmo hash
                await prisma.ragEvaluation.upsert({
                    where: {
                        moduleId_metric_contentHash: {
                            moduleId,
                            metric: "faithfulness",
                            contentHash,
                        },
                    },
                    create: {
                        moduleId,
                        metric: "faithfulness",
                        contentHash,
                        status: "PENDING",
                        snapshotId: snapshot.id,
                        details: { sourceChunkIds },
                    },
                    update: {
                        status: "PENDING",
                        score: null,
                        error: null,
                        startedAt: null,
                        finishedAt: null,
                        snapshotId: snapshot.id,
                        details: { sourceChunkIds },
                    },
                });

                // Buscar o ID do registro para passar ao worker
                const evaluation = await prisma.ragEvaluation.findUnique({
                    where: {
                        moduleId_metric_contentHash: {
                            moduleId,
                            metric: "faithfulness",
                            contentHash,
                        },
                    },
                    select: { id: true },
                });

                if (evaluation) {
                    await enqueueRagEvaluation({
                        evaluationId: evaluation.id,
                        moduleId,
                        contentHash,
                        sourceChunkIds,
                        snapshotId: snapshot.id,
                    });

                    logger.info("generate", "[RAG Evaluation] Job de avaliação enfileirado", {
                        moduleId,
                        evaluationId: evaluation.id,
                        snapshotId: snapshot.id,
                        contentHash: contentHash.slice(0, 12),
                    });
                }
            } catch (evalError) {
                // Erro na avaliação nunca deve impactar a geração do conteúdo
                logger.error("generate", "[RAG Evaluation] Falha ao enfileirar avaliação (não impacta geração)", {
                    moduleId,
                    error: evalError instanceof Error ? evalError.message : "Unknown",
                });
            }
        }

        return {
            module: updatedModule,
            usedChunks: retrieval.chunks,
            evidenceMap,
            snapshotId: snapshot.id,
            contentStatus: "DRAFT" as const,
        };
    }

    /**
     * Formata o texto de contexto para o prompt, com cabeçalhos de fonte
     * e indicadores de truncamento.
     */
    private formatContextText(
        chunks: RetrievedChunk[],
        truncatedIds: Set<string>,
    ): string {
        return chunks
            .map((c, i) => {
                const sectionLabel = c.sectionTitle
                    ? ` | Seção: ${c.sectionTitle.replace(/^#{1,4}\s*/, "")}`
                    : "";
                const header = `[Fonte ${i + 1}: ${c.fileName}${sectionLabel} | Relevância: ${(c.score * 100).toFixed(0)}%]`;
                const truncatedNote = truncatedIds.has(c.id)
                    ? "\n[...conteúdo truncado para caber no orçamento de contexto...]"
                    : "";
                return `${header}\n${c.content}${truncatedNote}`;
            })
            .join("\n\n---\n\n");
    }

    /**
     * Formata o mapa de evidências para injeção no prompt.
     * Cada tópico é listado com cobertura e fatos permitidos com tags [Fonte N].
     */
    private formatEvidenceMap(map: EvidenceMap, chunks: RetrievedChunk[]): string {
        const chunkIndexMap = new Map(chunks.map((c, idx) => [c.id, idx + 1]));

        const lines: string[] = [];
        lines.push(`Total de fatos identificados nas fontes: ${map.totalFacts}`);
        lines.push("");

        for (const topic of map.topics) {
            lines.push(`## Tópico: ${topic.topic} [Cobertura: ${topic.coverage}]`);
            for (const fact of topic.facts) {
                const sourceNums = (fact.sourceIds || [])
                    .map((id) => chunkIndexMap.get(id))
                    .filter((num): num is number => num !== undefined);

                const sourceTag = sourceNums.length > 0
                    ? ` [${sourceNums.map((n) => `Fonte ${n}`).join(", ")}]`
                    : "";

                lines.push(`  - ${fact.statement}${sourceTag}`);
            }
            lines.push("");
        }

        return lines.join("\n");
    }

    /**
     * Constrói os snapshots de contexto para armazenamento imutável.
     */
    private buildContextSnapshots(
        chunks: RetrievedChunk[],
        truncatedIds: Set<string>,
    ): ContextChunkSnapshot[] {
        return chunks.map((c) => ({
            id: c.id,
            content: c.content,
            fileName: c.fileName,
            sectionTitle: c.sectionTitle,
            score: c.score,
            truncated: truncatedIds.has(c.id),
            originalLength: c.content.length,
        }));
    }
}

/**
 * Remove marcadores de origem como [Fonte 1], [Fonte 2, 3] do conteúdo.
 */
export function stripSourceTags(text: string): string {
    if (!text) return text;
    return text
        .replace(/\[Fonte\s*[\d,\s-]+\]/gi, "")
        .replace(/\s+([.,;:!?])/g, "$1")
        .replace(/[ \t]{2,}/g, " ");
}


export const moduleContentRagService = new ModuleContentRagService(defaultModuleRepo);
