import { AiService } from "@/services/ai.service";
import { Logger } from "@/lib/logger";

const logger = new Logger("ExplainService");

const EXPLAIN_SYSTEM_PROMPT = `Você é um professor universitário especializado em Redes de Computadores 
com foco em IPv6. Um aluno respondeu incorretamente a uma questão de redes, e sua tarefa é explicar 
o erro de forma clara, encorajadora e pedagógica, ajudando o aluno a compreender o conceito correto. 
Comece reconhecendo o esforço do aluno com um tom motivador, depois explique de forma objetiva por que 
a resposta está incorreta, apontando qual conceito foi confundido; em seguida apresente o conceito correto 
de maneira simples e didática, utilizando exemplos quando possível; relacione esse conceito com situações 
reais de redes IPv6 ou infraestrutura de rede para reforçar a compreensão prática; e finalize com um breve
resumo que consolide o aprendizado, sempre usando linguagem acessível, evitando tom punitivo e incentivando 
o aluno a continuar aprendendo.`;

function buildExplainPrompt(
    prompt: string,
    baseExplanation: string,
    studentAnswer: string,
    correctAnswer: string,
): string {
    return `Questão: ${prompt}
Resposta correta: ${correctAnswer}
Resposta do aluno: ${studentAnswer}

[ESTRUTURA BASE PARA A EXPLICAÇÃO - USE ISTO COMO GUIA]
${baseExplanation}

Explique o erro do aluno baseando-se na estrutura acima. Seja claro, direto e limite-se a 1-3 parágrafos pequenos.`;
}

export class ExplainService {
    /**
     * Gera uma explicação pedagógica personalizada (resposta completa, sem streaming).
     * Mantido para compatibilidade e uso futuro.
     */
    static async generateExplanation(
        prompt: string,
        baseExplanation: string,
        studentAnswer: string,
        correctAnswer: string,
        moduleId?: string,
        sessionId?: string
    ): Promise<string> {
        const promptText = buildExplainPrompt(prompt, baseExplanation, studentAnswer, correctAnswer);

        logger.info("generateExplanation", "Gerando explicação pedagógica");

        return AiService.generateText(promptText, {
            systemInstruction: EXPLAIN_SYSTEM_PROMPT,
            temperature: 0.7,
            pipeline: "EXPLANATION",
            moduleId,
            sessionId
        });
    }

    /**
     * Gera uma explicação pedagógica em modo streaming (ReadableStream de texto puro).
     * Usado pela route /api/explain para SSE em tempo real.
     */
    static async generateExplanationStream(
        prompt: string,
        baseExplanation: string,
        studentAnswer: string,
        correctAnswer: string,
        moduleId?: string,
        sessionId?: string
    ): Promise<ReadableStream<Uint8Array>> {
        const promptText = buildExplainPrompt(prompt, baseExplanation, studentAnswer, correctAnswer);

        logger.info("generateExplanationStream", "Gerando explicação em streaming");

        return AiService.generateTextStream(promptText, {
            systemInstruction: EXPLAIN_SYSTEM_PROMPT,
            temperature: 0.7,
            pipeline: "EXPLANATION",
            moduleId,
            sessionId
        });
    }
}
