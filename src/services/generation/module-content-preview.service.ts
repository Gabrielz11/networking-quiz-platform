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
            ? `O professor forneceu o seguinte material de base para o 
            módulo:\n\n---\n${studyMaterial.trim()}\n---\n\nUse esse material como 
            fonte principal para estruturar, expandir e enriquecer o conteúdo. 
            Preserve a coerência com o que foi escrito pelo professor.`
            : `Use o título "${title}" e a descrição "${description || "não fornecida"}" como base principal para criar o conteúdo do módulo.`;

        const prompt = `
            Você é um especialista em Redes de Computadores, com atuação avançada em IPv6, arquitetura de redes, protocolos da Internet e transição IPv4/IPv6.
            Sua tarefa é criar um material de estudo completo, didático, tecnicamente rigoroso e bem estruturado sobre o tema: "${title}".

            ${contextBlock}

            REGRAS DE ADAPTAÇÃO DO CONTEÚDO: 
            - Antes de escrever, avalie a complexidade do tema e a quantidade de informação fornecida pelo professor.
            - Se o conteúdo fornecido for curto, introdutório ou muito objetivo, gere um material proporcional, claro e direto.
            - Se o conteúdo for médio ou envolver um conceito técnico relevante, aprofunde com funcionamento, exemplos, vantagens, limitações e aplicações reais.
            - Se o conteúdo for amplo, complexo ou parecer um tema de aula completa, gere um material mais completo, técnico e bem estruturado.
            - Se o professor solicitar explicitamente um material completo, apostila, revisão aprofundada ou conteúdo extenso, gere entre 3500 e 6000 caracteres.
            - Nunca aumente artificialmente o texto apenas para preencher tamanho. - Priorize qualidade, clareza, precisão técnica e utilidade para o aluno.

            TAMANHO DO MATERIAL: Use as faixas abaixo como referência, escolhendo automaticamente a melhor opção: 
            - Conteúdo curto ou introdutório: entre 1200 e 2500 caracteres.
            - Conteúdo médio: entre 2500 e 4000 caracteres.
            - Conteúdo completo ou aprofundado: entre 3500 e 6000 caracteres.

            A escolha do tamanho deve considerar:
            - complexidade do tema;
            - quantidade de informações fornecidas pelo professor;
            - necessidade de exemplos práticos;
            - profundidade técnica necessária;
            - utilidade do conteúdo para estudo.

            REGRAS DE CONTEÚDO: 
            - Explique o tema de forma progressiva, começando pelo contexto e avançando para a parte técnica. 
            - Não seja genérico. 
            - Quando o tema exigir, explore detalhes técnicos, arquitetura, funcionamento interno, nuances e os "porquês". 
            - Discuta vantagens, desvantagens e trade-offs quando isso fizer sentido para o tema. 
            - Relacione conceitos importantes com exemplos reais, cenários de mercado ou aplicações práticas. 
            - Use analogias para conceitos complexos, mas mantenha rigor técnico. 
            - Use linguagem acadêmica acessível para alunos de tecnologia. 
            - Não invente informações desconectadas do conteúdo fornecido. 
            - Não force profundidade excessiva em temas simples. 
            - Não transforme todo conteúdo curto em uma apostila.

            REGRAS ESPECÍFICAS PARA REDES E IPv6: 
            - Quando o tema for IPv6, considere abordar, conforme a relevância: 
                - estrutura do cabeçalho IPv6; 
                - endereçamento; 
                - tipos de endereço; 
                - autoconfiguração; 
                - Neighbor Discovery Protocol; 
                - roteamento; 
                - segurança; 
                - diferenças em relação ao IPv4; 
                - mecanismos de transição IPv4/IPv6. 
            - Aborde apenas os pontos que fizerem sentido para o tema solicitado. 
            - Não inclua todos esses tópicos automaticamente se o conteúdo do professor for curto ou específico.

            REGRAS DE FORMATAÇÃO MARKDOWN: 
            - Use títulos com # para as seções principais. 
            - Use subtítulos com ## quando precisar organizar melhor a explicação. 
            - Use listas apenas quando fizer sentido didático. 
            - Use tabelas Markdown somente quando houver comparação real entre conceitos, protocolos, tecnologias ou abordagens. 
            - Use blocos de código com \`\`\` para exemplos técnicos, comandos, configurações, endereços IP, estruturas ou pseudocódigo. 
            - Os parágrafos devem ser claros, densos e fluidos, normalmente com 3 a 6 frases. 
            - Evite blocos de texto muito longos. 
            - Não use formatação excessiva.

            ESTRUTURA ADAPTATIVA: 
            Escolha a estrutura conforme a complexidade do conteúdo. 
            
            Para conteúdos curtos ou introdutórios, use preferencialmente:
            # Introdução # Conceito Principal # Exemplo Prático # Conclusão

            Para conteúdos médios, use preferencialmente: 
            # Introdução # Contexto ou Motivação # Conceito Principal # Funcionamento # Exemplos Práticos # Aplicações Reais # Conclusão

            Para conteúdos completos, técnicos ou amplos, use preferencialmente: 
            # Introdução # Problema, Contexto ou Motivação # Conceito Principal ou Solução # Funcionamento, Estrutura ou Componentes # Exemplos Práticos # Principais Características # Aplicações Reais e Casos de Uso # Comparação # Conclusão e Tendências Futuras

            SEÇÃO DE COMPARAÇÃO: 
            - Inclua a seção "Comparação" somente quando houver algo relevante para comparar. 
            - Exemplos: IPv4 vs IPv6, SLAAC vs DHCPv6, TCP vs UDP, roteamento estático vs dinâmico, NAT44 vs NAT64. 
            - Quando usar comparação, utilize obrigatoriamente uma tabela Markdown. 
            - Se não houver comparação natural no tema, não crie a seção. 
            
            Formato sugerido para tabela: 
            | Critério | Opção A | Opção B | 
            |---|---|---| 
            | Funcionamento | Explicação | Explicação | 
            | Vantagens | Explicação | Explicação | 
            | Limitações | Explicação | Explicação | 
            | Uso prático | Explicação | Explicação |

            EXEMPLOS PRÁTICOS: 
            - Sempre que possível, inclua pelo menos um exemplo prático. 
            - O exemplo pode ser um cenário de empresa, ambiente de rede, backend, cloud, segurança, infraestrutura ou sala de aula. 
            - Use comandos, configurações ou estruturas técnicas somente quando fizer sentido. 
            - O exemplo deve ajudar o aluno a entender como o conceito aparece no mundo real.

            ${!description
                ? `Gere também uma descrição curta para o módulo com no máximo 150 caracteres.`
                : `Refine a descrição atual se necessário, mantendo no máximo 150 caracteres. Descrição atual: "${description}".`
            }

            FORMATO DE RESPOSTA: 
            - Retorne estritamente no formato JSON válido, sem qualquer texto antes ou depois.
            - A resposta deve seguir exatamente esta estrutura:
            {
                "content": "conteúdo completo em markdown aqui",
                "description": "resumo curto do módulo com no máximo 150 caracteres"
            }
            CUIDADOS COM O JSON: 
            - Escape corretamente quebras de linha dentro do campo "content". 
            - Não retorne Markdown fora do JSON. 
            - Não inclua comentários. 
            - Não inclua texto antes ou depois do objeto JSON. 
            - Garanta que o JSON seja válido para JSON.parse().
        `;

        logger.info("generate", "Gerando prévia de conteúdo de módulo", { title, hasStudyMaterial });

        const data = await LlmRouter.generateJson<GeneratedModuleContent>(prompt, {
            pipeline: "CONTENT_GEN",
            modelName: env.CONTENT_GENERATION_MODEL,
            temperature: 0.5,
            timeoutMs: 120_000,
            fallbackEnabled: false,
            maxTokens: 4096,
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
