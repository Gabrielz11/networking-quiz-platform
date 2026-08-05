// src/services/generation/module-content-rag.service.ts
//
// Geração de conteúdo de módulo com RAG (caminho canônico).
// Pré-requisito: o módulo deve ter arquivos de fonte processados (pipeline de ingestão).
//
// Quando usar este serviço:
//   - O módulo já existe no banco
//   - Há arquivos de estudo processados e armazenados no vector store
//   - A geração deve refletir o material fornecido pelo professor
//
// Diferença de module-content-preview.service.ts:
//   - Esse serviço salva o conteúdo gerado no banco de dados
//   - Usa similaridade vetorial (pgvector) para injetar contexto relevante no prompt

import { ModuleRepository, moduleRepository as defaultModuleRepo } from "@/repositories/module.repository";
import { getVectorStore } from "@/lib/rag/core/vector-store";
import { LlmRouter } from "@/services/ai/llm-router";
import { CONTENT_TIMEOUT_MS } from "@/services/ai/types";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { RAG_CONTENT_PROMPT } from "@/lib/prompts/rag-content.prompt";

const logger = new Logger("ModuleContentRagService");

/**
 * Limite máximo de caracteres por chunk de contexto injetado no prompt.
 *
 * O hierarchical retrieval retorna o chunk PARENT, que pode conter o documento
 * inteiro (~14.000 chars / ~12.000 tokens para um PDF típico). Sem truncagem,
 * qualquer provider com janela menor (ex: Groq free tier ≤ 12.000 TPM) falha.
 *
 * Com 3.000 chars/chunk × até 3 chunks = ~9.000 chars ≈ ~2.250 tokens de contexto.
 * Somando o template (~750 tokens), o prompt total fica em ~3.000 tokens —
 * dentro dos limites de todos os providers (Groq free: 6.000–12.000 TPM).
 */
const MAX_CONTEXT_CHARS_PER_CHUNK = 2_000;


export class ModuleContentRagService {
    constructor(private moduleRepo: ModuleRepository) { }

    async generateModuleContentWithRag(input: { moduleId: string }) {
        const { moduleId } = input;
        const vectorStore = getVectorStore();

        logger.info("generate", "Iniciando geração RAG", { moduleId });

        const moduleRecord = await this.moduleRepo.findById(moduleId);
        if (!moduleRecord) {
            throw new Error("Módulo não encontrado.");
        }

        const searchQuery = `${moduleRecord.title} ${moduleRecord.description ?? ""}`.trim() || "conceitos principais e detalhes técnicos";

        const contextChunks = await vectorStore.searchSimilar({
            moduleId,
            query: searchQuery,
            limit: env.RAG_FINAL_CONTEXT_LIMIT,
        });

        if (contextChunks.length === 0) {
            throw new Error("Não há material processado para este módulo.");
        }

        logger.info("generate", "Chunks recuperados do vector store", {
            moduleId,
            totalChunks: contextChunks.length,
            chunks: contextChunks.map((c, i) => ({
                index: i + 1,
                fileName: c.fileName,
                section: c.sectionTitle ?? "—",
                score: `${(c.score * 100).toFixed(1)}%`,
                chars: c.content.length,
            })),
        });

        const contextText = contextChunks
            .map((c) => {
                const sectionLabel = c.sectionTitle
                    ? ` | Seção: ${c.sectionTitle.replace(/^#{1,4}\s*/, "")}`
                    : "";
                const header = `[Fonte: ${c.fileName}${sectionLabel} | Relevância: ${(c.score * 100).toFixed(0)}%]`;
                // Trunca o conteúdo do chunk para evitar prompts que excedam os
                // limites de tokens dos providers (especialmente Groq no free tier).
                const content = c.content.length > MAX_CONTEXT_CHARS_PER_CHUNK
                    ? c.content.slice(0, MAX_CONTEXT_CHARS_PER_CHUNK) + "\n[...conteúdo truncado para caber nos limites do provider...]"
                    : c.content;
                return `${header}\n${content}`;
            })
            .join("\n\n---\n\n");

        const truncatedCount = contextChunks.filter(c => c.content.length > MAX_CONTEXT_CHARS_PER_CHUNK).length;
        logger.info("generate", "Contexto RAG montado para o prompt", {
            moduleId,
            contextChars: contextText.length,
            chunksUsados: contextChunks.length,
            chunksTruncados: truncatedCount,
        });

        const prompt = RAG_CONTENT_PROMPT
            .replace("{{MODULE_TITLE}}", moduleRecord.title)
            .replace("{{MODULE_DESCRIPTION}}", moduleRecord.description ?? "Não fornecida")
            .replace("{{CONTEXT_TEXT}}", contextText);

        const resultText = await LlmRouter.generateText(prompt, {
            pipeline: "CONTENT_GEN",
            modelName: env.CONTENT_GENERATION_MODEL,
            temperature: env.CONTENT_GENERATION_TEMPERATURE,
            timeoutMs: CONTENT_TIMEOUT_MS,
            //thinkingBudget: 0,
            maxTokens: env.CONTENT_GENERATION_MAX_TOKENS,
            moduleId,
        });

        let content = resultText;
        let description = "Resumo detalhado gerado pelo assistente pedagógico.";

        const descMatch = resultText.match(/<description>([\s\S]*?)<\/description>/i);
        if (descMatch) {
            description = descMatch[1].trim();
            content = resultText.replace(descMatch[0], "").trim();
        }

        if (!content) {
            logger.error("generate", "IA retornou vazio", { resultText });
            throw new Error("A IA gerou a resposta, mas o conteúdo veio vazio. Tente novamente.");
        }

        const updatedModule = await this.moduleRepo.update(moduleId, { content, description });

        logger.info("generate", "Conteúdo gerado e salvo", { moduleId });

        return { module: updatedModule, usedChunks: contextChunks };
    }
}

export const moduleContentRagService = new ModuleContentRagService(defaultModuleRepo);
