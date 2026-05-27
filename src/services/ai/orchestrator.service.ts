import { AiService } from "@/services/ai.service";
import { CriticService } from "./critic.service";
import { SemanticCache } from "@/lib/semantic-cache";
import { Logger } from "@/lib/logger";
import type { OrchestratorOptions, CriticReport } from "./critic.types";

const logger = new Logger("AIOrchestrator");

/**
 * Orquestrador central de IA do Lumina LMS.
 *
 * Responsável por coordenar o ciclo completo de geração:
 *   1. Semantic Cache (Tier 1 Redis + Tier 2 pgvector) — retorna imediato se hit
 *   2. Geração via AiService (Gemini + fallback Groq)
 *   3. Critic Loop opcional — avaliação pedagógica dos 7 pilares
 *   4. Retentativas automáticas com feedback enriquecido se reprovado
 *   5. Persistência de metadados com criticScore real
 *   6. Store do resultado no Semantic Cache (fire-and-forget)
 */
export class AIOrchestrator {

    /**
     * Gera conteúdo JSON com Semantic Cache + Critic Loop opcional.
     */
    static async runJson<T = unknown>(
        promptText: string,
        options: OrchestratorOptions
    ): Promise<T> {
        const {
            useCritic = false,
            maxRetries = 2,
            pipeline,
            moduleId,
            sessionId,
            retrievedChunks,
            modelName,
            fallbackModelName,
            temperature = 0.7,
            timeoutMs,
            responseSchema,
            systemInstruction,
            skipCache = false,
        } = options;

        // ── Semantic Cache Lookup ──────────────────────────────────────────
        if (!skipCache) {
            const cached = await SemanticCache.get<T>(pipeline, promptText, temperature);
            if (cached !== null) {
                logger.info("runJson", "[CACHE HIT] Retornando do Semantic Cache", { pipeline });
                return cached;
            }
        }

        // ── Geração + Critic Loop ──────────────────────────────────────────
        let currentPrompt = promptText;
        let lastCriticReport: CriticReport | null = null;
        let attempts = 0;
        const maxAttempts = useCritic ? maxRetries + 1 : 1;
        let finalResult: T | null = null;

        while (attempts < maxAttempts) {
            attempts++;

            logger.info("runJson", `Tentativa ${attempts}/${maxAttempts}`, { pipeline, useCritic });

            let result: T;
            try {
                result = await AiService.generateJson<T>(currentPrompt, {
                    pipeline,
                    moduleId,
                    sessionId,
                    retrievedChunks,
                    modelName,
                    fallbackModelName,
                    temperature,
                    timeoutMs,
                    responseSchema,
                    systemInstruction,
                    // Injeta a nota real do critic após a primeira tentativa
                    criticScore: lastCriticReport?.qualityScore,
                    criticMetrics: lastCriticReport?.metrics,
                });
            } catch (err: any) {
                logger.warn("runJson", `Erro na geração (tentativa ${attempts}/${maxAttempts}): ${err.message}`);
                
                if (attempts >= maxAttempts) {
                    throw err;
                }
                
                // Se falhou por JSON inválido ou outro erro, instruímos a IA a corrigir o formato
                currentPrompt = `${promptText}\n\n[AVISO DO SISTEMA - ERRO NA GERAÇÃO ANTERIOR]\nA sua resposta anterior falhou ao ser processada com o erro: "${err.message}".\nSe o JSON foi cortado, lembre-se de ser conciso o suficiente para caber no limite, mas garanta que a estrutura JSON esteja 100% válida e bem formada no final.`;
                continue;
            }

            if (!useCritic) {
                finalResult = result;
                break;
            }

            // Converte o resultado para string para o critic avaliar
            const contentStr = typeof result === "string"
                ? result
                : JSON.stringify(result);

            lastCriticReport = await CriticService.evaluate(contentStr, pipeline);

            if (lastCriticReport.approved) {
                logger.info("runJson", "Conteúdo aprovado pelo critic", {
                    pipeline,
                    qualityScore: lastCriticReport.qualityScore.toFixed(3),
                    attempts,
                });
                finalResult = result;
                break;
            }

            if (attempts >= maxAttempts) {
                logger.warn("runJson", "Retentativas esgotadas — retornando última geração", {
                    pipeline,
                    qualityScore: lastCriticReport.qualityScore.toFixed(3),
                });
                finalResult = result;
                break;
            }

            // Enriquece o prompt com o feedback do critic para a próxima tentativa
            logger.info("runJson", "Retentativa de geração por reprovação no critic", {
                pipeline,
                qualityScore: lastCriticReport.qualityScore.toFixed(3),
                feedback: lastCriticReport.feedback,
                attempt: attempts,
            });

            currentPrompt = `${promptText}

[FEEDBACK DO AVALIADOR PEDAGÓGICO - LEIA COM ATENÇÃO]
A sua geração anterior foi avaliada e NÃO atingiu o nível de qualidade necessário (score: ${lastCriticReport.qualityScore.toFixed(2)}/1.00).

Pontuação por pilar:
- Profundidade: ${lastCriticReport.metrics.depth.toFixed(2)}
- Clareza: ${lastCriticReport.metrics.clarity.toFixed(2)}
- Fidelidade: ${lastCriticReport.metrics.fidelity.toFixed(2)}
- Pedagogia: ${lastCriticReport.metrics.pedagogy.toFixed(2)}
- Densidade Técnica: ${lastCriticReport.metrics.technicalDensity.toFixed(2)}
- Ambiguidade (menor = melhor): ${lastCriticReport.metrics.ambiguity.toFixed(2)}
- Calibração de Dificuldade: ${lastCriticReport.metrics.difficulty.toFixed(2)}

Orientação do avaliador: ${lastCriticReport.feedback}

Gere uma versão MELHORADA que corrija especificamente os pontos acima. Mantenha o formato solicitado.`;
        }

        if (finalResult === null) {
            throw new Error("AIOrchestrator: falha inesperada no loop de geração.");
        }

        // ── Persiste no Semantic Cache (fire-and-forget) ───────────────────
        if (!skipCache) {
            SemanticCache.set(pipeline, promptText, temperature, finalResult);
        }

        return finalResult;
    }

