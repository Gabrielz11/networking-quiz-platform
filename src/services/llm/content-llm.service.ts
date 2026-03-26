import { AiService } from "@/services/ai.service";
import { Logger } from "@/lib/logger";

const logger = new Logger("ContentLlmService");

export interface GeneratedModuleContent {
    content: string;
    description: string;
    imageUrl: string;
}

export class ContentLlmService {
    /**
     * Gera conteúdo de módulo (markdown + descrição + imageUrl) via IA.
     */
    static async generate(
        title: string,
        description: string
    ): Promise<GeneratedModuleContent> {
        const prompt = `
        Você é um especialista em educação tecnológica. 
        Crie o conteúdo de um módulo de estudo para uma plataforma LMS sobre o tema: "${title}".
        A descrição base é: "${description}".

        REGRAS DE FORMATAÇÃO (MUITO IMPORTANTE):
        1. O conteúdo deve ser em Markdown estruturado, mas visando uma renderização HTML acadêmica.
        2. Use subtítulos (##) para organizar os tópicos.
        3. Use parágrafos claros e explicativos.
        4. Use listas (bullets) para destacar pontos importantes.
        5. Use negrito para termos técnicos.
        6. O tom deve ser profissional, didático e encorajador.
        7. NÃO use HTML puro, use Markdown padrão que será convertido pelo frontend.
        8. NÃO inclua o título principal (h1) no corpo, foque nos tópicos.
        9. Se o tema for técnico, inclua exemplos práticos.

        Também sugira uma descrição curta (máximo 150 caracteres) se a descrição atual for vazia.

        Retorne no formato JSON:
        {
            "content": "Conteúdo em markdown aqui...",
            "description": "Breve resumo...",
            "imageUrl": "URL de uma foto técnica relevante (use o formato https://images.unsplash.com/photo-[ID]?q=80&w=1600&auto=format&fit=crop para fotos de tecnologia/servidores/globos digitais)"
        }
        `;

        logger.info("generate", "Gerando conteúdo de módulo", { title });

        const data = await AiService.generateJson<GeneratedModuleContent>(prompt);

        // Validação da estrutura
        if (
            typeof data !== "object" ||
            data === null ||
            typeof data.content !== "string" ||
            data.content.trim() === "" ||
            typeof data.description !== "string" ||
            typeof data.imageUrl !== "string"
        ) {
            logger.error("generate", "Validação falhou na resposta da IA", { keys: Object.keys(data) });
            throw new Error("Formato de resposta inválido da IA.");
        }

        logger.info("generate", "Conteúdo de módulo gerado com sucesso", { title });
        return data;
    }
}
