// src/services/generation/module-content-rag.service.ts
//
// Geração de conteúdo de módulo com RAG (caminho canônico).
// Pré-requisito: o módulo deve ter arquivos de fonte processados (pipeline de ingestão).
//
// Quando usar este serviço:
//   - O módulo já existe no banco
//   - Há arquivos de estudo processados e armazenados no vector store
//   - A geração deve refletir o material fornecido pelo professor
//
// Diferença de module-content-preview.service.ts:
//   - Esse serviço salva o conteúdo gerado no banco de dados
//   - Usa similaridade vetorial (pgvector) para injetar contexto relevante no prompt

import { ModuleRepository, moduleRepository as defaultModuleRepo } from "@/repositories/module.repository";
import { getVectorStore } from "@/lib/rag/core/vector-store";
import { LlmRouter } from "@/services/ai/llm-router";
import { CONTENT_TIMEOUT_MS } from "@/services/ai/types";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { RAG_CONTENT_PROMPT } from "@/lib/prompts/rag-content.prompt";
import { prisma } from "@/lib/prisma";
import { computeContentHash } from "@/lib/rag/eval/hash.utils";
import { enqueueRagEvaluation } from "@/lib/rag/jobs/queues/evaluation-queue";

const logger = new Logger("ModuleContentRagService");

/**
 * Limite máximo de caracteres por chunk de contexto injetado no prompt.
 */
const MAX_CONTEXT_CHARS_PER_CHUNK = 2_000;

export class ModuleContentRagService {
    constructor(private moduleRepo: ModuleRepository) { }

    async generateModuleContentWithRag(input: { moduleId: string }) {
        const { moduleId } = input;
        const vectorStore = getVectorStore();

        logger.info("generate", "Iniciando geração RAG", { moduleId });

        const moduleRecord = await this.moduleRepo.findById(moduleId);
        if (!moduleRecord) {
            throw new Error("Módulo não encontrado.");
        }

        const searchQuery = `${moduleRecord.title} ${moduleRecord.description ?? ""}`.trim() || "conceitos principais e detalhes técnicos";

        const contextChunks = await vectorStore.searchSimilar({
            moduleId,
            query: searchQuery,
            limit: env.RAG_FINAL_CONTEXT_LIMIT,
        });

        if (contextChunks.length === 0) {
            throw new Error("Não há material processado para este módulo.");
        }

        logger.info("generate", "Chunks recuperados do vector store", {
            moduleId,
            totalChunks: contextChunks.length,
            chunks: contextChunks.map((c, i) => ({
                index: i + 1,
                fileName: c.fileName,
                section: c.sectionTitle ?? "—",
                score: `${(c.score * 100).toFixed(1)}%`,
                chars: c.content.length,
            })),
        });

        const contextText = contextChunks
            .map((c) => {
                const sectionLabel = c.sectionTitle
                    ? ` | Seção: ${c.sectionTitle.replace(/^#{1,4}\s*/, "")}`
                    : "";
                const header = `[Fonte: ${c.fileName}${sectionLabel} | Relevância: ${(c.score * 100).toFixed(0)}%]`;
                const content = c.content.length > MAX_CONTEXT_CHARS_PER_CHUNK
                    ? c.content.slice(0, MAX_CONTEXT_CHARS_PER_CHUNK) + "\n[...conteúdo truncado para caber nos limites do provider...]"
                    : c.content;
                return `${header}\n${content}`;
            })
            .join("\n\n---\n\n");

        const truncatedCount = contextChunks.filter(c => c.content.length > MAX_CONTEXT_CHARS_PER_CHUNK).length;
        logger.info("generate", "Contexto RAG montado para o prompt", {
            moduleId,
            contextChars: contextText.length,
            chunksUsados: contextChunks.length,
            chunksTruncados: truncatedCount,
        });

        const prompt = RAG_CONTENT_PROMPT
            .replace("{{MODULE_TITLE}}", moduleRecord.title)
            .replace("{{MODULE_DESCRIPTION}}", moduleRecord.description ?? "Não fornecida")
            .replace("{{CONTEXT_TEXT}}", contextText);

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

        const updatedModule = await this.moduleRepo.update(moduleId, { content, description });

        logger.info("generate", "Conteúdo gerado e salvo", { moduleId });

        // ── Enfileirar avaliação RAGAS (assíncrona, não-bloqueante) ──────────
        if (env.RAG_EVALUATION_ENABLED) {
            try {
                const contentHash = computeContentHash(content);
                const sourceChunkIds = contextChunks.map((c) => c.id);

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
                        details: { sourceChunkIds },
                    },
                    update: {
                        status: "PENDING",
                        score: null,
                        error: null,
                        startedAt: null,
                        finishedAt: null,
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
                    });

                    logger.info("generate", "[RAG Evaluation] Job de avaliação enfileirado", {
                        moduleId,
                        evaluationId: evaluation.id,
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

        return { module: updatedModule, usedChunks: contextChunks };
    }
}

export const moduleContentRagService = new ModuleContentRagService(defaultModuleRepo);
