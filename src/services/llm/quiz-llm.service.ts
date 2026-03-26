import { AiService } from "@/services/ai.service";
import { Logger } from "@/lib/logger";

const logger = new Logger("QuizLlmService");

export interface GeneratedQuestion {
    prompt: string;
    options: string[];
    correct_option_index: number;
    explanation: string;
}

export class QuizLlmService {
    /**
     * Gera UMA questão adaptativa de quiz baseada no conteúdo do módulo.
     */
    static async generate(
        difficulty: string,
        moduleContent: string,
        previousPrompts: string
    ): Promise<GeneratedQuestion> {
        const previousRules = previousPrompts.length > 0
            ? `Você DEVE evitar repetições. As seguintes questões já foram feitas NESTA SESSÃO e não devem ser repetidas nem abordadas de forma similar:\n- ${previousPrompts}\n`
            : "";

        const prompt = `Você é um Tutor Acadêmico de Elite em Redes de Computadores especialista em IPv6.
            Sua missão é gerar EXATAMENTE UMA questão de múltipla escolha baseada EXCLUSIVAMENTE no conteúdo fornecido abaixo.

            O nível de dificuldade alvo para esta questão é: ${difficulty}.
            - EASY: Conceitos básicos, definições diretas e fatos explícitos.
            - MEDIUM: Análise técnica, relação entre conceitos ou processos descritos.
            - HARD: Cenários complexos, exceções técnicas ou detalhes profundos que exigem alta dedução baseada no texto.

            MISSÃO PEDAGÓGICA (CAMPO 'explanation'):
            1. A 'explanation' deve ser um ensinamento curto mas denso (2 a 4 frases).
            2. Não use frases genéricas como "Resposta correta" ou "Bom trabalho".
            3. FOQUE no PORQUÊ técnico do fato, reforçando o conceito para que o aluno aprenda mesmo que tenha errado.
            4. Use uma linguagem acadêmica, profissional e clara.

            ${previousRules}

            Retorne EXATAMENTE UM JSON com a seguinte estrutura:
            {
            "prompt": "Enunciado da questão técnico e claro",
            "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
            "correct_option_index": 0,
            "explanation": "Texto do Tutor IA ensinando o conceito técnico relacionado à questão."
            }

Conteúdo Módulo:
${moduleContent}`;

        logger.info("generate", "Gerando questão adaptativa", { difficulty });

        const qData = await AiService.generateJson<GeneratedQuestion>(prompt, { temperature: 0.6 });

        // Validação forte da estrutura
        if (
            typeof qData !== "object" ||
            qData === null ||
            typeof qData.prompt !== "string" ||
            qData.prompt.trim() === "" ||
            !Array.isArray(qData.options) ||
            qData.options.length !== 4 ||
            !qData.options.every((opt: unknown) => typeof opt === "string" && (opt as string).trim() !== "") ||
            typeof qData.correct_option_index !== "number" ||
            !Number.isInteger(qData.correct_option_index) ||
            qData.correct_option_index < 0 ||
            qData.correct_option_index >= qData.options.length ||
            typeof qData.explanation !== "string" ||
            qData.explanation.trim() === ""
        ) {
            logger.error("generate", "Validação falhou na resposta da IA", { keys: Object.keys(qData) });
            throw new Error("Formato de resposta inválido da IA.");
        }

        logger.info("generate", "Questão gerada com sucesso", { difficulty });
        return qData;
    }
}
