// src/lib/rag/services/generation.service.ts

import { ModuleRepository, moduleRepository as defaultModuleRepo } from "@/repositories/module.repository";
import { getVectorStore } from "../core/vector-store";
import { LlmRouter } from "@/services/ai/llm-router";
import { CONTENT_TIMEOUT_MS } from "@/services/ai/types";
import { Logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { RAG_CONTENT_PROMPT } from "@/lib/prompts/rag-content.prompt";

const logger = new Logger("ModuleContentGenerationService");

export class GenerationService {
    constructor(private moduleRepo: ModuleRepository) {}

    async generateModuleContentWithRag(input: {
        moduleId: string;
    }) {
        const { moduleId } = input;
        const vectorStore = getVectorStore();

        logger.info("generate", "Iniciando geração RAG", { moduleId });

        // 1. Recuperar metadados do módulo para enriquecer a query e o prompt
        const module = await this.moduleRepo.findById(moduleId);
        if (!module) {
            throw new Error("Módulo não encontrado.");
        }

        const searchQuery = `${module.title} ${module.description ?? ""}`.trim() || "conceitos principais e detalhes técnicos";

        // 2. Recuperar contexto do vetor
        const contextChunks = await vectorStore.searchSimilar({
            moduleId,
            query: searchQuery,
            limit: Number(process.env.RAG_FINAL_CONTEXT_LIMIT || 5),
        });

        if (contextChunks.length === 0) {
            throw new Error("Não há material processado para este módulo.");
        }

        const contextText = contextChunks
            .map((c) => {
                // Injeta metadados de origem para orientar a IA sobre a proveniência do contexto
                const sectionLabel = c.sectionTitle
                    ? ` | Seção: ${c.sectionTitle.replace(/^#{1,4}\s*/, "")}`
                    : "";
                const header = `[Fonte: ${c.fileName}${sectionLabel} | Relevância: ${(c.score * 100).toFixed(0)}%]`;
                return `${header}\n${c.content}`;
            })
            .join("\n\n---\n\n");

        // 3. Preparar prompt com proteção contra injeção e substituição dos metadados do módulo
        const prompt = RAG_CONTENT_PROMPT
            .replace("{{MODULE_TITLE}}", module.title)
            .replace("{{MODULE_DESCRIPTION}}", module.description ?? "Não fornecida")
            .replace("{{CONTEXT_TEXT}}", contextText);
        // 4. Chamar IA via LlmRouter (Usando TEXTO puro para evitar quebras de JSON)
        const resultText = await LlmRouter.generateText(
            prompt,
            {
                pipeline: "CONTENT_GEN",
                modelName: env.GEMINI_MODEL,
                temperature: 0.6,
                timeoutMs: CONTENT_TIMEOUT_MS,
                moduleId,
            }
        );

        // Extração resiliente da descrição e conteúdo via Regex
        let content = resultText;
        let description = "Resumo detalhado gerado pelo assistente pedagógico.";

        const descMatch = resultText.match(/<description>([\s\S]*?)<\/description>/i);
        if (descMatch) {
            description = descMatch[1].trim();
            // Remove a tag description do conteúdo final
            content = resultText.replace(descMatch[0], "").trim();
        }

        if (!content) {
            logger.error("generate", "IA retornou vazio", { resultText });
            throw new Error("A IA gerou a resposta, mas o conteúdo veio vazio. Tente novamente.");
        }

        // 4. Salvar via Repositório injetado
        const updatedModule = await this.moduleRepo.update(moduleId, {
            content,
            description,
        });

        logger.info("generate", "Conteúdo gerado e salvo", { moduleId });

        return {
            module: updatedModule,
            usedChunks: contextChunks,
        };
    }
}

export const generationService = new GenerationService(defaultModuleRepo);