    /**
     * Gera conteúdo em texto puro com Semantic Cache + Critic Loop opcional.
     */
    static async runText(
        promptText: string,
        options: OrchestratorOptions
    ): Promise<string> {
        const {
            useCritic = false,
            maxRetries = 2,
            pipeline,
            moduleId,
            sessionId,
            modelName,
            temperature = 0.7,
            timeoutMs,
            systemInstruction,
            skipCache = false,
        } = options;

        // ── Semantic Cache Lookup ──────────────────────────────────────────
        if (!skipCache) {
            const cached = await SemanticCache.get<string>(pipeline, promptText, temperature);
            if (cached !== null) {
                logger.info("runText", "[CACHE HIT] Retornando do Semantic Cache", { pipeline });
                return cached;
            }
        }

        // ── Geração + Critic Loop ──────────────────────────────────────────
        let currentPrompt = promptText;
        let lastCriticReport: CriticReport | null = null;
        let attempts = 0;
        const maxAttempts = useCritic ? maxRetries + 1 : 1;
        let finalResult = "";

        while (attempts < maxAttempts) {
            attempts++;

            let result = "";
            try {
                result = await AiService.generateText(currentPrompt, {
                    pipeline,
                    moduleId,
                    sessionId,
                    modelName,
                    temperature,
                    timeoutMs,
                    systemInstruction,
                    criticScore: lastCriticReport?.qualityScore,
                    criticMetrics: lastCriticReport?.metrics,
                });
            } catch (err: any) {
                logger.warn("runText", `Erro na geração (tentativa ${attempts}/${maxAttempts}): ${err.message}`);
                
                if (attempts >= maxAttempts) {
                    throw err;
                }
                
                currentPrompt = `${promptText}\n\n[AVISO DO SISTEMA - ERRO NA GERAÇÃO ANTERIOR]\nA sua resposta anterior falhou com o erro: "${err.message}". Por favor, tente gerar novamente.`;
                continue;
            }

            if (!useCritic) {
                finalResult = result;
                break;
            }

            lastCriticReport = await CriticService.evaluate(result, pipeline);

            if (lastCriticReport.approved || attempts >= maxAttempts) {
                finalResult = result;
                break;
            }

            logger.info("runText", "Retentativa de geração por reprovação no critic", {
                pipeline,
                qualityScore: lastCriticReport.qualityScore.toFixed(3),
                attempt: attempts,
            });

            currentPrompt = `${promptText}

[FEEDBACK DO AVALIADOR - MELHORE ESTES PONTOS]
Score anterior: ${lastCriticReport.qualityScore.toFixed(2)}/1.00
Orientação: ${lastCriticReport.feedback}`;
        }

        // ── Persiste no Semantic Cache (fire-and-forget) ───────────────────
        if (!skipCache && finalResult) {
            SemanticCache.set(pipeline, promptText, temperature, finalResult);
        }

        return finalResult;
    }
}
