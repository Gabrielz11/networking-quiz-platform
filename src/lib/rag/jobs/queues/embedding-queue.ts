import { Queue } from "bullmq";
// P2.3 — Usa factory centralizada em vez de new Redis() local
import { createBullMQConnection } from "@/lib/redis";

// BullMQ exige uma conexão dedicada para a Queue
const connection = createBullMQConnection();

export const embeddingQueue = new Queue("embedding-processing", { connection });

export async function enqueueDocumentProcessing(fileId: string, moduleId: string) {
    await embeddingQueue.add("process-document", { fileId, moduleId }, {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
    });
}
