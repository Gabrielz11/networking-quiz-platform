import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { env } from "@/lib/env";

export interface EmbeddingProvider {
    embedText(text: string): Promise<number[]>;
    embedMany(texts: string[]): Promise<number[][]>;
    readonly modelName: string;
}

// 1. Provedor Google Gemini (768 dimensões)
export class GeminiEmbeddingProvider implements EmbeddingProvider {
    private client: GoogleGenAI;
    // P1.1 — modelo fixado no env validado; exposto para validação de divergência
    readonly modelName: string;

    constructor() {
        if (!env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY não configurada.");
        }
        this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        this.modelName = env.EMBEDDING_MODEL;
    }

    async embedText(text: string): Promise<number[]> {
        const result = await this.client.models.embedContent({
            model: this.modelName,
            contents: [{ parts: [{ text }] }],
            config: { outputDimensionality: 768 },
        });

        const embedding = result.embeddings?.[0]?.values;
        if (!embedding || embedding.length === 0) {
            throw new Error("Erro ao gerar embedding: resposta vazia do provider.");
        }
        return embedding;
    }

    // P3.3 — Paralelismo controlado (5 concurrent) em vez de loop sequencial com sleep fixo
    async embedMany(texts: string[]): Promise<number[][]> {
        const CONCURRENCY = 5;
        const results: number[][] = [];
        for (let i = 0; i < texts.length; i += CONCURRENCY) {
            const batch = texts.slice(i, i + CONCURRENCY);
            const embeddings = await Promise.all(batch.map((t) => this.embedText(t)));
            results.push(...embeddings);
        }
        return results;
    }
}

// 2. Provedor OpenAI (configurado para 768 dimensões)
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
    private client: OpenAI;
    // P1.1 — modelo fixado no env validado
    readonly modelName: string;

    constructor() {
        if (!env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY não configurada.");
        }
        this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
        this.modelName = env.EMBEDDING_MODEL;
    }

    async embedText(text: string): Promise<number[]> {
        const response = await this.client.embeddings.create({
            model: this.modelName,
            input: text,
            encoding_format: "float",
            dimensions: 768, // Reduz a saída de 1536 para 768 para alinhar com o pgvector
        });
        return response.data[0].embedding;
    }

    async embedMany(texts: string[]): Promise<number[][]> {
        const response = await this.client.embeddings.create({
            model: this.modelName,
            input: texts,
            encoding_format: "float",
            dimensions: 768,
        });
        return response.data.map((item) => item.embedding);
    }
}

/**
 * P1.1 — Factory que usa env.EMBEDDING_PROVIDER (default "openai", alinhado com env.ts).
 * Antes usava process.env com default "google", divergindo do env.ts e podendo causar
 * mismatch silencioso entre ingestão e consulta vetorial.
 *
 * IMPORTANTE: trocar EMBEDDING_PROVIDER exige reprocessar todos os módulos —
 * os vetores já armazenados usam o espaço vetorial do modelo anterior e são incompatíveis.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
    const provider = env.EMBEDDING_PROVIDER;
    if (provider === "openai") {
        return new OpenAIEmbeddingProvider();
    }
    return new GeminiEmbeddingProvider();
}
