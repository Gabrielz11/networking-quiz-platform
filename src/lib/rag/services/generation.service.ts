// src/lib/rag/services/generation.service.ts

import { ModuleRepository, moduleRepository as defaultModuleRepo } from "@/repositories/module.repository";
import { getVectorStore } from "../core/vector-store";
import { AiService, CONTENT_TIMEOUT_MS } from "@/services/ai.service";
import { Logger } from "@/lib/logger";
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

        // 1. Recuperar contexto do vetor (Top-K)
        const contextChunks = await vectorStore.searchSimilar({
            moduleId,
            query: "conceitos principais e detalhes técnicos do módulo",
            limit: 12, 
        });

        if (contextChunks.length === 0) {
            throw new Error("Não há material processado para este módulo.");
        }

        const contextText = contextChunks
            .map((c) => `[Fonte: ${c.fileName}]\n${c.content}`)
            .join("\n\n---\n\n");

        // 2. Preparar prompt com proteção contra injeção
        const prompt = RAG_CONTENT_PROMPT
            .replace("{{CONTEXT_TEXT}}", contextText);

        // 3. Chamar IA via orchestrator
        const result = await AiService.generateJson<any>(
            prompt,
            {
                temperature: 0.4,
                timeoutMs: CONTENT_TIMEOUT_MS,
            }
        );

        // Extração resiliente (ajuda se a IA mudar o nome das chaves)
        const content = result.content || result.conteudo || result.material || "";
        const description = result.description || result.resumo || result.descricao || "";

        if (!content) {
            logger.error("generate", "IA retornou JSON sem o campo de conteúdo", { result });
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
