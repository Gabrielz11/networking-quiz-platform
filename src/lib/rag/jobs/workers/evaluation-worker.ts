// src/lib/rag/jobs/workers/evaluation-worker.ts
//
// Worker BullMQ para avaliação assíncrona de confiabilidade RAGAS (Faithfulness).
// Consome jobs da fila "rag-evaluation", chama o serviço Python (FastAPI) e
// persiste o resultado no banco.
//
// Gate de qualidade pós-avaliação:
//   Score ≥ 0.90 → Publicar (contentStatus = "PUBLISHED")
//   Score 0.80–0.89 → Auto-healing: reescrever claims não suportados → Reavaliar 1x
//   Score < 0.80 → Manter como DRAFT com flag needsReview
//
// Rastreabilidade: usa o snapshot imutável para garantir que o RAGAS
// avalie exatamente o mesmo contexto usado na geração.

import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { createBullMQConnection } from "@/lib/redis";
import { computeContentHash } from "@/lib/rag/eval/hash.utils";
import type { EvaluationJobData } from "../queues/evaluation-queue";
import type { ContextChunkSnapshot } from "@/lib/rag/types";

const connection = createBullMQConnection();
const logger = new Logger("EvaluationWorker");

const globalForWorker = global as unknown as { evaluationWorker: Worker };

const TRUSTED_THRESHOLD = env.RAG_EVALUATION_TRUSTED_THRESHOLD;
const REVIEW_THRESHOLD = env.RAG_EVALUATION_REVIEW_THRESHOLD;

let workerInstance = globalForWorker.evaluationWorker;

