// src/lib/rag/embedding-service.ts
// Reutiliza a GEMINI_API_KEY já configurada no projeto.

import { GoogleGenAI } from "@google/genai";

export interface EmbeddingService {
    embedText(text: string): Promise<number[]>;
    embedMany(texts: string[]): Promise<number[][]>;
}

export class GeminiEmbeddingService implements EmbeddingService {
    private client: GoogleGenAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY não configurada.");
        }
        this.client = new GoogleGenAI({ apiKey });
    }

    async embedText(text: string): Promise<number[]> {
        const modelName = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
        
        const result = await this.client.models.embedContent({
            model: modelName,
            contents: [{ parts: [{ text }] }],
            config: {
                outputDimensionality: 768
            }
        });

        const embedding = result.embeddings[0]?.values;

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
