import OpenAI from "openai";

export interface EmbeddingProvider {
    generateEmbedding(text: string): Promise<number[]>;
    generateEmbeddings(texts: string[]): Promise<number[][]>;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
    private client: OpenAI;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY is not configured.");
        }
        this.client = new OpenAI({ apiKey });
    }

    async generateEmbedding(text: string): Promise<number[]> {
        const response = await this.client.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float",
        });

        return response.data[0].embedding;
    }

    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const response = await this.client.embeddings.create({
            model: "text-embedding-3-small",
            input: texts,
            encoding_format: "float",
        });

        return response.data.map((item) => item.embedding);
    }
}