if (!workerInstance) {
    workerInstance = new Worker("rag-evaluation", async (job: Job<EvaluationJobData>) => {
        const { evaluationId, moduleId, contentHash, snapshotId, attempt = 0 } = job.data;

        logger.info("Worker", "[RAG Evaluation] evaluation started", {
            evaluationId,
            moduleId,
            metric: "faithfulness",
            snapshotId,
            attempt,
        });

        // 1. Marcar como PROCESSING
        await prisma.ragEvaluation.update({
            where: { id: evaluationId },
            data: { status: "PROCESSING", startedAt: new Date() },
        });

        // 2. Buscar o conteúdo atual do módulo
        const currentModule = await prisma.module.findUnique({
            where: { id: moduleId },
            select: { content: true, title: true, description: true },
        });

        if (!currentModule) {
            logger.warn("Worker", "[RAG Evaluation] Módulo não encontrado. Abortando.", { moduleId });
            await prisma.ragEvaluation.update({
                where: { id: evaluationId },
                data: {
                    status: "FAILED",
                    error: "Módulo não encontrado.",
                    finishedAt: new Date(),
                },
            });
            return;
        }

        // 3. Proteção contra condição de corrida: recalcular hash
        const currentHash = computeContentHash(currentModule.content);

        if (currentHash !== contentHash) {
            logger.warn("Worker", "[RAG Evaluation] Conteúdo do módulo mudou antes da avaliação. Abortando.", {
                moduleId,
                expectedHash: contentHash.slice(0, 12),
                currentHash: currentHash.slice(0, 12),
            });
            await prisma.ragEvaluation.update({
                where: { id: evaluationId },
                data: {
                    status: "OUTDATED",
                    error: "Conteúdo alterado antes do processamento.",
                    finishedAt: new Date(),
                },
            });
            return;
        }

        // 4. Carregar snapshot imutável para obter o contexto exato
        let retrievedContexts: string[] = [];
        let snapshotContextHash: string | null = null;

        if (snapshotId) {
            const snapshot = await prisma.ragGenerationSnapshot.findUnique({
                where: { id: snapshotId },
                select: { contextChunks: true, contextHash: true },
            });

            if (snapshot) {
                const contextChunks = snapshot.contextChunks as unknown as ContextChunkSnapshot[];
                retrievedContexts = contextChunks.map(c => c.content);
                snapshotContextHash = snapshot.contextHash;

                logger.info("Worker", "[RAG Evaluation] Contexto carregado do snapshot", {
                    snapshotId,
                    contextsCount: retrievedContexts.length,
                    contextHash: snapshotContextHash?.slice(0, 12),
                });
            } else {
                logger.warn("Worker", "[RAG Evaluation] Snapshot não encontrado, usando fallback por sourceChunkIds", {
                    snapshotId,
                });
            }
        }

        // Fallback: reconstruir contexto dos sourceChunkIds (retrocompatibilidade)
        if (retrievedContexts.length === 0 && job.data.sourceChunkIds.length > 0) {
            const chunks = await prisma.moduleSourceChunk.findMany({
                where: { id: { in: job.data.sourceChunkIds } },
                select: { id: true, content: true },
            });

            const chunkMap = new Map(chunks.map((c) => [c.id, c.content]));
            for (const id of job.data.sourceChunkIds) {
                const rawContent = chunkMap.get(id);
                if (rawContent) {
                    retrievedContexts.push(rawContent);
                }
            }

            logger.warn("Worker", "[RAG Evaluation] Contexto reconstruído por sourceChunkIds (sem snapshot)", {
                moduleId,
                contextsCount: retrievedContexts.length,
            });
        }

        if (retrievedContexts.length === 0) {
            logger.warn("Worker", "[RAG Evaluation] Nenhum chunk encontrado para os IDs fornecidos.", {
                moduleId,
            });
            await prisma.ragEvaluation.update({
                where: { id: evaluationId },
                data: {
                    status: "FAILED",
                    error: "Nenhum chunk de contexto encontrado.",
                    finishedAt: new Date(),
                },
            });
            return;
        }

        const contextHash = snapshotContextHash ?? computeContentHash(retrievedContexts.join("\n\n"));

        // 5. Montar user_input (query usada na geração)
        const userInput = `${currentModule.title} ${currentModule.description ?? ""}`.trim();

        // 6. Chamar o serviço Python (FastAPI) com timeout de 315s
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 315_000);

        try {
            const response = await fetch(`${env.RAG_EVALUATION_SERVICE_URL}/evaluate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    evaluation_id: evaluationId,
                    module_id: moduleId,
                    user_input: userInput,
                    generated_content: currentModule.content,
                    retrieved_contexts: retrievedContexts,
                    provider: env.RAG_EVALUATION_PROVIDER,
                    model: env.RAG_EVALUATION_MODEL,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorBody}`);
            }

            const result = await response.json() as {
                score: number;
                evaluator_version: string;
                details?: Record<string, unknown>;
            };

            // 7. Persistir resultado
            await prisma.ragEvaluation.update({
                where: { id: evaluationId },
                data: {
                    score: result.score,
                    status: "COMPLETED",
                    evaluatorVersion: result.evaluator_version,
                    provider: env.RAG_EVALUATION_PROVIDER,
                    model: env.RAG_EVALUATION_MODEL,
                    details: {
                        sourceChunkIds: job.data.sourceChunkIds,
                        contextHash,
                        snapshotId: snapshotId ?? null,
                        attempt,
                        ...(result.details || {}),
                    },
                    finishedAt: new Date(),
                    error: null,
                },
            });

            logger.info("Worker", "[RAG Evaluation] completed", {
                evaluationId,
                moduleId,
                metric: "faithfulness",
                score: result.score,
                attempt,
            });

            // ── 8. Gate de qualidade ─────────────────────────────────────────
            await applyQualityGate({
                evaluationId,
                moduleId,
                score: result.score,
                details: result.details,
                attempt,
                snapshotId: snapshotId ?? null,
                contentHash,
                retrievedContexts,
                userInput,
            });

        } catch (error) {
            clearTimeout(timeoutId);
            const message = error instanceof Error ? error.message : "Unknown error";

            logger.error("Worker", `[RAG Evaluation] failed | ${message}`, {
                evaluationId,
                moduleId,
            });

            const maxAttempts = job.opts?.attempts ?? 3;
            const currentAttempt = job.attemptsMade + 1;
            const isLastAttempt = currentAttempt >= maxAttempts;

            await prisma.ragEvaluation.update({
                where: { id: evaluationId },
                data: {
                    status: isLastAttempt ? "FAILED" : "PROCESSING",
                    error: `[Tentativa ${currentAttempt}/${maxAttempts}] ${message}`.slice(0, 500),
                    finishedAt: isLastAttempt ? new Date() : undefined,
                },
            });

            throw error; // BullMQ fará retry se houver tentativas restantes
        }
    }, { connection, lockDuration: 360_000 });

    workerInstance.on("ready", () => {
        logger.info("Worker", "Evaluation worker is ready and waiting for jobs");
    });

    workerInstance.on("active", (job) => {
        logger.info("Worker", `[RAG Evaluation] Started processing job ${job.id}`);
    });

    workerInstance.on("completed", (job) => {
        logger.info("Worker", `[RAG Evaluation] Completed job ${job.id}`);
    });

    workerInstance.on("failed", (job, err) => {
        logger.error("Worker", `[RAG Evaluation] Job ${job?.id} failed: ${err.message}`);
    });

    if (process.env.NODE_ENV !== "production") {
        globalForWorker.evaluationWorker = workerInstance;
    }
}

