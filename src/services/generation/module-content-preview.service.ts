// src/services/generation/module-content-preview.service.ts
//
// Geração rápida de conteúdo de módulo via IA sem RAG.
// Usado para pré-visualização no formulário de criação do módulo (antes de qualquer upload).
//
// Quando usar este serviço:
//   - O módulo ainda não existe no banco (ou não tem arquivos processados)
//   - O professor quer ver uma prévia do conteúdo antes de salvar
//   - O retorno NÃO é salvo no banco — é devolvido ao cliente para revisão
//
// Para geração com material de estudo processado, use module-content-rag.service.ts.

import { LlmRouter } from "@/services/ai/llm-router";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";

const logger = new Logger("ModuleContentPreviewService");

export interface GeneratedModuleContent {
    content: string;
    description: string;
}

export class ModuleContentPreviewService {
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
            ? `
        O professor forneceu o seguinte material de base:

        ---
        ${studyMaterial.trim()}
        ---

        Use esse material como fonte principal para estruturar e explicar o módulo.
        Preserve o escopo, a terminologia e o sentido apresentados pelo professor.
        Não acrescente informações que não estejam sustentadas pelo material.
        `
            : `
        Não foi fornecido material de estudo.

        Use o título "${title}" e a descrição "${description || "não fornecida"}"
        como limite para criar um conteúdo introdutório, claro e proporcional.
        `;

        const groundingRules = hasStudyMaterial
            ? `
        FIDELIDADE AO MATERIAL

        - Use o material fornecido como base factual da resposta.
        - Não invente fatos, números, comandos, referências, protocolos,
        configurações ou exemplos.
        - Quando o material não sustentar um ponto, omita-o.
        - Preserve a terminologia técnica e o sentido das fontes.
        - Não amplie o tema para assuntos adjacentes sem necessidade.
        - Evite afirmações absolutas que não estejam claramente sustentadas.
        `
            : `
        CONTROLE DE ESCOPO

        - Use o título e a descrição como limite principal.
        - Produza uma explicação introdutória e proporcional.
        - Não invente referências, números, comandos ou configurações específicas.
        - Evite detalhes que dependam de fontes não fornecidas.
        - Não apresente informações incertas como fatos.
        `;

        const prompt = `
        Você é um professor e redator técnico responsável por criar materiais
        educacionais claros, didáticos e tecnicamente rigorosos.

        TEMA DO MÓDULO:
        "${title}"

        ${contextBlock}

        OBJETIVO

        Produza um material adequado à complexidade do tema e proporcional à
        quantidade de informação disponível.

        ${groundingRules}

        PROFUNDIDADE

        - Tema curto ou introdutório: explique de forma direta.
        - Tema intermediário: aprofunde os conceitos centrais.
        - Tema amplo ou técnico: organize o conteúdo em seções e detalhe somente
        os pontos sustentados pelo material.

        Faixas de tamanho apenas como referência:

        - curto: 1200 a 2500 caracteres;
        - médio: 2500 a 4000 caracteres;
        - aprofundado: 3500 a 6000 caracteres.

        Não aumente artificialmente o texto.

        ESTRUTURA

        Escolha somente as seções necessárias, como:

        - Introdução
        - Contexto ou motivação
        - Conceitos principais
        - Funcionamento ou arquitetura
        - Componentes ou etapas
        - Exemplos
        - Aplicações
        - Comparação
        - Limitações e boas práticas
        - Conclusão

        Não é obrigatório usar todas.
        Não crie seções sem conteúdo suficiente.

        COMPARAÇÕES E EXEMPLOS

        - Compare apenas quando houver comparação natural e sustentada.
        - Use tabela Markdown somente quando melhorar a compreensão.
        - Inclua exemplos somente quando forem coerentes e sustentados.
        - Não invente comandos, configurações ou cenários para completar o texto.

        FORMATAÇÃO

        - Use Markdown.
        - Use # para seções e ## para subseções.
        - Use listas, tabelas e blocos de código somente quando necessários.
        - Evite repetição, parágrafos excessivamente longos e formatação exagerada.

        DESCRIÇÃO

        ${!description
                ? `Crie uma descrição curta com no máximo 150 caracteres.`
                : `Refine a descrição abaixo apenas se necessário, mantendo no máximo
        150 caracteres:

        "${description}"`
            }

        REVISÃO

        Antes de responder:

        1. Confirme que o conteúdo responde diretamente ao título.
        2. Remova afirmações não sustentadas.
        3. Elimine repetições.
        4. Remova seções artificiais.
        5. Verifique a coerência técnica dos exemplos.

        FORMATO DE RESPOSTA

        Retorne somente um objeto JSON com:

        {
        "content": "conteúdo completo em Markdown",
        "description": "resumo com no máximo 150 caracteres"
        }
        `;

        logger.info("generate", "Gerando prévia de conteúdo de módulo", { title, hasStudyMaterial });

        const data = await LlmRouter.generateJson<GeneratedModuleContent>(prompt, {
            pipeline: "CONTENT_GEN",
            modelName: env.CONTENT_GENERATION_MODEL,
            temperature: env.CONTENT_GENERATION_TEMPERATURE,
            timeoutMs: 120_000,
            fallbackEnabled: false,
            maxTokens: env.CONTENT_GENERATION_MAX_TOKENS,
            responseSchema: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                        description: "Conteúdo completo do módulo em formato Markdown rico"
                    },
                    description: {
                        type: "string",
                        description: "Resumo curto do módulo com no máximo 150 caracteres"
                    }
                },
                required: ["content", "description"]
            }
        });

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

        logger.info("generate", "Prévia de conteúdo gerada com sucesso", { title, hasStudyMaterial });
        return data;
    }
}
