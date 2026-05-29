import { LlmRouter } from "@/services/ai/llm-router";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { QuestionSchema, GeneratedQuestion } from "./schemas/quiz-question.schema";
import { buildQuizPrompt, QuestionDifficulty } from "./prompts/quiz-question.prompt";
import { parseCorrectOptionIndex } from "./utils/parse-correct-option-index";
import { shuffleQuestionOptions } from "./utils/shuffle-question-options";
import { getSafeContent } from "./utils/safe-content";

const logger = new Logger("QuizQuestionGenerationService");

export class QuizQuestionGenerationService {
    /**
     * Gera uma questão adaptativa de quiz baseada no conteúdo do módulo.
     */
    static async generate(
        difficulty: QuestionDifficulty,
        moduleContent: string,
        previousPrompts: string[],
        moduleId?: string,
        sessionId?: string
    ): Promise<GeneratedQuestion> {
        if (!moduleContent.trim()) {
            throw new Error("O conteúdo do módulo não pode estar vazio.");
        }

        const safeModuleContent = getSafeContent(moduleContent);
        const prompt = buildQuizPrompt(difficulty, safeModuleContent, previousPrompts);

        logger.info("generate", "Gerando questão adaptativa", {
            difficulty,
            previousPromptsCount: previousPrompts.length,
        });

        const MAX_RETRIES = 2;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const raw = await LlmRouter.generateJson<Record<string, unknown>>(prompt, {
                    modelName: env.GEMINI_MODEL,
                    temperature: 0.6,
                    pipeline: "QUIZ_GEN",
                    moduleId,
                    sessionId,
                    responseSchema: {
                        type: "object",
                        properties: {
                            prompt: { type: "string" },
                            options: {
                                type: "array",
                                items: { type: "string" },
                                minItems: 4,
                                maxItems: 4
                            },
                            correct_option_index: { type: "number" },
                            explanation: { type: "string" }
                        },
                        required: ["prompt", "options", "correct_option_index", "explanation"]
                    }
                });

                const coerced = {
                    ...raw,
                    correct_option_index: parseCorrectOptionIndex(raw?.correct_option_index),
                };

                const parsed = QuestionSchema.safeParse(coerced);
                if (!parsed.success) {
                    logger.warn("generate", `Tentativa ${attempt} falhou na validação`, {
                        issues: parsed.error.issues,
                    });
                    throw new Error("Formato de resposta inválido da IA.");
                }

                const validated = parsed.data;

                const { options: shuffledTexts, correct_option_index: newCorrectIndex } = shuffleQuestionOptions(
                    validated.options,
                    validated.correct_option_index
                );

                logger.info("generate", "Questão gerada e embaralhada com sucesso", {
                    difficulty,
                    originalIndex: validated.correct_option_index,
                    newIndex: newCorrectIndex,
                    attempt
                });

                return {
                    ...validated,
                    options: shuffledTexts,
                    correct_option_index: newCorrectIndex,
                };
            } catch (error: any) {
                lastError = error;
                const msg = error.message?.toLowerCase() || "";

                const isCriticalError =
                    msg.includes("api key") ||
                    msg.includes("quota") ||
                    msg.includes("rate limit") ||
                    msg.includes("413") ||
                    msg.includes("429") ||
                    msg.includes("401") ||
                    msg.includes("403") ||
                    msg.includes("unauthorized") ||
                    msg.includes("forbidden") ||
                    msg.includes("permission") ||
                    msg.includes("authentication") ||
                    msg.includes("billing");

                if (isCriticalError) {
                    throw error;
                }

                logger.warn("generate", `Tentativa ${attempt}/${MAX_RETRIES} falhou com erro recuperável.`, { errorMessage: error.message });
            }
        }

        throw new Error(`Falha ao gerar questão após ${MAX_RETRIES} tentativas: ${lastError?.message}`);
    }
}