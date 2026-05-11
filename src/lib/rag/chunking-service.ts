// src/lib/rag/chunking-service.ts

import type { DocumentChunk } from "./rag-types";

export function createChunks(
    text: string,
    options?: {
        chunkSize?: number;
        overlap?: number;
    }
): DocumentChunk[] {
    const chunkSize = options?.chunkSize ?? Number(process.env.RAG_CHUNK_SIZE ?? 1200);
    const overlap = options?.overlap ?? Number(process.env.RAG_CHUNK_OVERLAP ?? 200);

    const normalized = text.replace(/\s+/g, " ").trim();

    if (!normalized) {
        return [];
    }

    const chunks: DocumentChunk[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < normalized.length) {
        const end = Math.min(start + chunkSize, normalized.length);
        const content = normalized.slice(start, end).trim();

        if (content.length > 0) {
            chunks.push({
                content,
                chunkIndex,
                // Estimativa simples: ~4 caracteres por token
                tokenCount: Math.ceil(content.length / 4),
            });
        }

        chunkIndex++;
        start += chunkSize - overlap;
    }

    return chunks;
}
