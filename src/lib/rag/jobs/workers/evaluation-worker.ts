// src/lib/rag/jobs/workers/evaluation-worker.ts
//
// Worker BullMQ para avaliação assíncrona de confiabilidade RAGAS (Faithfulness).
// Consome jobs da fila "rag-evaluation", chama o serviço Python (FastAPI) e
// persiste o resultado no banco.
//
// Proteção contra condição de corrida: antes de chamar o RAGAS, o worker
// recalcula o contentHash do conteúdo atual do módulo. Se o hash divergir
// do hash do job (professor editou enquanto o job aguardava na fila), o
// worker aborta e marca a avaliação como OUTDATED.

import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { createBullMQConnection } from "@/lib/redis";
import { computeContentHash } from "@/lib/rag/eval/hash.utils";
import type { EvaluationJobData } from "../queues/evaluation-queue";

const connection = createBullMQConnection();
const logger = new Logger("EvaluationWorker");

const globalForWorker = global as unknown as { evaluationWorker: Worker };

let workerInstance = globalForWorker.evaluationWorker;

if (!workerInstance) {
    workerInstance = new Worker("rag-evaluation", async (job: Job<EvaluationJobData>) => {
        const { evaluationId, moduleId, contentHash, sourceChunkIds } = job.data;

        logger.info("Worker", "[RAG Evaluation] evaluation started", {
            evaluationId,
            moduleId,
            metric: "faithfulness",
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

        // 4. Buscar textos dos chunks usados como contexto na ordem exata dos sourceChunkIds
        const chunks = await prisma.moduleSourceChunk.findMany({
            where: { id: { in: sourceChunkIds } },
            select: { id: true, content: true },
        });

        const MAX_CONTEXT_CHARS_PER_CHUNK = 2_000;
        const chunkMap = new Map(chunks.map((c) => [c.id, c.content]));

        const retrievedContexts: string[] = [];
        for (const id of sourceChunkIds) {
            const rawContent = chunkMap.get(id);
            if (rawContent) {
                const formatted = rawContent.length > MAX_CONTEXT_CHARS_PER_CHUNK
                    ? rawContent.slice(0, MAX_CONTEXT_CHARS_PER_CHUNK) + "\n[...conteúdo truncado para caber nos limites do provider...]"
                    : rawContent;
                retrievedContexts.push(formatted);
            }
        }

        if (retrievedContexts.length === 0) {
            logger.warn("Worker", "[RAG Evaluation] Nenhum chunk encontrado para os IDs fornecidos.", {
                moduleId,
                sourceChunkIds,
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

        const contextHash = computeContentHash(retrievedContexts.join("\n\n"));

        // 5. Montar user_input (query usada na geração)
        const userInput = `${currentModule.title} ${currentModule.description ?? ""}`.trim();

        // 6. Chamar o serviço Python (FastAPI)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180_000);

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
                        sourceChunkIds,
                        contextHash,
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
            });

        } catch (error) {
            clearTimeout(timeoutId);
            const message = error instanceof Error ? error.message : "Unknown error";

            logger.error("Worker", `[RAG Evaluation] failed | ${message}`, {
                evaluationId,
                moduleId,
            });

            // BullMQ: job.attemptsMade é o número de tentativas anteriores concluídas (começa em 0).
            // A tentativa corrente é (job.attemptsMade + 1).
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
    }, { connection });

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

export const evaluationWorker = workerInstance;
