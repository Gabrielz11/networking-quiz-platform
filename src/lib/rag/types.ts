// src/lib/rag/rag-types.ts

export interface ParsedDocument {
    text: string;
    metadata: {
        fileName: string;
        mimeType: string;
        pageCount?: number;
    };
}

export interface DocumentChunk {
    id?: string;
    content: string;
    chunkIndex: number;
    tokenCount?: number;

    sourceFile?: string;
    sourceType?: string;
    page?: number;
    sectionTitle?: string;
    moduleId?: string;
    embeddingModel?: string;
    parentChunkId?: string;
}

export interface RetrievedChunk {
    id: string;
    content: string;
    fileName: string;
    score: number;
}

export interface AddChunksInput {
    moduleId: string;
    fileId: string;
    chunks: DocumentChunk[];
    embeddings: number[][];
}

export interface SearchSimilarInput {
    moduleId: string;
    query: string;
    limit?: number;
}
