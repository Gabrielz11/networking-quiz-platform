import { AiService, CONTENT_TIMEOUT_MS } from "@/services/ai.service";
import { Logger } from "@/lib/logger";

const logger = new Logger("ContentLlmService");

export interface GeneratedModuleContent {
    content: string;
    description: string;
}

export class ContentLlmService {
    /**
     * Gera conteúdo de módulo (markdown + descrição) via IA.
     * Prioridade do contexto: studyMaterial > title + description.
     */
    static async generate(
        title: string,
        description: string,
        studyMaterial?: string
    ): Promise<GeneratedModuleContent> {
        const hasStudyMaterial = studyMaterial && studyMaterial.trim().length > 0;

        const contextBlock = hasStudyMaterial
            ? `O professor forneceu o seguinte material de base para o módulo:\n\n---\n${studyMaterial.trim()}\n---\n\nUse esse material como fonte principal para estruturar, expandir e enriquecer o conteúdo. Preserve a coerência com o que foi escrito pelo professor.`
            : `Use o título "${title}" e a descrição "${description || "não fornecida"}" como base principal para criar o conteúdo do módulo.`;

        const prompt = `
            Você é um especialista em Redes de Computadores, com atuação avançada em IPv6, arquitetura de redes, protocolos da Internet e transição IPv4/IPv6.
            Sua tarefa é criar um material de estudo completo, didático, tecnicamente rigoroso e bem estruturado sobre o tema: "${title}".

            ${contextBlock}

            REGRAS DE CONTEÚDO:
            - O material deve ter entre 3500 e 6000 caracteres para ser considerado completo.
            - PROFUNDIDADE: Não se limite ao básico. Explore detalhes técnicos, arquitetura, nuances e "porquês".
            - ANALÍTICO: Discuta vantagens, desvantagens e trade-offs.
            - PRÁTICO: Cada conceito deve vir acompanhado de um exemplo de uso real ou cenário de mercado.
            - DIDÁTICA: Use analogias para conceitos complexos, mas mantenha o rigor técnico.
            - Evite ser genérico. Se o tema for IPv6, explique aspectos como estrutura do cabeçalho, endereçamento, tipos de endereço, autoconfiguração, Neighbor Discovery, segurança, roteamento e mecanismos de transição.
            - Considere boas práticas acadêmicas e linguagem apropriada para alunos de tecnologia.

            REGRAS DE FORMATAÇÃO MARKDOWN:
            - Use # para os títulos de cada seção principal.
            - Use listas (-) apenas quando fizer sentido didático.
            - Use tabelas Markdown (| col | col |) obrigatoriamente na seção de Comparação.
            - Use blocos de código (\`\`\`) para exemplos técnicos, configurações, comandos ou estruturas de endereços.
            - Cada parágrafo deve ser denso mas fluido (4 a 6 frases).

            ESTRUTURA OBRIGATÓRIA (Explore cada seção exaustivamente):
            # Introdução
            # Problema, Contexto ou Motivação
            # Conceito Principal ou Solução (Base técnica profunda)
            # Funcionamento, Estrutura ou Componentes
            # Exemplos Práticos (Cenários Reais)
            # Principais Características
            # Aplicações Reais e Casos de Uso
            # Comparação (Tabela detalhada)
            # Conclusão e Tendências Futuras

            ${!description
                ? `Gere também uma descrição curta para o módulo com no máximo 150 caracteres.`
                : `Refine a descrição atual se necessário, mantendo no máximo 150 caracteres. Descrição atual: "${description}".`
            }

            Retorne estritamente no formato JSON, sem qualquer texto antes ou depois:
            {
                "content": "conteúdo completo em markdown aqui",
                "description": "resumo curto do módulo com no máximo 150 caracteres"
            }
        `;

        logger.info("generate", "Gerando conteúdo de módulo", { title, hasStudyMaterial });

        const data = await AiService.generateJson<GeneratedModuleContent>(prompt, {
            timeoutMs: CONTENT_TIMEOUT_MS,
        });

        // Validação da estrutura
        if (
            typeof data !== "object" ||
            data === null ||
            typeof data.content !== "string" ||
            data.content.trim() === "" ||
            typeof data.description !== "string"
        ) {
            logger.error("generate", "Validação falhou na resposta da IA", { keys: Object.keys(data) });
            throw new Error("Formato de resposta inválido da IA.");
        }

        logger.info("generate", "Conteúdo de módulo gerado com sucesso", { title, hasStudyMaterial });
        return data;
    }
}
