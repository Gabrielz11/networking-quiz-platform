// src/lib/rag/jobs/queues/evaluation-queue.ts
//
// Fila BullMQ para avaliação assíncrona de confiabilidade (RAGAS Faithfulness).
// Reutiliza a factory de conexão centralizada do projeto.

import { Queue } from "bullmq";
import { createBullMQConnection } from "@/lib/redis";

const connection = createBullMQConnection();

export const evaluationQueue = new Queue("rag-evaluation", { connection });

export interface EvaluationJobData {
    evaluationId: string;
    moduleId: string;
    contentHash: string;
    sourceChunkIds: string[];
    /** ID do snapshot imutável de contexto usado na geração (opcional) */
    snapshotId?: string;
    /** Número da tentativa de avaliação (0 = original, 1+ = retry após auto-healing) */
    attempt?: number;
}

/**
 * Enfileira um job de avaliação RAGAS para o módulo especificado.
 *
 * O jobId determinístico (eval_{evaluationId}_{timestamp}) garante que
 * jobs duplicados para o mesmo conteúdo não sejam adicionados à fila.
 */
export async function enqueueRagEvaluation(data: EvaluationJobData) {
    const jobId = `eval_${data.evaluationId}_${Date.now()}`;
    await evaluationQueue.add("evaluate-faithfulness", data, {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
    });
}
