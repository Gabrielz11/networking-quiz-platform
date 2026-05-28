import { LlmRouter } from "@/services/ai/llm-router";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const logger = new Logger("ExplainService");

const EXPLAIN_SYSTEM_PROMPT = `Você é um professor universitário especializado em Redes de Computadores com foco em IPv6.
Um aluno respondeu incorretamente a uma questão. Explique o erro de forma clara, pedagógica e encorajadora.
Estruture a explicação em até 3 parágrafos curtos:
1. Reconheça o esforço do aluno e indique onde ele errou.
2. Explique o conceito correto de forma didática, usando exemplo prático quando possível.
3. Consolide o aprendizado com uma frase motivadora.
Use linguagem acessível. Não use asteriscos, travessões ou markdown.`;

function buildPrompt(prompt: string,
    baseExplanation: string,
    studentAnswer: string,
    correctAnswer: string
): string {
    return `Questão: 
${prompt}

Resposta correta: 
${correctAnswer}

Resposta do aluno: 
${studentAnswer}

Explicação-base:
${baseExplanation}

Instruções:
Use a explicação-base como fonte principal.
Não contradiga a explicação-base.
Caso a resposta do aluno esteja parcialmente correta, reconheça a parte correta antes de explicar o erro.
Explique o erro de forma clara, direta e pedagógica.`;
}

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
            modelName: env.REASONING_FALLBACK_MODEL,
            systemInstruction: EXPLAIN_SYSTEM_PROMPT,
            temperature: 0.5,
            pipeline: "EXPLANATION",
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
     * Mantido para uso futuro.
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
            modelName: env.REASONING_FALLBACK_MODEL,
            systemInstruction: EXPLAIN_SYSTEM_PROMPT,
            temperature: 0.6,
            pipeline: "EXPLANATION",
            moduleId,
            sessionId,
        });
    }
}
