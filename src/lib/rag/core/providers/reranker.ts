import { env } from "@/lib/env";
import { Logger } from "@/lib/logger";

const logger = new Logger("RerankerProvider");

export interface RerankedDocument {
    index: number;
    relevance_score: number;
}

export interface RerankerProvider {
    /**
     * Reordena uma lista de documentos (textos) baseando-se na relevância para a query.
     * Retorna os índices originais e seus scores, ordenados do mais relevante para o menos relevante.
     */
    rerank(query: string, documents: string[], topN: number): Promise<RerankedDocument[]>;
}

export class CohereReranker implements RerankerProvider {
    private apiKey: string;
    private model = "rerank-multilingual-v3.0";

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async rerank(query: string, documents: string[], topN: number): Promise<RerankedDocument[]> {
        try {
            logger.info("CohereReranker", "Enviando documentos para reranking...", { query, docCount: documents.length, topN });

            const response = await fetch("https://api.cohere.com/v1/rerank", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    model: this.model,
                    query: query,
                    documents: documents,
                    top_n: topN,
                    return_documents: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error("CohereReranker", "Erro na API da Cohere", { status: response.status, errorText });
                throw new Error(`Cohere API error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            // Cohere retorna { results: [ { index: 0, relevance_score: 0.99 }, ... ] }
            return data.results as RerankedDocument[];
        } catch (error: any) {
            logger.error("CohereReranker", "Falha no reranking, fazendo fallback na aplicação", { error: error.message });
            throw error;
        }
    }
}

export function getRerankerProvider(): RerankerProvider | null {
    if (env.COHERE_API_KEY && env.COHERE_API_KEY.length > 0) {
        return new CohereReranker(env.COHERE_API_KEY);
    }
    return null; // Retorna null se não houver chave configurada, para fazer fallback
}
