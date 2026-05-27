import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { parseDocument } from "../../core/document-parser";
import { SemanticChunker } from "../../core/chunking/semantic-chunker";
import { getEmbeddingProvider } from "../../core/providers/embedding-provider";
import { getVectorStore } from "../../core/vector-store";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";

const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
const logger = new Logger("EmbeddingWorker");

const globalForWorker = global as unknown as { embeddingWorker: Worker };

let workerInstance = globalForWorker.embeddingWorker;

if (!workerInstance) {
    workerInstance = new Worker("embedding-processing", async (job: Job) => {
        const { fileId, moduleId } = job.data;

        logger.info("Worker", `Processing job ${job.id} for file ${fileId}`);

        const sourceFile = await prisma.moduleSourceFile.findFirst({
            where: { id: fileId, moduleId },
        });

        if (!sourceFile) {
            logger.warn("Worker", `Job ${job.id} skipped: Source file ${fileId} not found (deleted)`);
            return { skipped: true, reason: "Source file deleted" };
        }

        try {
            await prisma.moduleSourceFile.update({
                where: { id: sourceFile.id },
                data: { status: "PROCESSING", errorMessage: null },
            });

            // 1. Parsear documento
            const parsed = await parseDocument({
                filePath: sourceFile.storagePath,
                fileName: sourceFile.originalName,
                mimeType: sourceFile.mimeType,
            });

            // 2. Chunking semântico hierárquico (header-aware + parent-child)
            const chunker = new SemanticChunker({
                parentMaxTokens: env.RAG_CHUNK_SIZE + 300,
                childMaxTokens: env.RAG_CHUNK_SIZE,
                childOverlapTokens: env.RAG_CHUNK_OVERLAP,
            });

            const sharedMetadata = {
                moduleId,
                sourceFile: sourceFile.id,
                sourceType: sourceFile.mimeType,
                embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
            };

            const allChunks = chunker.createChunks(parsed.text, sharedMetadata);

            if (allChunks.length === 0) {
                throw new Error("No content extracted from document");
            }

            // 3. Separar PARETs (sem embedding) e CHILDs (com embedding)
            const parentChunks = allChunks.filter(c => c.chunkType === "parent");
            const childChunks  = allChunks.filter(c => c.chunkType === "child");

            logger.info("Worker", "Chunks gerados pelo SemanticChunker", {
                totalChunks: allChunks.length,
                parents: parentChunks.length,
                children: childChunks.length,
            });

            if (childChunks.length === 0) {
                throw new Error("Nenhum child chunk gerado — verifique o documento.");
            }

            // 4. Gerar embeddings apenas para CHILDs (em batches)
            const provider = getEmbeddingProvider();
            const BATCH_SIZE = 50;
            const childEmbeddings: number[][] = [];

            for (let i = 0; i < childChunks.length; i += BATCH_SIZE) {
                const batch = childChunks.slice(i, i + BATCH_SIZE);
                const batchEmbeddings = await provider.embedMany(
                    batch.map(c => c.content)
                );
                childEmbeddings.push(...batchEmbeddings);
                logger.info("Worker", `Embeddings batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(childChunks.length / BATCH_SIZE)} concluído`);
            }

            // 5. Limpar chunks antigos do arquivo
            await prisma.moduleSourceChunk.deleteMany({
                where: { fileId: sourceFile.id },
            });

            // 6. Persistir: PARETs primeiro (FK constraint), depois CHILDs com embedding
            const vectorStore = getVectorStore();
            await vectorStore.addChunks({
                moduleId,
                fileId: sourceFile.id,
                // Passa todos os chunks; addChunks separa internamente por chunkType
                chunks: [...parentChunks, ...childChunks],
                // Embeddings alinhados apenas com os childChunks (PARETs não têm embedding)
                embeddings: childEmbeddings,
            });

            await prisma.moduleSourceFile.update({
                where: { id: sourceFile.id },
                data: { status: "PROCESSED", errorMessage: null },
            });

            logger.info("Worker", `Job ${job.id} concluído com sucesso`, {
                parents: parentChunks.length,
                children: childChunks.length,
            });

            return {
                parents: parentChunks.length,
                children: childChunks.length,
                total: allChunks.length,
            };

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

    workerInstance.on("ready", () => {
        logger.info("Worker", "Embedding worker is ready and waiting for jobs");
    });

    workerInstance.on("active", (job) => {
        logger.info("Worker", `Started processing job ${job.id}`);
    });

    workerInstance.on("completed", (job) => {
        logger.info("Worker", `Completed job ${job.id}`);
    });

    workerInstance.on("failed", (job, err) => {
        logger.error("Worker", `Job ${job?.id} failed: ${err.message}`);
    });

    if (process.env.NODE_ENV !== "production") {
        globalForWorker.embeddingWorker = workerInstance;
    }
}

export const embeddingWorker = workerInstance;
