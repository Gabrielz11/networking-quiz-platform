// src/lib/rag/embedding-service.ts
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export interface EmbeddingService {
    embedText(text: string): Promise<number[]>;
    embedMany(texts: string[]): Promise<number[][]>;
}

// 1. Provedor Google Gemini (768 dimensões)
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
        // Fallback caso o modelo configurado no .env seja da OpenAI por engano
        let modelName = process.env.EMBEDDING_MODEL ?? "text-embedding-004";
        if (modelName.includes("openai") || modelName.includes("text-embedding-3")) {
            modelName = "text-embedding-004";
        }
        
        const result = await this.client.models.embedContent({
            model: modelName,
            contents: [{ parts: [{ text }] }],
            config: {
                outputDimensionality: 768
            }
        });

        const embedding = result.embeddings?.[0]?.values;

        if (!embedding || embedding.length === 0) {
            throw new Error("Erro ao gerar embedding: resposta vazia do provider.");
        }

        return embedding;
    }

    async embedMany(texts: string[]): Promise<number[][]> {
        const embeddings: number[][] = [];
        for (const text of texts) {
            if (embeddings.length > 0) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            embeddings.push(await this.embedText(text));
        }
        return embeddings;
    }
}

// 2. Provedor OpenAI (Configurado dinamicamente para 768 dimensões)
export class OpenAIEmbeddingService implements EmbeddingService {
    private client: OpenAI;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY não configurada.");
        }
        this.client = new OpenAI({ apiKey });
    }

    async embedText(text: string): Promise<number[]> {
        let modelName = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
        if (modelName.includes("gemini")) {
            modelName = "text-embedding-3-small";
        }

        const response = await this.client.embeddings.create({
            model: modelName,
            input: text,
            encoding_format: "float",
            dimensions: 768 // Reduz a saída de 1536 para 768 para alinhar com o pgvector
        });

        return response.data[0].embedding;
    }

    async embedMany(texts: string[]): Promise<number[][]> {
        let modelName = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
        if (modelName.includes("gemini")) {
            modelName = "text-embedding-3-small";
        }

        const response = await this.client.embeddings.create({
            model: modelName,
            input: texts,
            encoding_format: "float",
            dimensions: 768 // Reduz a saída para 768 dimensões
        });

        return response.data.map((item) => item.embedding);
    }
}

// 3. Fábrica inteligente que escolhe o provedor dinamicamente
export function getEmbeddingService(): EmbeddingService {
    const provider = process.env.EMBEDDING_PROVIDER?.toLowerCase() ?? "google";
    if (provider === "openai") {
        return new OpenAIEmbeddingService();
    }
    return new GeminiEmbeddingService();
}
