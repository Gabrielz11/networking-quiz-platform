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

export class ModuleContentRagService {
    constructor(private moduleRepo: ModuleRepository) {}

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

        const contextText = contextChunks
            .map((c) => {
                const sectionLabel = c.sectionTitle
                    ? ` | Seção: ${c.sectionTitle.replace(/^#{1,4}\s*/, "")}`
                    : "";
                const header = `[Fonte: ${c.fileName}${sectionLabel} | Relevância: ${(c.score * 100).toFixed(0)}%]`;
                return `${header}\n${c.content}`;
            })
            .join("\n\n---\n\n");

        const prompt = RAG_CONTENT_PROMPT
            .replace("{{MODULE_TITLE}}", moduleRecord.title)
            .replace("{{MODULE_DESCRIPTION}}", moduleRecord.description ?? "Não fornecida")
            .replace("{{CONTEXT_TEXT}}", contextText);

        const resultText = await LlmRouter.generateText(prompt, {
            pipeline: "CONTENT_GEN",
            modelName: env.GEMINI_MODEL,
            temperature: 0.6,
            timeoutMs: CONTENT_TIMEOUT_MS,
            thinkingBudget: 0,
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
