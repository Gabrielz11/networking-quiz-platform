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

        const raw = await LlmRouter.generateJson<Record<string, unknown>>(prompt, {
            modelName: env.QUESTION_GENERATION_MODEL,
            temperature: 0.6,
            pipeline: "QUIZ_GEN",
            fallbackEnabled: true,
            maxTokens: 1024,
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
            logger.error("generate", "Validação falhou na resposta da IA", {
                issues: parsed.error.issues,
                raw
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
        });

        return {
            ...validated,
            options: shuffledTexts,
            correct_option_index: newCorrectIndex,
        };
    }
}