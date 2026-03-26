import { AiService } from "@/services/ai.service";
import { Logger } from "@/lib/logger";

const logger = new Logger("BatchLlmService");

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

export class BatchLlmService {
    /**
     * Gera um lote de questões de múltipla escolha baseado no conteúdo de um módulo.
     */
    static async generate(
        title: string,
        content: string
    ): Promise<GeneratedBatchQuestion[]> {
        const prompt = `Você é um professor acadêmico de Redes de Computadores especialista em IPv6.
    O usuário fornecerá o título e o conteúdo de um módulo de estudo.
    Sua tarefa é criar um quiz contendo de 3 a 10 questões de múltipla escolha baseadas EXCLUSIVAMENTE nesse conteúdo.
    Para cada questão, determine o nível de dificuldade (easy, medium, hard).
    Retorne EXATAMENTE UM JSON com a seguinte estrutura:
    {
    "questions": [
        {
        "prompt": "Enunciado da questão",
        "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
        "correct_option_index": 0,
        "difficulty": "easy",
        "explanation_base": "Explicação objetiva da resposta correta."
        }
    ]
    }

    Título do Módulo: ${title}

    Conteúdo:
    ${content}`;

        logger.info("generate", "Gerando lote de questões", { title });

        const data = await AiService.generateJson<BatchResponse>(prompt);

        // Validação do array
        if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
            logger.error("generate", "Array 'questions' ausente ou vazio");
            throw new Error("Formato de resposta inválido da IA: array 'questions' ausente.");
        }

        // Validação forte de cada item
        const validDifficulties = ["easy", "medium", "hard"];

        data.questions.forEach((q, index) => {
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
