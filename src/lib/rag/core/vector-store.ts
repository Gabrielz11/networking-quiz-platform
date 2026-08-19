// src/lib/rag/core/vector-store.ts

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AddChunksInput, RetrievedChunk, SearchSimilarInput } from "../types";
import { getEmbeddingProvider } from "./providers/embedding-provider";
import { env } from "@/lib/env";
import { Logger } from "@/lib/logger";

const logger = new Logger("PgVectorStore");

function toPgVector(values: number[]): string {
    return `[${values.join(",")}]`;
}

export class PgVectorStore {

    /**
     * Persiste chunks no banco respeitando a hierarquia Parent-Child.
     *
     * P1.2 — Aceita um Prisma TransactionClient opcional (`tx`).
     * Quando fornecido, todos os INSERTs rodam dentro da mesma transação
     * (deleteMany + addChunks = atômico no worker).
     *
     * - PARETs (chunkType = "parent") são salvos primeiro (sem embedding).
     * - CHILDs (chunkType = "child") são salvos depois com embedding vector.
     * - Chunks sem `chunkType` são tratados como legados (retrocompatível).
     */
    async addChunks(input: AddChunksInput, tx?: Prisma.TransactionClient): Promise<void> {
        // Usa o client da transação se disponível, senão o client global
        const db = tx ?? prisma;

        const parentChunks = input.chunks.filter(c => c.chunkType === "parent");
        const childChunks  = input.chunks.filter(c => c.chunkType !== "parent");

        // ── 1. Salvar PARETs (sem embedding) ────────────────────────────────
        for (const chunk of parentChunks) {
            await db.$executeRawUnsafe(
                `INSERT INTO "ModuleSourceChunk"
                   ("id", "fileId", "moduleId", "content", "chunkIndex", "tokenCount",
                    "sourceType", "page", "sectionTitle", "embeddingModel", "parentChunkId", "createdAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
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
                null  // PARETs não têm parentChunkId
            );
        }

        // ── 2. Salvar CHILDs + embeddings ────────────────────────────────────
        // Os embeddings de input.embeddings estão alinhados apenas com os childChunks
        for (let i = 0; i < childChunks.length; i++) {
            const chunk = childChunks[i];
            const embedding = input.embeddings[i];

            if (!embedding) continue;

            await db.$executeRawUnsafe(
                `INSERT INTO "ModuleSourceChunk"
                   ("id", "fileId", "moduleId", "content", "chunkIndex", "tokenCount",
                    "sourceType", "page", "sectionTitle", "embeddingModel", "parentChunkId", "embedding", "createdAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector, NOW())`,
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

    /**
     * Busca semântica hierárquica (Hierarchical Retrieval):
     *
     * 1. Busca vetorial nos CHILD chunks (distância cosine).
     * 2. Para cada CHILD encontrado com `parentChunkId`, recupera o PARENT.
     * 3. Retorna o conteúdo do PARENT (contexto rico ~1500 tokens) com metadados do CHILD.
     *
     * P1.1 — Verifica divergência de modelo de embedding entre o provider ativo
     * e o modelo com que os chunks foram indexados. Loga aviso sem bloquear.
     *
     * Chunks sem parentChunkId (legados) são retornados com seu próprio conteúdo.
     */
    async searchSimilar(input: SearchSimilarInput): Promise<RetrievedChunk[]> {
        const searchStart = Date.now();
        const provider = getEmbeddingProvider();
        const queryEmbedding = await provider.embedText(input.query);
        const limit = input.limit ?? env.RAG_FINAL_CONTEXT_LIMIT;

        // Importa aqui para evitar dependência circular se houver
        const { getRerankerProvider } = await import("./providers/reranker");
        const reranker = getRerankerProvider();

        const fetchLimit = reranker ? env.RAG_RETRIEVAL_LIMIT : limit;

        // Busca top-K CHILDs com embedding mais próximo
        const childRows = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                content: string;
                fileName: string;
                score: number;
                parentChunkId: string | null;
                sectionTitle: string | null;
                embeddingModel: string | null;
                fileId: string;
                chunkIndex: number;
            }>
        >(
            `SELECT
                c."id",
                c."content",
                c."parentChunkId",
                c."sectionTitle",
                c."embeddingModel",
                c."fileId",
                c."chunkIndex",
                f."originalName" AS "fileName",
                1 - (c."embedding" <=> $1::vector) AS "score"
             FROM "ModuleSourceChunk" c
             INNER JOIN "ModuleSourceFile" f ON f."id" = c."fileId"
             WHERE c."moduleId" = $2
               AND c."embedding" IS NOT NULL
             ORDER BY c."embedding" <=> $1::vector
             LIMIT $3`,
            toPgVector(queryEmbedding),
            input.moduleId,
            fetchLimit
        );

        if (childRows.length === 0) return [];

        logger.info("searchSimilar", "Busca vetorial concluída", {
            moduleId: input.moduleId,
            childChunksEncontrados: childRows.length,
            embeddingModel: provider.modelName,
            durationMs: Date.now() - searchStart,
        });

        // P1.1 — Verificar divergência de modelo entre provider ativo e chunks armazenados
        const storedModel = childRows[0]?.embeddingModel;
        if (storedModel && storedModel !== provider.modelName) {
            logger.warn("searchSimilar", "Divergência de embedding model detectada — retrieval pode ser impreciso", {
                moduleId: input.moduleId,
                storedModel,
                activeModel: provider.modelName,
                hint: "Reprocesse os arquivos do módulo para realinhar os vetores.",
            });
        }

        // ── Hierarchical retrieval: troca conteúdo CHILD → PARENT ─────────
        const parentIds = [...new Set(
            childRows
                .map(r => r.parentChunkId)
                .filter((id): id is string => id !== null)
        )];

        let parentMap: Map<string, string> = new Map();
        if (parentIds.length > 0) {
            const placeholders = parentIds.map((_, i) => `$${i + 1}`).join(", ");
            const parentRows = await prisma.$queryRawUnsafe<
                Array<{ id: string; content: string }>
            >(
                `SELECT "id", "content" FROM "ModuleSourceChunk" WHERE "id" IN (${placeholders})`,
                ...parentIds
            );
            parentMap = new Map(parentRows.map(p => [p.id, p.content]));
        }

        // Monta resultado bruto: usa conteúdo do PARENT quando disponível
        const seen = new Set<string>();
        const rawResults: RetrievedChunk[] = [];

        for (const row of childRows) {
            const parentContent = row.parentChunkId ? parentMap.get(row.parentChunkId) : null;
            const dedupeKey = row.parentChunkId ?? row.id;

            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);

            rawResults.push({
                id: row.id,
                content: parentContent ?? row.content,
                fileName: row.fileName,
                score: row.score,
                sectionTitle: row.sectionTitle ?? undefined,
                fileId: row.fileId,
                chunkIndex: row.chunkIndex,
            });
        }

        logger.info("searchSimilar", "Resultados após hierarquia e dedup", {
            moduleId: input.moduleId,
            resultadosFinais: rawResults.length,
            usouReranking: !!reranker && rawResults.length > 1,
        });

        // ── Reranking (Cohere Cross-Encoder) ──────────────────────────────
        if (reranker && rawResults.length > 1) {
            try {
                const textsToRerank = rawResults.map(r => r.content);
                const rerankedList = await reranker.rerank(input.query, textsToRerank, limit);

                const finalResults: RetrievedChunk[] = [];
                for (const item of rerankedList) {
                    const originalChunk = rawResults[item.index];
                    if (originalChunk) {
                        originalChunk.score = item.relevance_score;
                        finalResults.push(originalChunk);
                    }
                }

                return finalResults;
            } catch (error) {
                logger.warn("searchSimilar", "Reranking falhou, caindo para busca vetorial padrão", {
                    error: error instanceof Error ? error.message : String(error),
                });
                return rawResults.slice(0, limit);
            }
        }

        return rawResults.slice(0, limit);
    }
}

export function getVectorStore() {
    return new PgVectorStore();
}