// ── Gate de Qualidade ────────────────────────────────────────────────────────

interface QualityGateInput {
    evaluationId: string;
    moduleId: string;
    score: number;
    details?: Record<string, unknown>;
    attempt: number;
    snapshotId: string | null;
    contentHash: string;
    retrievedContexts: string[];
    userInput: string;
}

async function applyQualityGate(input: QualityGateInput): Promise<void> {
    const { evaluationId, moduleId, score, details, attempt, snapshotId } = input;

    if (score >= TRUSTED_THRESHOLD) {
        // ✅ Score >= 0.90 → Publicar
        await prisma.module.update({
            where: { id: moduleId },
            data: { contentStatus: "PUBLISHED" },
        });

        logger.info("QualityGate", "[PUBLISHED] Score atinge threshold de confiança", {
            moduleId,
            score,
            threshold: TRUSTED_THRESHOLD,
        });
        return;
    }

    if (score >= REVIEW_THRESHOLD && attempt === 0) {
        // ⚠️ Score 0.80–0.89 na primeira tentativa → Auto-healing
        logger.info("QualityGate", "[AUTO-HEALING] Tentando reescrever claims não suportados", {
            moduleId,
            score,
            attempt,
        });

        await attemptAutoHealing(input);
        return;
    }

    // ❌ Score < 0.80 ou retry já feito → Manter como DRAFT
    logger.warn("QualityGate", "[DRAFT] Score insuficiente — conteúdo mantido como rascunho", {
        moduleId,
        score,
        attempt,
        action: "Requer revisão manual do professor",
    });

    // Atualizar details com flag de revisão necessária
    await prisma.ragEvaluation.update({
        where: { id: evaluationId },
        data: {
            details: {
                ...(details || {}),
                needsReview: true,
                qualityGateResult: score < REVIEW_THRESHOLD ? "REGENERATION_NEEDED" : "HEALING_FAILED",
            },
        },
    });
}

/**
 * Auto-healing: extrai claims não suportados, envia ao LLM para reescrever,
 * salva conteúdo corrigido e reenfileira avaliação (attempt=1).
 */
