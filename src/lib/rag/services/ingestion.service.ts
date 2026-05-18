// src/lib/rag/rag-ingestion-service.ts

import { prisma } from "@/lib/prisma";
import { enqueueDocumentProcessing } from "../jobs/queues/embedding-queue";
import { Logger } from "@/lib/logger";
import { embeddingWorker } from "../jobs/workers/embedding-worker";

const logger = new Logger("RagIngestionService");

export async function processSourceFile(input: {
    fileId: string;
    moduleId: string;
}) {
    const sourceFile = await prisma.moduleSourceFile.findFirst({
        where: {
            id: input.fileId,
            moduleId: input.moduleId,
        },
    });

    if (!sourceFile) {
        throw new Error("Arquivo de origem não encontrado.");
    }

    try {
        // 1. Marcar como PROCESSING
        await prisma.moduleSourceFile.update({
            where: { id: sourceFile.id },
            data: { status: "PROCESSING", errorMessage: null },
        });

        logger.info("processSourceFile", "Enfileirando arquivo para processamento", {
            fileId: sourceFile.id,
            mimeType: sourceFile.mimeType,
        });

        // Força a compilação ativa do Worker para que o Webpack não elimine o import por Tree-Shaking
        const workerActiveName = embeddingWorker.name;
        logger.info("processSourceFile", `Garantindo que o worker de embeddings (${workerActiveName}) está escutando no mesmo processo.`);

        // 2. Enfileirar trabalho no BullMQ
        await enqueueDocumentProcessing(sourceFile.id, sourceFile.moduleId);

        logger.info("processSourceFile", "Arquivo enfileirado com sucesso", {
            fileId: sourceFile.id,
        });

        return { success: true, queued: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido no enfileiramento.";

        logger.error("processSourceFile", `Falha no enfileiramento: ${message}`, {
            fileId: sourceFile.id,
        });

        await prisma.moduleSourceFile.update({
            where: { id: sourceFile.id },
            data: { status: "FAILED", errorMessage: message },
        });

        throw error;
    }
}
