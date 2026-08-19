// src/services/generation/evidence-map.service.ts
//
// Serviço de construção do mapa de evidências a partir de chunks recuperados.
// Chama o LLM para extrair tópicos e fatos. Possui fallback heurístico robusto
// para nunca retornar um mapa vazio.

import type { RetrievedChunk, EvidenceMap, EvidenceTopic } from "@/lib/rag/types";
import { LlmRouter } from "@/services/ai/llm-router";
import { EVIDENCE_MAP_PROMPT } from "@/lib/prompts/evidence-map.prompt";
import { env } from "@/lib/env";
import { Logger } from "@/lib/logger";

const logger = new Logger("EvidenceMapService");

/**
 * Monta o texto de contexto formatado para o prompt de extração de evidências.
 * Cada chunk recebe um identificador "Fonte N" sequencial.
 */
function formatChunksForEvidence(chunks: RetrievedChunk[]): string {
    return chunks
        .map((c, i) => {
            const sectionLabel = c.sectionTitle
                ? ` | Seção: ${c.sectionTitle.replace(/^#{1,4}\s*/, "")}`
                : "";
            const header = `[Chunk ID: ${c.id} | Fonte ${i + 1}: ${c.fileName}${sectionLabel}]`;
            return `${header}\n${c.content}`;
        })
        .join("\n\n---\n\n");
}

function classifyCoverage(factsCount: number): EvidenceTopic["coverage"] {
    if (factsCount >= 3) return "DEEP";
    if (factsCount === 2) return "MODERATE";
    if (factsCount === 1) return "SUPERFICIAL";
    return "OMIT";
}

/**
 * Fallback heurístico: extrai tópicos e frases-chave dos chunks recuperados
 * caso a chamada do LLM para o mapa de evidências falhe ou retorne vazio.
 * Garante que o mapa NUNCA fique com 0 tópicos.
 */
export function buildFallbackEvidenceMap(chunks: RetrievedChunk[]): EvidenceMap {
    const topics: EvidenceTopic[] = [];

    for (const [i, chunk] of chunks.entries()) {
        const topicTitle = chunk.sectionTitle
            ? chunk.sectionTitle.replace(/^#{1,4}\s*/, "").trim()
            : `Tópico Principal da Fonte ${i + 1}`;

        // Extrair frases informativas
        const sentences = chunk.content
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 25 && s.length < 350)
            .slice(0, 5);

        if (sentences.length > 0) {
            topics.push({
                topic: topicTitle,
                coverage: sentences.length >= 3 ? "DEEP" : "MODERATE",
                facts: sentences.map((stmt) => ({
                    statement: stmt,
                    sourceIds: [chunk.id],
                    sourceLabels: [`Fonte ${i + 1}: ${chunk.fileName}`],
                })),
            });
        }
    }

    const totalFacts = topics.reduce((sum, t) => sum + t.facts.length, 0);

    return {
        topics,
        totalFacts,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Constrói o mapa de evidências a partir dos chunks recuperados.
 */
export async function buildEvidenceMap(
    chunks: RetrievedChunk[],
    moduleId: string,
): Promise<EvidenceMap> {
    const contextText = formatChunksForEvidence(chunks);

    const prompt = EVIDENCE_MAP_PROMPT.replace("{{CONTEXT_CHUNKS}}", contextText);

    logger.info("buildEvidenceMap", "Extraindo mapa de evidências", {
        moduleId,
        chunksCount: chunks.length,
        contextChars: contextText.length,
    });

    try {
        const resultText = await LlmRouter.generateText(prompt, {
            pipeline: "EVIDENCE_MAP",
            modelName: env.CONTENT_GENERATION_MODEL,
            temperature: 0.1,
            maxTokens: 4096,
            moduleId,
        });

        // Tentar parsear o JSON
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : resultText.trim();
        const rawMap = JSON.parse(jsonStr) as {
            topics?: Array<{
                topic: string;
                facts: Array<{ statement: string; sourceIds?: string[]; sourceLabels?: string[] }>;
            }>;
        };

        if (rawMap.topics && Array.isArray(rawMap.topics) && rawMap.topics.length > 0) {
            const topics: EvidenceTopic[] = rawMap.topics.map((t) => ({
                topic: t.topic,
                coverage: classifyCoverage(t.facts?.length ?? 0),
                facts: (t.facts || []).map((f) => ({
                    statement: f.statement,
                    sourceIds: f.sourceIds || [],
                    sourceLabels: f.sourceLabels || [],
                })),
            }));

            const validTopics = topics.filter((t) => t.coverage !== "OMIT");
            const totalFacts = validTopics.reduce((sum, t) => sum + t.facts.length, 0);

            if (totalFacts > 0) {
                logger.info("buildEvidenceMap", "Mapa de evidências construído com sucesso", {
                    moduleId,
                    topicsCount: validTopics.length,
                    totalFacts,
                });

                return {
                    topics: validTopics,
                    totalFacts,
                    generatedAt: new Date().toISOString(),
                };
            }
        }
    } catch (parseError) {
        logger.warn("buildEvidenceMap", "Falha ao extrair JSON do mapa via LLM — acionando fallback heurístico", {
            moduleId,
            error: parseError instanceof Error ? parseError.message : String(parseError),
        });
    }

    // Se chegou aqui, LLM falhou ou retornou 0 fatos -> usar fallback
    logger.warn("buildEvidenceMap", "Usando mapa de evidências de fallback heurístico", { moduleId });
    return buildFallbackEvidenceMap(chunks);
}

/**
 * Constrói um mapa de evidências mais restrito mantendo apenas tópicos DEEP e MODERATE.
 */
export function restrictEvidenceMap(map: EvidenceMap): EvidenceMap {
    const restrictedTopics = map.topics.filter(
        (t) => t.coverage === "DEEP" || t.coverage === "MODERATE"
    );

    return {
        topics: restrictedTopics,
        totalFacts: restrictedTopics.reduce((sum, t) => sum + t.facts.length, 0),
        generatedAt: new Date().toISOString(),
    };
}
