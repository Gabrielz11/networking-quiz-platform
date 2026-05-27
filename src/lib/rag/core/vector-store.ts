// src/lib/rag/core/vector-store.ts

import { prisma } from "@/lib/prisma";
import type { AddChunksInput, RetrievedChunk, SearchSimilarInput } from "../types";
import type { DocumentChunk } from "../types";
import { getEmbeddingProvider } from "./providers/embedding-provider";
import { env } from "@/lib/env";

function toPgVector(values: number[]): string {
    return `[${values.join(",")}]`;
}

export class PgVectorStore {

    /**
     * Persiste chunks no banco respeitando a hierarquia Parent-Child.
     *
     * - PARETs (chunkType = "parent") são salvos primeiro via Prisma (sem embedding).
     * - CHILDs (chunkType = "child") são salvos depois via SQL raw com embedding vector.
     * - Chunks sem `chunkType` são tratados como legados e salvos com embedding (retrocompatível).
     */
    async addChunks(input: AddChunksInput): Promise<void> {
        const parentChunks = input.chunks.filter(c => c.chunkType === "parent");
        const childChunks  = input.chunks.filter(c => c.chunkType !== "parent");

        // ── 1. Salvar PARETs (sem embedding) ────────────────────────────────
        for (const chunk of parentChunks) {
            await prisma.$executeRawUnsafe(
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

            await prisma.$executeRawUnsafe(
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
     * Chunks sem parentChunkId (legados) são retornados com seu próprio conteúdo.
     */
    async searchSimilar(input: SearchSimilarInput): Promise<RetrievedChunk[]> {
        const provider = getEmbeddingProvider();
        const queryEmbedding = await provider.embedText(input.query);
        const limit = input.limit ?? env.RAG_FINAL_CONTEXT_LIMIT;
        
        // Importa aqui para evitar dependência circular se houver
        const { getRerankerProvider } = await import("./providers/reranker");
        const reranker = getRerankerProvider();

        // Se tiver Reranker, buscamos o limite de retrieval do env
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
            }>
        >(
            `SELECT
                c."id",
                c."content",
                c."parentChunkId",
                c."sectionTitle",
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
                score: row.score, // score do pgvector (cosine similarity)
                sectionTitle: row.sectionTitle ?? undefined,
            });
        }

        // ── Reranking (Cohere Cross-Encoder) ──────────────────────────────
        if (reranker && rawResults.length > 1) {
            try {
                // Passa os textos brutos recuperados para o modelo re-avaliar
                const textsToRerank = rawResults.map(r => r.content);
                const rerankedList = await reranker.rerank(input.query, textsToRerank, limit);

                // Mapeia de volta os resultados baseados no índice retornado pela Cohere
                const finalResults: RetrievedChunk[] = [];
                for (const item of rerankedList) {
                    const originalChunk = rawResults[item.index];
                    if (originalChunk) {
                        // Substitui o score vetorial pelo score de relevância do reranker
                        originalChunk.score = item.relevance_score;
                        finalResults.push(originalChunk);
                    }
                }
                
                return finalResults;
            } catch (error) {
                console.error("Reranking falhou, caindo para busca vetorial padrão.", error);
                // Fallback: retorna o top N original do pgvector
                return rawResults.slice(0, limit);
            }
        }

        // Sem reranker (Fallback padrão)
        return rawResults.slice(0, limit);
    }
}

export function getVectorStore() {
    return new PgVectorStore();
}
