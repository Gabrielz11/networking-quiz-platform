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
    /** "parent" = chunk grande para contexto (sem embedding) | "child" = chunk pequeno para busca vetorial */
    chunkType?: "parent" | "child";
}

export interface RetrievedChunk {
    id: string;
    content: string;
    fileName: string;
    score: number;
    /** Título da seção Markdown de origem (ex: "## 3.2 Neighbor Discovery Protocol") */
    sectionTitle?: string;
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
