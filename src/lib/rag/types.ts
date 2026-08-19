// src/lib/rag/types.ts
//
// Tipos compartilhados do pipeline RAG: chunks, evidências, snapshots.

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
    /** ID do arquivo de origem para diversificação */
    fileId?: string;
    /** Índice do chunk para ordenação */
    chunkIndex?: number;
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

// ── Mapa de Evidências ──────────────────────────────────────────────────────

export interface EvidenceFact {
    /** Afirmação atômica extraída do chunk */
    statement: string;
    /** IDs dos chunks que sustentam o fato */
    sourceIds: string[];
    /** Labels legíveis das fontes (ex: "[Fonte: arquivo.pdf | Seção: X]") */
    sourceLabels: string[];
}

export interface EvidenceTopic {
    /** Nome do tópico identificado */
    topic: string;
    /** Nível de cobertura baseado na quantidade de fatos */
    coverage: "DEEP" | "MODERATE" | "SUPERFICIAL" | "OMIT";
    /** Fatos permitidos para este tópico */
    facts: EvidenceFact[];
}

export interface EvidenceMap {
    topics: EvidenceTopic[];
    totalFacts: number;
    generatedAt: string;
}

// ── Snapshot de Contexto ────────────────────────────────────────────────────

export interface ContextChunkSnapshot {
    id: string;
    content: string;
    fileName: string;
    sectionTitle?: string;
    score: number;
    /** True se o conteúdo foi truncado para caber no orçamento */
    truncated: boolean;
    /** Comprimento original do chunk antes de truncamento */
    originalLength: number;
}

export interface GenerationSnapshot {
    contextChunks: ContextChunkSnapshot[];
    contextHash: string;
    contextOrder: string[];
    evidenceMap: EvidenceMap | null;
    promptVersion: string;
    promptText: string;
    model: string;
    temperature: number;
    maxTokens: number | null;
    responseText: string;
    responseHash: string;
}
