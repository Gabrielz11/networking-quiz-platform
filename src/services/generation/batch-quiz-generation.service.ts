import { LlmRouter } from "@/services/ai/llm-router";
import { Logger } from "@/lib/logger";
import { buildBatchQuizPrompt } from "./prompts/batch-quiz.prompt";

const logger = new Logger("BatchQuizGenerationService");

export interface GeneratedBatchQuestion {
    prompt: string;
    options: string[];
    correct_option_index: number;
    difficulty: string;
    explanation_base: string;
}

interface BatchResponse {
    questions: GeneratedBatchQuestion[];
}

export class BatchQuizGenerationService {
    /**
     * Gera um lote de questões de múltipla escolha baseado no conteúdo de um módulo.
     */
    static async generate(
        title: string,
        content: string,
        moduleId?: string
    ): Promise<GeneratedBatchQuestion[]> {
        const prompt = buildBatchQuizPrompt(title, content);

        logger.info("generate", "Gerando lote de questões", { title });

        const data = await LlmRouter.generateJson<BatchResponse>(prompt, {
            pipeline: "QUIZ_GEN",
            moduleId,
            responseSchema: {
                type: "object",
                properties: {
                    questions: {
                        type: "array",
                        items: {
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
                                difficulty: { type: "string" },
                                explanation_base: { type: "string" }
                            },
                            required: ["prompt", "options", "correct_option_index", "difficulty", "explanation_base"]
                        }
                    }
                },
                required: ["questions"]
            }
        });

        // Validação do array
        if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
            logger.error("generate", "Array 'questions' ausente ou vazio");
            throw new Error("Formato de resposta inválido da IA: array 'questions' ausente.");
        }

        // Validação forte de cada item
        const validDifficulties = ["easy", "medium", "hard"];

        data.questions.forEach((q: GeneratedBatchQuestion, index: number) => {
            if (
                typeof q.prompt !== "string" ||
                q.prompt.trim() === "" ||
                !Array.isArray(q.options) ||
                q.options.length !== 4 ||
                !q.options.every((opt: unknown) => typeof opt === "string" && (opt as string).trim() !== "") ||
                typeof q.correct_option_index !== "number" ||
                !Number.isInteger(q.correct_option_index) ||
                q.correct_option_index < 0 ||
                q.correct_option_index >= q.options.length ||
                typeof q.difficulty !== "string" ||
                !validDifficulties.includes(q.difficulty.toLowerCase()) ||
                typeof q.explanation_base !== "string" ||
                q.explanation_base.trim() === ""
            ) {
                logger.error("generate", `Questão ${index} falhou na validação`, { questionPrompt: q.prompt?.substring(0, 50) });
                throw new Error(`Formato inválido na questão ${index + 1} do lote.`);
            }
        });

        logger.info("generate", `Lote gerado com ${data.questions.length} questões`, { title, count: data.questions.length });
        return data.questions;
    }
}
