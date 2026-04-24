// src/lib/rag/module-content-generation-service.ts
// Reutiliza o AiService já existente no projeto.

import { prisma } from "@/lib/prisma";
import { getVectorStore } from "./vector-store";
import { AiService, CONTENT_TIMEOUT_MS } from "@/services/ai.service";
import { Logger } from "@/lib/logger";

const logger = new Logger("ModuleContentGenerationService");

export async function generateModuleContentWithRag(input: { moduleId: string }) {
    const module = await prisma.module.findUnique({
        where: { id: input.moduleId },
    });

    if (!module) {
        throw new Error("Módulo não encontrado.");
    }

    const vectorStore = getVectorStore();

    const retrievedChunks = await vectorStore.searchSimilar({
        moduleId: module.id,
        query: module.title,
        limit: Number(process.env.RAG_RETRIEVAL_LIMIT ?? 6),
    });

    if (retrievedChunks.length === 0) {
        throw new Error("Nenhum material processado encontrado para este módulo. Processe ao menos um arquivo antes de gerar.");
    }

    const context = retrievedChunks
        .map((chunk, index) => {
            return `Fonte ${index + 1}: ${chunk.fileName}\nRelevância: ${(chunk.score * 100).toFixed(1)}%\nConteúdo:\n${chunk.content}`;
        })
        .join("\n\n---\n\n");

    logger.info("generateModuleContentWithRag", "Montando prompt com contexto RAG", {
        moduleId: module.id,
        chunksUsed: retrievedChunks.length,
    });

    const prompt = buildRagContentPrompt({
        moduleTitle: module.title,
        moduleDescription: module.description ?? "",
        retrievedContext: context,
    });

    // Reutiliza o AiService centralizado (Gemini + fallback Groq)
    const generatedData = await AiService.generateJson<{ content: string; description: string }>(
        prompt,
        { timeoutMs: CONTENT_TIMEOUT_MS }
    );

    const updatedModule = await prisma.module.update({
        where: { id: module.id },
        data: {
            content: generatedData.content,
            ...(generatedData.description && !module.description
                ? { description: generatedData.description }
                : {}),
        },
    });

    logger.info("generateModuleContentWithRag", "Conteúdo gerado e salvo com sucesso", {
        moduleId: module.id,
    });

    return {
        module: updatedModule,
        usedChunks: retrievedChunks,
    };
}

function buildRagContentPrompt(input: {
    moduleTitle: string;
    moduleDescription?: string;
    retrievedContext: string;
}) {
    return `
Você é um professor Doutor especialista em Redes de Computadores com foco em IPv6.

Sua tarefa é criar um material didático completo, profundo e tecnicamente rigoroso para alunos universitários de Redes.

Título do módulo: ${input.moduleTitle}
Descrição do módulo: ${input.moduleDescription ?? "Não fornecida."}

Use PRIORITARIAMENTE o contexto abaixo, extraído dos materiais enviados pelo professor:

${input.retrievedContext}

REGRAS OBRIGATÓRIAS:
1. Use o contexto acima como fonte principal. Não invente informações que não estejam nele.
2. Se o contexto for insuficiente para alguma seção, indique claramente "Material insuficiente nesta seção".
3. Explique de forma clara, progressiva e tecnicamente precisa.
4. Inclua exemplos práticos, comandos e estruturas de endereçamento quando relevante.
5. Use analogias quando ajudarem a compreensão, mas mantenha rigor técnico.
6. Não cite páginas ou fontes diretas. Diga "de acordo com o material enviado".
7. Estruture tudo em Markdown rico com tabelas, listas e blocos de código.
8. Cada seção deve ter 3 a 6 parágrafos densos.

ESTRUTURA OBRIGATÓRIA:
# ${input.moduleTitle}
# Introdução
# Problema, Contexto ou Motivação
# Conceito Principal ou Solução (Base técnica profunda)
# Funcionamento, Estrutura ou Componentes
# Exemplos Práticos (Cenários Reais)
# Principais Características
# Aplicações Reais e Casos de Uso
# Comparação (Tabela detalhada)
# Conclusão e Tendências Futuras

Retorne EXCLUSIVAMENTE um JSON válido, sem texto antes ou depois:
{
  "content": "conteúdo completo em markdown aqui",
  "description": "resumo curto do módulo com no máximo 150 caracteres"
}
    `.trim();
}
