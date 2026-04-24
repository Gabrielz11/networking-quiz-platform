// src/lib/rag/vector-store.ts

import { prisma } from "@/lib/prisma";
import type { AddChunksInput, RetrievedChunk, SearchSimilarInput } from "./rag-types";
import { getEmbeddingService } from "./embedding-service";

function toPgVector(values: number[]): string {
    return `[${values.join(",")}]`;
}

export class PgVectorStore {
    async addChunks(input: AddChunksInput): Promise<void> {
        for (let i = 0; i < input.chunks.length; i++) {
            const chunk = input.chunks[i];
            const embedding = input.embeddings[i];

            // Usa $executeRawUnsafe para passar o tipo vector do pgvector
            await prisma.$executeRawUnsafe(
                `
                INSERT INTO "ModuleSourceChunk"
                  ("id", "fileId", "moduleId", "content", "chunkIndex", "tokenCount", "embedding", "createdAt")
                VALUES
                  (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::vector, NOW())
                `,
                input.fileId,
                input.moduleId,
                chunk.content,
                chunk.chunkIndex,
                chunk.tokenCount ?? null,
                toPgVector(embedding)
            );
        }
    }

    async searchSimilar(input: SearchSimilarInput): Promise<RetrievedChunk[]> {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(input.query);
        const limit = input.limit ?? Number(process.env.RAG_RETRIEVAL_LIMIT ?? 6);

        const rows = await prisma.$queryRawUnsafe<
            Array<{ id: string; content: string; fileName: string; score: number }>
        >(
            `
            SELECT
                c."id",
                c."content",
                f."originalName" as "fileName",
                1 - (c."embedding" <=> $1::vector) as "score"
            FROM "ModuleSourceChunk" c
            INNER JOIN "ModuleSourceFile" f ON f."id" = c."fileId"
            WHERE c."moduleId" = $2
            ORDER BY c."embedding" <=> $1::vector
            LIMIT $3
            `,
            toPgVector(queryEmbedding),
            input.moduleId,
            limit
        );

        return rows;
    }
}

export function getVectorStore() {
    return new PgVectorStore();
}
