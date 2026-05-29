// src/lib/rag/services/ingestion.service.ts
//
// P2.1 — Esta rota apenas enfileira o job no BullMQ; NÃO instancia nem importa o Worker.
// O Worker deve ser executado como processo dedicado:
//   npm run worker
// Se o worker não estiver rodando, os jobs ficam na fila mas não são processados.

import { prisma } from "@/lib/prisma";
import { enqueueDocumentProcessing } from "../jobs/queues/embedding-queue";
import { Logger } from "@/lib/logger";

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

        // 2. Enfileirar trabalho no BullMQ — o worker consome em processo separado
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
