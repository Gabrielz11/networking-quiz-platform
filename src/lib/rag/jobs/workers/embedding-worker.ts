import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { parseDocument } from "../../core/document-parser";
import { RecursiveChunker } from "../../core/chunking/recursive-chunker";
import { OpenAIEmbeddingProvider } from "../../core/providers/openai-provider";
import { getVectorStore } from "../../core/vector-store";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";

const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
const logger = new Logger("EmbeddingWorker");

export const embeddingWorker = new Worker("embedding-processing", async (job: Job) => {
    const { fileId, moduleId } = job.data;
    
    logger.info("Worker", `Processing job ${job.id} for file ${fileId}`);
    
    const sourceFile = await prisma.moduleSourceFile.findFirst({
        where: { id: fileId, moduleId },
    });

    if (!sourceFile) {
        throw new Error("Source file not found");
    }

    try {
        await prisma.moduleSourceFile.update({
            where: { id: sourceFile.id },
            data: { status: "PROCESSING", errorMessage: null },
        });

        const parsed = await parseDocument({
            filePath: sourceFile.storagePath,
            fileName: sourceFile.originalName,
            mimeType: sourceFile.mimeType,
        });

        const chunker = new RecursiveChunker({
            maxTokens: 500,
            overlapTokens: 80
        });

        const chunks = chunker.createChunks(parsed.text, {
            moduleId,
            sourceFile: sourceFile.id,
            sourceType: sourceFile.mimeType,
            embeddingModel: "text-embedding-3-small"
        });

        if (chunks.length === 0) {
            throw new Error("No content extracted");
        }

        const provider = new OpenAIEmbeddingProvider();
        
        // Chunk requests to avoid payload too large (OpenAI accepts up to 2048 typically, but chunks can be many)
        const BATCH_SIZE = 100;
        const embeddings: number[][] = [];
        
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const batchEmbeddings = await provider.generateEmbeddings(
                batch.map(c => c.content)
            );
            embeddings.push(...batchEmbeddings);
        }

        await prisma.moduleSourceChunk.deleteMany({
            where: { fileId: sourceFile.id },
        });

        const vectorStore = getVectorStore();
        await vectorStore.addChunks({
            moduleId,
            fileId: sourceFile.id,
            chunks,
            embeddings,
        });

        await prisma.moduleSourceFile.update({
            where: { id: sourceFile.id },
            data: { status: "PROCESSED", errorMessage: null },
        });

        logger.info("Worker", `Completed job ${job.id}`);
        
        return { chunks: chunks.length };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        
        await prisma.moduleSourceFile.update({
            where: { id: sourceFile.id },
            data: { status: "FAILED", errorMessage: message },
        });
        
        logger.error("Worker", `Failed job ${job.id}: ${message}`);
        throw error;
    }
}, { connection });
