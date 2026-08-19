import { LlmRouter } from "@/services/ai/llm-router";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { EXPLAIN_SYSTEM_PROMPT, buildExplanationPrompt as buildPrompt } from "./prompts/explanation.prompt";

const logger = new Logger("ExplainService");

function validateExplainInput(
    prompt?: string,
    baseExplanation?: string,
    studentAnswer?: string,
    correctAnswer?: string
): void {
    if (!prompt?.trim()) {
        throw new Error("A questão não pode estar vazia.");
    }

    if (!baseExplanation?.trim()) {
        throw new Error("A explicação-base não pode estar vazia.");
    }

    if (!studentAnswer?.trim()) {
        throw new Error("A resposta do aluno não pode estar vazia.");
    }

    if (!correctAnswer?.trim()) {
        throw new Error("A resposta correta não pode estar vazia.");
    }
}

export class ExplainService {
    /**
     * Gera explicação pedagógica personalizada em streaming.
     * Usado pela rota /api/explain.
     */
    static async generateExplanationStream(
        prompt: string,
        baseExplanation: string,
        studentAnswer: string,
        correctAnswer: string,
        moduleId?: string,
        sessionId?: string,
        questionId?: string
    ): Promise<ReadableStream<Uint8Array>> {
        validateExplainInput(prompt, baseExplanation, studentAnswer, correctAnswer);
        const promptText = buildPrompt(prompt, baseExplanation, studentAnswer, correctAnswer);

        logger.info("generateExplanationStream", "Gerando explicação em streaming");

        const stream = await LlmRouter.generateTextStream(promptText, {
            provider: env.EXPLANATION_PROVIDER,
            modelName: env.EXPLANATION_MODEL,
            systemInstruction: EXPLAIN_SYSTEM_PROMPT,
            temperature: env.EXPLANATION_TEMPERATURE,
            pipeline: "EXPLANATION",
            fallbackEnabled: false,
            maxTokens: env.EXPLANATION_MAX_TOKENS,
            moduleId,
            sessionId,
        });

        if (!questionId) {
            return stream;
        }
        let accumulatedText = "";
        const decoder = new TextDecoder();
        const transformStream = new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                accumulatedText += decoder.decode(chunk, { stream: true });
                controller.enqueue(chunk);
            },
            async flush() {
                accumulatedText += decoder.decode();
                if (accumulatedText.trim()) {
                    try {
                        await prisma.questionInstance.update({
                            where: { id: questionId },
                            data: { explanation: accumulatedText.trim() }
                        });
                        logger.info("generateExplanationStream", "Explicação personalizada salva no banco de dados", { questionId });
                    } catch (dbErr: any) {
                        logger.error("generateExplanationStream", "Erro ao salvar explicação no banco", {
                            questionId,
                            error: dbErr.message
                        });
                    }
                }
            }
        });

        return stream.pipeThrough(transformStream);
    }

    /**
     * Gera explicação pedagógica completa (sem streaming).
     * Mantido para uso futuro. codigo morto
     */
    static async generateExplanation(
        prompt: string,
        baseExplanation: string,
        studentAnswer: string,
        correctAnswer: string,
        moduleId?: string,
        sessionId?: string
    ): Promise<string> {
        validateExplainInput(prompt, baseExplanation, studentAnswer, correctAnswer);
        const promptText = buildPrompt(prompt, baseExplanation, studentAnswer, correctAnswer);

        logger.info("generateExplanation", "Gerando explicação pedagógica");

        return LlmRouter.generateText(promptText, {
            modelName: env.EXPLANATION_MODEL,
            systemInstruction: EXPLAIN_SYSTEM_PROMPT,
            temperature: env.EXPLANATION_TEMPERATURE,
            pipeline: "EXPLANATION",
            fallbackEnabled: false,
            maxTokens: env.EXPLANATION_MAX_TOKENS,
            moduleId,
            sessionId,
        });
    }
}
