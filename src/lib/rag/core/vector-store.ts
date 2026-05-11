// src/lib/rag/vector-store.ts

import { prisma } from "@/lib/prisma";
import type { AddChunksInput, RetrievedChunk, SearchSimilarInput } from "../types";
import { OpenAIEmbeddingProvider } from "./providers/openai-provider";
import { env } from "@/lib/env";

function toPgVector(values: number[]): string {
    return `[${values.join(",")}]`;
}

export class PgVectorStore {
    async addChunks(input: AddChunksInput): Promise<void> {
        for (let i = 0; i < input.chunks.length; i++) {
            const chunk = input.chunks[i];
            const embedding = input.embeddings[i];

            await prisma.$executeRawUnsafe(
                `
                INSERT INTO "ModuleSourceChunk"
                  ("id", "fileId", "moduleId", "content", "chunkIndex", "tokenCount", "sourceType", "page", "sectionTitle", "embeddingModel", "parentChunkId", "embedding", "createdAt")
                VALUES
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector, NOW())
                `,
                chunk.id ?? crypto.randomUUID(),
                input.fileId,
                input.moduleId,
                chunk.content,
                chunk.chunkIndex,
                chunk.tokenCount ?? null,
                chunk.sourceType ?? null,
                chunk.page ?? null,
                chunk.sectionTitle ?? null,
                chunk.embeddingModel ?? null,
                chunk.parentChunkId ?? null,
                toPgVector(embedding)
            );
        }
    }

    async searchSimilar(input: SearchSimilarInput): Promise<RetrievedChunk[]> {
        const provider = new OpenAIEmbeddingProvider();
        const queryEmbedding = await provider.generateEmbedding(input.query);
        const limit = input.limit ?? env.RAG_RETRIEVAL_LIMIT;

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
