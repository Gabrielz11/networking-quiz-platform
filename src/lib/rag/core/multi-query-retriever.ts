// src/lib/rag/core/multi-query-retriever.ts
//
// Recuperação com cobertura: gera múltiplas sub-queries, executa buscas
// vetoriais, aplica deduplicação, diversidade por arquivo/seção e
// respeita orçamento de tokens para montar o contexto final.

import { getVectorStore } from "./vector-store";
import type { RetrievedChunk } from "../types";
import { env } from "@/lib/env";
import { Logger } from "@/lib/logger";

const logger = new Logger("MultiQueryRetriever");

/**
 * Estimativa simples de tokens: ~4 caracteres por token para português.
 * Mais conservador que inglês (~3.5 chars/token) por causa de acentos e palavras mais longas.
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Gera sub-queries heurísticas a partir do título e descrição do módulo.
 *
 * Estratégia:
 * 1. Query completa (título + descrição)
 * 2. Apenas o título
 * 3. Palavras-chave técnicas extraídas da descrição
 * 4. Se o título sugere comparação, gerar queries específicas por lado
 */
export function generateSubQueries(title: string, description: string | null): string[] {
    const queries: string[] = [];
    const fullQuery = `${title} ${description ?? ""}`.trim();

    // 1. Query completa
    queries.push(fullQuery);

    // 2. Apenas título se for diferente da query completa
    if (description && description.trim().length > 10) {
        queries.push(title);
    }

    // 3. Extrair conceitos-chave da descrição
    if (description) {
        // Remover stop words comuns em PT-BR e dividir por separadores
        const segments = description
            .split(/[,;.!?\n]/)
            .map(s => s.trim())
            .filter(s => s.length > 15);

        for (const segment of segments.slice(0, 2)) {
            queries.push(`${title} ${segment}`);
        }
    }

    // 4. Se parece comparação, gerar queries por lado
    const comparisonMatch = title.match(/(.+?)\s+(?:vs\.?|versus|x|e|entre)\s+(.+)/i);
    if (comparisonMatch) {
        queries.push(`conceitos e características de ${comparisonMatch[1].trim()}`);
        queries.push(`conceitos e características de ${comparisonMatch[2].trim()}`);
    }

    // 5. Query de detalhamento técnico
    queries.push(`detalhes técnicos ${title}`);

    // Deduplicar queries idênticas (case-insensitive)
    const seen = new Set<string>();
    return queries.filter(q => {
        const key = q.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Aplica filtros de diversidade nos chunks recuperados:
 * - Max N chunks do mesmo arquivo
 * - Max M chunks da mesma seção
 * - Deduplicação por conteúdo (parentChunkId ?? id)
 */
function applyDiversityFilters(
    chunks: RetrievedChunk[],
    maxPerFile: number,
    maxPerSection: number,
): RetrievedChunk[] {
    const fileCount = new Map<string, number>();
    const sectionCount = new Map<string, number>();
    const seenContent = new Set<string>();
    const result: RetrievedChunk[] = [];

    for (const chunk of chunks) {
        // Deduplicação por conteúdo
        const contentKey = chunk.id;
        if (seenContent.has(contentKey)) continue;

        // Diversidade por arquivo
        const fileKey = chunk.fileId ?? chunk.fileName;
        const currentFileCount = fileCount.get(fileKey) ?? 0;
        if (currentFileCount >= maxPerFile) continue;

        // Diversidade por seção
        if (chunk.sectionTitle) {
            const sectionKey = `${fileKey}::${chunk.sectionTitle}`;
            const currentSectionCount = sectionCount.get(sectionKey) ?? 0;
            if (currentSectionCount >= maxPerSection) continue;
            sectionCount.set(sectionKey, currentSectionCount + 1);
        }

        seenContent.add(contentKey);
        fileCount.set(fileKey, currentFileCount + 1);
        result.push(chunk);
    }

    return result;
}

/**
 * Trunca chunks para caber no orçamento de tokens, cortando em limites
 * de parágrafo em vez de fazer corte cego por caractere.
 *
 * Retorna os chunks (potencialmente truncados) e indica quais foram cortados.
 */
function applyTokenBudget(
    chunks: RetrievedChunk[],
    budgetTokens: number,
): { chunks: RetrievedChunk[]; truncatedIds: Set<string> } {
    const truncatedIds = new Set<string>();
    const result: RetrievedChunk[] = [];
    let usedTokens = 0;

    const MAX_SINGLE_CHUNK_CHARS = 3_500;

    for (const rawChunk of chunks) {
        // Garantir que nenhum chunk individual exceda MAX_SINGLE_CHUNK_CHARS
        let chunk = rawChunk;
        if (chunk.content.length > MAX_SINGLE_CHUNK_CHARS) {
            const cappedContent = truncateAtParagraph(chunk.content, MAX_SINGLE_CHUNK_CHARS);
            chunk = { ...chunk, content: cappedContent };
            truncatedIds.add(chunk.id);
        }

        const chunkTokens = estimateTokens(chunk.content);

        if (usedTokens + chunkTokens <= budgetTokens) {
            // Chunk cabe inteiro
            result.push(chunk);
            usedTokens += chunkTokens;
        } else {
            // Quanto resta de orçamento?
            const remainingTokens = budgetTokens - usedTokens;
            const remainingChars = remainingTokens * 4;

            if (remainingChars < 200) {
                // Muito pouco espaço, parar
                break;
            }

            // Cortar em limite de parágrafo
            const truncatedContent = truncateAtParagraph(chunk.content, remainingChars);
            if (truncatedContent.length > 100) {
                result.push({ ...chunk, content: truncatedContent });
                truncatedIds.add(chunk.id);
                usedTokens += estimateTokens(truncatedContent);
            }
            break; // Orçamento esgotado
        }
    }

    return { chunks: result, truncatedIds };
}

/**
 * Trunca texto no limite de parágrafo mais próximo ao maxChars,
 * evitando cortar no meio de uma frase.
 */
function truncateAtParagraph(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;

    // Tentar cortar em final de parágrafo (\n\n)
    const sub = text.slice(0, maxChars);
    const lastParagraph = sub.lastIndexOf("\n\n");
    if (lastParagraph > maxChars * 0.5) {
        return sub.slice(0, lastParagraph).trimEnd();
    }

    // Fallback: cortar em final de frase
    const lastSentence = sub.search(/[.!?]\s+[A-ZÀ-Ú][^\s]*$/);
    if (lastSentence > maxChars * 0.5) {
        return sub.slice(0, lastSentence + 1).trimEnd();
    }

    // Último recurso: cortar em espaço
    const lastSpace = sub.lastIndexOf(" ");
    if (lastSpace > maxChars * 0.7) {
        return sub.slice(0, lastSpace).trimEnd();
    }

    return sub.trimEnd();
}

export interface MultiQueryResult {
    chunks: RetrievedChunk[];
    truncatedIds: Set<string>;
    queriesUsed: string[];
    totalCandidates: number;
}

/**
 * Recupera chunks usando múltiplas sub-queries, aplica reranking,
 * diversidade e orçamento de tokens.
 */
export async function retrieveWithCoverage(input: {
    moduleId: string;
    title: string;
    description: string | null;
}): Promise<MultiQueryResult> {
    const vectorStore = getVectorStore();
    const queries = generateSubQueries(input.title, input.description);

    logger.info("retrieveWithCoverage", "Sub-queries geradas", {
        moduleId: input.moduleId,
        queries,
        count: queries.length,
    });

    // Executar busca para cada sub-query
    const allChunks: RetrievedChunk[] = [];
    const seenIds = new Set<string>();

    for (const query of queries) {
        const results = await vectorStore.searchSimilar({
            moduleId: input.moduleId,
            query,
            limit: env.RAG_FINAL_CONTEXT_LIMIT,
        });

        for (const chunk of results) {
            if (!seenIds.has(chunk.id)) {
                seenIds.add(chunk.id);
                allChunks.push(chunk);
            }
        }
    }

    const totalCandidates = allChunks.length;

    logger.info("retrieveWithCoverage", "Chunks candidatos após multi-query", {
        moduleId: input.moduleId,
        totalCandidates,
        uniqueFiles: new Set(allChunks.map(c => c.fileId ?? c.fileName)).size,
    });

    // Ordenar por score decrescente
    allChunks.sort((a, b) => b.score - a.score);

    // Aplicar filtros de diversidade
    const diverseChunks = applyDiversityFilters(
        allChunks,
        env.RAG_MAX_CHUNKS_PER_FILE,
        env.RAG_MAX_CHUNKS_PER_SECTION,
    );

    // Limitar ao RAG_FINAL_CONTEXT_LIMIT
    const limitedChunks = diverseChunks.slice(0, env.RAG_FINAL_CONTEXT_LIMIT);

    // Aplicar orçamento de tokens
    const { chunks: budgetedChunks, truncatedIds } = applyTokenBudget(
        limitedChunks,
        env.RAG_CONTEXT_BUDGET_TOKENS,
    );

    logger.info("retrieveWithCoverage", "Contexto final montado", {
        moduleId: input.moduleId,
        totalCandidates,
        afterDiversity: diverseChunks.length,
        afterLimit: limitedChunks.length,
        afterBudget: budgetedChunks.length,
        truncated: truncatedIds.size,
        estimatedTokens: budgetedChunks.reduce((sum, c) => sum + estimateTokens(c.content), 0),
    });

    return {
        chunks: budgetedChunks,
        truncatedIds,
        queriesUsed: queries,
        totalCandidates,
    };
}
