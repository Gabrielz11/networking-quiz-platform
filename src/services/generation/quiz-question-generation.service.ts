import { LlmRouter } from "@/services/ai/llm-router";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { z } from "zod";

const logger = new Logger("QuizLlmService");

type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

const QuestionSchema = z.object({
    prompt: z
        .string()
        .trim()
        .min(10, "O enunciado deve ter pelo menos 10 caracteres.")
        .max(1000, "O enunciado não pode ultrapassar 1000 caracteres."),
    options: z
        .array(z.string().trim().min(1).max(500))
        .length(4, "Devem ser exatamente 4 opções.")
        .refine(
            (opts) => new Set(opts.map((o) => o.trim().toLowerCase())).size === 4,
            { message: "As opções devem ser únicas." }
        ),
    correct_option_index: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(10).max(2000),
}).strict();

export type GeneratedQuestion = z.infer<typeof QuestionSchema>;

function buildQuizPrompt(
    difficulty: QuestionDifficulty,
    moduleContent: string,
    previousPrompts: string[]
): string {
    const avoidSection = previousPrompts.length > 0
        ? `\n A nova questão deve abordar um conceito, cenário ou aplicação diferente. 
        Evite criar uma questão apenas reformulando perguntas anteriores.
        As alternativas incorretas devem ser tecnicamente plausíveis, não absurdas.
        NÃO repita os seguintes temas já abordados nesta sessão:\n- ${previousPrompts.join("\n- ")}\n`
        : "";

    return `Gere EXATAMENTE UMA questão de múltipla escolha sobre o conteúdo abaixo.

Nível: ${difficulty}
- EASY: conceito básico e definição direta.
- MEDIUM: relação entre conceitos ou processo técnico.
- HARD: crie um cenário prático com contexto técnico realista e alternativas plausíveis.
${avoidSection}
Retorne SOMENTE um JSON válido nesta estrutura (sem texto extra, sem markdown):
{
  "prompt": "Enunciado claro e objetivo",
  "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
  "correct_option_index": 0,
  "explanation": "Explicação técnica de 2 a 4 frases sobre por que a resposta está correta."
}

Conteúdo do módulo:
${moduleContent.trim()}`;
}

function parseCorrectOptionIndex(raw: unknown): number {
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
        const str = raw.trim().toUpperCase();
        if (str === "0" || str === "A") return 0;
        if (str === "1" || str === "B") return 1;
        if (str === "2" || str === "C") return 2;
        if (str === "3" || str === "D") return 3;
    }
    return -1;
}

export class QuizLlmService {
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

        const MAX_MODULE_CONTENT_CHARS = 15000;
        const safeModuleContent = moduleContent.trim().slice(0, MAX_MODULE_CONTENT_CHARS);

        const prompt = buildQuizPrompt(difficulty, safeModuleContent, previousPrompts);

        logger.info("generate", "Gerando questão adaptativa", {
            difficulty,
            previousPromptsCount: previousPrompts.length,
        });

        const MAX_RETRIES = 3;
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

                const optionsAsObjects = validated.options.map((text, index) => ({
                    text,
                    isCorrect: index === validated.correct_option_index
                }));

                for (let i = optionsAsObjects.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [optionsAsObjects[i], optionsAsObjects[j]] = [optionsAsObjects[j], optionsAsObjects[i]];
                }

                const newCorrectIndex = optionsAsObjects.findIndex(opt => opt.isCorrect);
                const shuffledTexts = optionsAsObjects.map(opt => opt.text);

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