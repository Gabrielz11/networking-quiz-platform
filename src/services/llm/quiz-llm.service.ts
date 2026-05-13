import { AiService } from "@/services/ai.service";
import { Logger } from "@/lib/logger";
import { z } from "zod";

const logger = new Logger("QuizLlmService");

type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

/**
 * Esquema robusto para validação da questão gerada pela IA.
 */
const QuestionSchema = z.object({
    prompt: z
        .string()
        .trim()
        .min(10, "O enunciado deve ter pelo menos 10 caracteres.")
        .max(300, "O enunciado não pode ultrapassar 300 caracteres."),
    options: z
        .array(
            z
                .string()
                .trim()
                .min(1, "A opção não pode estar vazia.")
                .max(200, "A opção não pode ultrapassar 200 caracteres.")
        )
        .length(4, "Devem ser exatamente 4 opções.")
        .refine((opts) => {
            const normalized = opts.map((opt) => opt.trim().toLowerCase());
            return new Set(normalized).size === normalized.length;
        }, {
            message: "As opções devem ser únicas (não pode haver duplicatas)."
        }),
    correct_option_index: z.number().int().min(0).max(3),
    explanation: z
        .string()
        .trim()
        .min(15, "A explicação deve ser densa (mínimo 15 caracteres).")
        .max(800, "A explicação não pode ultrapassar 800 caracteres.")
}).strict();

export type GeneratedQuestion = z.infer<typeof QuestionSchema>;

/**
 * Valida a resposta da IA contra o esquema Zod e loga erros detalhados.
 */
function validateAIQuestionResponse(qData: unknown): GeneratedQuestion {
    const result = QuestionSchema.safeParse(qData);

    if (!result.success) {
        logger.error("generate", "Validação falhou na resposta da IA", {
            receivedType: typeof qData,
            issues: result.error.issues,
            receivedValue: qData,
        });

        throw new Error("Formato de resposta inválido da IA.");
    }

    return result.data;
}

export class QuizLlmService {
    /**
     * Gera uma questão adaptativa de quiz baseada no conteúdo do módulo.
     */
    static async generate(
        difficulty: QuestionDifficulty,
        moduleContent: string,
        previousPrompts: string[]
    ): Promise<GeneratedQuestion> {
        const sanitizedModuleContent = moduleContent.trim();

        if (!sanitizedModuleContent) {
            throw new Error("O conteúdo do módulo não pode estar vazio.");
        }

        const previousRules = previousPrompts.length > 0
            ? `Você DEVE evitar repetições. As seguintes questões já foram feitas NESTA SESSÃO e não devem ser repetidas nem abordadas de forma similar:\n- ${previousPrompts.join("\n- ")}\n`
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

IMPORTANTE:
- Não adicione markdown
- Não adicione crases
- Não adicione comentários
- Não adicione texto antes ou depois do JSON
- As 4 opções devem ser distintas entre si
- Apenas uma opção deve estar correta

Conteúdo Módulo:
${sanitizedModuleContent}`;

        logger.info("generate", "Gerando questão adaptativa", {
            difficulty,
            previousPromptsCount: previousPrompts.length,
        });

        try {
            const qData = await AiService.generateJson<GeneratedQuestion>(prompt, { 
                temperature: 0.6,
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
            const validatedData = validateAIQuestionResponse(qData);

            // Shuffling logic to ensure randomization
            const originalOptions = [...validatedData.options];
            const correctOptionText = originalOptions[validatedData.correct_option_index];
            
            // Fisher-Yates shuffle
            const shuffledOptions = [...originalOptions];
            for (let i = shuffledOptions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
            }

            const newCorrectIndex = shuffledOptions.indexOf(correctOptionText);

            logger.info("generate", "Questão gerada e embaralhada com sucesso", {
                difficulty,
                promptLength: validatedData.prompt.length,
                originalIndex: validatedData.correct_option_index,
                newIndex: newCorrectIndex
            });

            return {
                ...validatedData,
                options: shuffledOptions,
                correct_option_index: newCorrectIndex
            };
        } catch (error: unknown) {

            if (error instanceof Error) {
                logger.error("generate", "Erro ao gerar questão adaptativa", {
                    difficulty,
                    message: error.message,
                    stack: error.stack,
                });
            } else {
                logger.error("generate", "Erro desconhecido na geração", {
                    difficulty,
                    error,
                });
            }

            throw error;
        }
    }
}