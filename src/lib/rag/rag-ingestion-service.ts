// src/lib/rag/rag-ingestion-service.ts

import { prisma } from "@/lib/prisma";
import { parseDocument } from "./document-parser";
import { createChunks } from "./chunking-service";
import { getEmbeddingService } from "./embedding-service";
import { getVectorStore } from "./vector-store";
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

        logger.info("processSourceFile", "Extraindo texto do arquivo", {
            fileId: sourceFile.id,
            mimeType: sourceFile.mimeType,
        });

        // 2. Extrair texto
        const parsed = await parseDocument({
            filePath: sourceFile.storagePath,
            fileName: sourceFile.originalName,
            mimeType: sourceFile.mimeType,
        });

        // 3. Criar chunks
        const chunks = createChunks(parsed.text);

        if (chunks.length === 0) {
            throw new Error("Nenhum conteúdo de texto pôde ser extraído deste arquivo.");
        }

        logger.info("processSourceFile", `${chunks.length} chunks criados`, {
            fileId: sourceFile.id,
        });

        // 4. Gerar embeddings
        const embeddingService = getEmbeddingService();
        const embeddings = await embeddingService.embedMany(
            chunks.map((chunk) => chunk.content)
        );

        logger.info("processSourceFile", "Embeddings gerados", {
            fileId: sourceFile.id,
            count: embeddings.length,
        });

        // 5. Limpar chunks antigos deste arquivo
        await prisma.moduleSourceChunk.deleteMany({
            where: { fileId: sourceFile.id },
        });

        // 6. Salvar novos chunks com embeddings no pgvector
        const vectorStore = getVectorStore();
        await vectorStore.addChunks({
            moduleId: sourceFile.moduleId,
            fileId: sourceFile.id,
            chunks,
            embeddings,
        });

        // 7. Marcar como PROCESSED
        await prisma.moduleSourceFile.update({
            where: { id: sourceFile.id },
            data: { status: "PROCESSED", errorMessage: null },
        });

        logger.info("processSourceFile", "Arquivo processado com sucesso", {
            fileId: sourceFile.id,
            chunks: chunks.length,
        });

        return { success: true, chunks: chunks.length };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido no processamento.";

        logger.error("processSourceFile", `Falha no processamento: ${message}`, {
            fileId: sourceFile.id,
        });

        await prisma.moduleSourceFile.update({
            where: { id: sourceFile.id },
            data: { status: "FAILED", errorMessage: message },
        });

        throw error;
    }
}
