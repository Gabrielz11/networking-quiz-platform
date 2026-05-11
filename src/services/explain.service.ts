import { AiService } from "@/services/ai.service";
import { Logger } from "@/lib/logger";
import OpenAI from "openai";

const logger = new Logger("ExplainService");

export class ExplainService {
    /**
     * Gera uma explicação pedagógica personalizada para o erro do aluno.
     * Usa AiService.generateText (Gemini + fallback Groq + timeout).
     */
    static async generateExplanation(
        prompt: string,
        baseExplanation: string,
        studentAnswer: string,
        correctAnswer: string
    ): Promise<string> {
        const systemPrompt = `Você é um professor universitário especializado em Redes de Computadores 
        com foco em IPv6. Um aluno respondeu incorretamente a uma questão de redes, e sua tarefa é explicar 
        o erro de forma clara, encorajadora e pedagógica, ajudando o aluno a compreender o conceito correto. 
        Comece reconhecendo o esforço do aluno com um tom motivador, depois explique de forma objetiva por que 
        a resposta está incorreta, apontando qual conceito foi confundido; em seguida apresente o conceito correto 
        de maneira simples e didática, utilizando exemplos quando possível; relacione esse conceito com situações 
        reais de redes IPv6 ou infraestrutura de rede para reforçar a compreensão prática; e finalize com um breve
        resumo que consolide o aprendizado, sempre usando linguagem acessível, evitando tom punitivo e incentivando 
        o aluno a continuar aprendendo.`;

        const promptText = `Questão: ${prompt}
        Resposta correta: ${correctAnswer}
        Resposta do aluno: ${studentAnswer}

        [ESTRUTURA BASE PARA A EXPLICAÇÃO - USE ISTO COMO GUIA]
        ${baseExplanation}

        Explique o erro do aluno baseando-se na estrutura acima. Seja claro, direto e limite-se a 1-3 parágrafos pequenos.`;

        logger.info("generateExplanation", "Gerando explicação pedagógica");

        return AiService.generateText(promptText, {
            systemInstruction: systemPrompt,
            temperature: 0.7
        });
    }

    /**
     * Gera uma imagem de diagrama educacional usando DALL-E 3.
     * Retorna null se a API key não estiver configurada ou se houver falha.
     */
    static async generateDiagramImage(correctAnswer: string): Promise<string | null> {
        if (!process.env.OPENAI_API_KEY) {
            logger.warn("generateDiagramImage", "OpenAI API Key not found. Skipping image generation.");
            return null;
        }

        try {
            const openai = new OpenAI({
                apiKey: (process.env.OPENAI_API_KEY || "").trim(),
            });

            const imagePrompt = `Educational computer networking diagram explaining the concept: ${correctAnswer}.

            Requirements:
            - clear technical diagram
            - show network devices and connections
            - labels for protocols (IPv6, TCP if relevant)
            - flat design style
            - minimal icons
            - white background
            - readable labels
            - educational style used in textbooks
            - simple topology diagram`;

            logger.info("generateDiagramImage", "Gerando imagem via DALL-E 3");

            const imageResponse = await openai.images.generate({
                model: "dall-e-3",
                prompt: imagePrompt,
                n: 1,
                size: "1024x1024",
                quality: "standard",
            });

            return imageResponse.data?.[0]?.url || null;
        } catch (imageError: any) {
            logger.error("generateDiagramImage", `DALL-E error (non-critical): ${imageError.message || imageError}`);
            if (imageError.status === 401) {
                logger.warn("generateDiagramImage", "TIP: Verify your OPENAI_API_KEY in .env.local.");
            }
            return null;
        }
    }
}
