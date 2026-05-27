// src/lib/rag/quiz-rag-context-service.ts
// Preparado para uso futuro: fornecer contexto RAG para geração de quiz.

import { getVectorStore } from "../core/vector-store";

export async function getQuizContextFromRag(input: {
    moduleId: string;
    topic?: string;
}) {
    const vectorStore = getVectorStore();

    return vectorStore.searchSimilar({
        moduleId: input.moduleId,
        query: input.topic ?? "principais conceitos do módulo",
        limit: Number(process.env.RAG_FINAL_CONTEXT_LIMIT || 5),
    });
}
