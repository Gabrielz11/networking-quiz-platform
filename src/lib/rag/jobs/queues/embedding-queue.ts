import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "@/lib/env";

const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

export const embeddingQueue = new Queue("embedding-processing", { connection });

export async function enqueueDocumentProcessing(fileId: string, moduleId: string) {
    await embeddingQueue.add("process-document", { fileId, moduleId }, {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 }
    });
}