async function attemptAutoHealing(input: QualityGateInput): Promise<void> {
    const { moduleId, details, contentHash, retrievedContexts, userInput } = input;

    // Extrair claims não suportados
    const claims = (details as any)?.claims as Array<{
        statement: string;
        supported: boolean;
        reason: string;
    }> | undefined;

    if (!claims) {
        logger.warn("AutoHealing", "Sem dados de claims para auto-healing", { moduleId });
        return;
    }

    const unsupportedClaims = claims.filter(c => !c.supported);
    if (unsupportedClaims.length === 0) {
        // Todos suportados mas score < 0.90? Publicar mesmo assim
        await prisma.module.update({
            where: { id: moduleId },
            data: { contentStatus: "PUBLISHED" },
        });
        return;
    }

    logger.info("AutoHealing", "Claims não suportados identificados", {
        moduleId,
        unsupportedCount: unsupportedClaims.length,
        claims: unsupportedClaims.map(c => ({
            statement: c.statement.slice(0, 100),
            reason: c.reason.slice(0, 100),
        })),
    });

    // Buscar conteúdo atual
    const currentModule = await prisma.module.findUnique({
        where: { id: moduleId },
        select: { content: true },
    });

    if (!currentModule) return;

    // Montar prompt de reescrita
    const claimsList = unsupportedClaims
        .map((c, i) => `${i + 1}. Afirmação: "${c.statement}"\n   Motivo: ${c.reason}`)
        .join("\n\n");

    const contextPreview = retrievedContexts.map((c, i) => `[Contexto ${i + 1}]:\n${c.slice(0, 500)}`).join("\n\n");

    const healingPrompt = `
Você recebeu um conteúdo educacional que foi avaliado e contém afirmações NÃO suportadas
pelas fontes de referência. Sua tarefa é reescrever o conteúdo removendo ou reformulando
APENAS as afirmações listadas abaixo, sem alterar o restante.

[AFIRMAÇÕES NÃO SUPORTADAS]

${claimsList}

[CONTEXTO DE REFERÊNCIA (resumo)]

${contextPreview}

[CONTEÚDO ORIGINAL]

${currentModule.content}

[INSTRUÇÕES]

1. Para cada afirmação não suportada:
   - Se a informação pode ser reformulada usando APENAS o que está nos contextos, reformule.
   - Se a informação NÃO tem base nos contextos, remova o trecho.
   - NÃO adicione informações novas.
2. Mantenha o restante do conteúdo INTACTO.
3. Mantenha a estrutura, formatação e marcações [Fonte N] existentes.
4. NÃO reduza drasticamente o tamanho — remova apenas o estritamente necessário.
5. Retorne APENAS o conteúdo corrigido em Markdown, sem explicações adicionais.
`;

    try {
        const { LlmRouter } = await import("@/services/ai/llm-router");
        const healedContent = await LlmRouter.generateText(healingPrompt, {
            pipeline: "CONTENT_HEALING",
            modelName: env.CONTENT_GENERATION_MODEL,
            temperature: 0.2,
            maxTokens: env.CONTENT_GENERATION_MAX_TOKENS,
            moduleId,
        });

        if (!healedContent || healedContent.length < currentModule.content.length * 0.5) {
            logger.warn("AutoHealing", "Conteúdo corrigido muito curto, descartando", {
                moduleId,
                originalLength: currentModule.content.length,
                healedLength: healedContent.length,
            });
            return;
        }

        // Corrigir tabelas no conteúdo corrigido
        const { fixMarkdownTables } = await import("@/services/generation/utils/markdown-table-fixer");
        const fixedContent = fixMarkdownTables(healedContent);

        // Salvar conteúdo corrigido
        await prisma.module.update({
            where: { id: moduleId },
            data: { content: fixedContent },
        });

        // Criar nova avaliação para o conteúdo corrigido
        const newContentHash = computeContentHash(fixedContent);

        const newEvaluation = await prisma.ragEvaluation.create({
            data: {
                moduleId,
                metric: "faithfulness",
                contentHash: newContentHash,
                status: "PENDING",
                snapshotId: input.snapshotId,
                details: {
                    sourceChunkIds: (input.details as any)?.sourceChunkIds ?? [],
                    parentEvaluationId: input.evaluationId,
                    healingAttempt: true,
                },
            },
        });

        // Enfileirar reavaliação (attempt=1)
        const { enqueueRagEvaluation } = await import("../queues/evaluation-queue");
        await enqueueRagEvaluation({
            evaluationId: newEvaluation.id,
            moduleId,
            contentHash: newContentHash,
            sourceChunkIds: (input.details as any)?.sourceChunkIds ?? [],
            snapshotId: input.snapshotId ?? "",
            attempt: 1,
        });

        logger.info("AutoHealing", "Conteúdo corrigido e reavaliação enfileirada", {
            moduleId,
            originalHash: contentHash.slice(0, 12),
            newHash: newContentHash.slice(0, 12),
            evaluationId: newEvaluation.id,
        });

    } catch (error) {
        logger.error("AutoHealing", "Falha no auto-healing", {
            moduleId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

export const evaluationWorker = workerInstance;
