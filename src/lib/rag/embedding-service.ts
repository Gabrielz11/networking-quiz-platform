// src/lib/rag/embedding-service.ts
// Reutiliza a GEMINI_API_KEY já configurada no projeto.

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface EmbeddingService {
    embedText(text: string): Promise<number[]>;
    embedMany(texts: string[]): Promise<number[][]>;
}

export class GeminiEmbeddingService implements EmbeddingService {
    private client: GoogleGenerativeAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY não configurada.");
        }
        this.client = new GoogleGenerativeAI(apiKey);
    }

    async embedText(text: string): Promise<number[]> {
        const modelName = process.env.EMBEDDING_MODEL ?? "text-embedding-004";
        const model = this.client.getGenerativeModel({ model: modelName });

        const result = await model.embedContent(text);
        const embedding = result.embedding?.values;

        if (!embedding || embedding.length === 0) {
            throw new Error("Erro ao gerar embedding: resposta vazia do provider.");
        }

        return embedding;
    }

    async embedMany(texts: string[]): Promise<number[][]> {
        const embeddings: number[][] = [];

        for (const text of texts) {
            // Pequena pausa entre requisições para respeitar rate limits
            if (embeddings.length > 0) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            embeddings.push(await this.embedText(text));
        }

        return embeddings;
    }
}

export function getEmbeddingService(): EmbeddingService {
    return new GeminiEmbeddingService();
}
