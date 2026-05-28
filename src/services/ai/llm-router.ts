import { env } from "@/lib/env";
import { Logger } from "@/lib/logger";
import { safeJsonParse } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { AiGenerateOptions } from "./types";
import { GeminiProvider } from "./providers/gemini.provider";
import { GroqProvider } from "./providers/groq.provider";

export type { AiGenerateOptions };

const logger = new Logger("LlmRouter");

const DEFAULT_GROQ_MODEL = env.REASONING_FALLBACK_MODEL;
const DEFAULT_GEMINI_MODEL = env.GEMINI_MODEL;

// Instâncias singleton dos providers
const groq = new GroqProvider();
let gemini: GeminiProvider | null = null;

function getGemini(): GeminiProvider {
    if (!gemini) gemini = new GeminiProvider();
    return gemini;
}

/** Seleciona provider baseado no modelName */
function selectProvider(modelName?: string) {
    const name = (modelName ?? "").toLowerCase();
    if (!name || name.includes("gemini")) return { provider: getGemini(), resolvedModel: modelName ?? DEFAULT_GEMINI_MODEL };
    return { provider: groq, resolvedModel: modelName ?? DEFAULT_GROQ_MODEL };
}

/**
 * Gera conteúdo JSON via LLM.
 * - Tenta o provider selecionado uma vez.
 * - Se o JSON vier malformado, tenta corrigir com jsonrepair (já embutido em safeJsonParse).
 * - Sem Critic, sem loop de qualidade — direto e rápido.
 */
export async function generateJson<T = unknown>(
    prompt: string,
    options: AiGenerateOptions = {}
): Promise<T> {
    const { provider, resolvedModel } = selectProvider(options.modelName);
    const start = Date.now();

    logger.info("generateJson", `Chamando ${provider.name}`, { model: resolvedModel });

    try {
        const result = await provider.generateJson<T>(prompt, { ...options, modelName: resolvedModel });

        const durationMs = Date.now() - start;
        logger.info("generateJson", `${provider.name} respondeu`, { durationMs });

        saveMetadataAsync({ ...options, modelName: resolvedModel, durationMs, provider: provider.name });

        return result;
    } catch (err: any) {
        logger.error("generateJson", `${provider.name} falhou`, { error: err.message });

        // Fallback para Groq se Gemini falhou
        if (provider.name === "gemini") {
            logger.info("generateJson", "Tentando fallback para Groq");
            const fallbackResult = await groq.generateJson<T>(prompt, { ...options, modelName: DEFAULT_GROQ_MODEL });
            const durationMs = Date.now() - start;
            saveMetadataAsync({ ...options, modelName: DEFAULT_GROQ_MODEL, durationMs, provider: "groq-fallback" });
            return fallbackResult;
        }

        throw err;
    }
}

/**
 * Gera texto puro via LLM.
 */
export async function generateText(
    prompt: string,
    options: AiGenerateOptions = {}
): Promise<string> {
    const { provider, resolvedModel } = selectProvider(options.modelName);
    const start = Date.now();

    logger.info("generateText", `Chamando ${provider.name}`, { model: resolvedModel });

    try {
        const result = await provider.generateText(prompt, { ...options, modelName: resolvedModel });
        const durationMs = Date.now() - start;
        logger.info("generateText", `${provider.name} respondeu`, { durationMs });
        saveMetadataAsync({ ...options, modelName: resolvedModel, durationMs, provider: provider.name });
        return result;
    } catch (err: any) {
        logger.error("generateText", `${provider.name} falhou`, { error: err.message });

        if (provider.name === "gemini") {
            logger.info("generateText", "Tentando fallback para Groq");
            const fallback = await groq.generateText(prompt, { ...options, modelName: DEFAULT_GROQ_MODEL });
            const durationMs = Date.now() - start;
            saveMetadataAsync({ ...options, modelName: DEFAULT_GROQ_MODEL, durationMs, provider: "groq-fallback" });
            return fallback;
        }

        throw err;
    }
}

/**
 * Gera texto em streaming (SSE) via LLM.
 * Em caso de falha do Gemini, faz fallback para Groq.
 */
export async function generateTextStream(
    prompt: string,
    options: AiGenerateOptions = {}
): Promise<ReadableStream<Uint8Array>> {
    const { provider, resolvedModel } = selectProvider(options.modelName);

    logger.info("generateTextStream", `Iniciando stream com ${provider.name}`, { model: resolvedModel });

    try {
        return await provider.generateTextStream(prompt, { ...options, modelName: resolvedModel });
    } catch (err: any) {
        logger.warn("generateTextStream", `${provider.name} falhou, usando Groq`, { error: err.message });

        if (provider.name === "gemini") {
            return groq.generateTextStream(prompt, { ...options, modelName: DEFAULT_GROQ_MODEL });
        }

        throw err;
    }
}

// ─── Persistência de metadados (fire-and-forget) ──────────────────────────────

interface MetadataParams extends AiGenerateOptions {
    durationMs: number;
    provider: string;
}

function saveMetadataAsync(params: MetadataParams): void {
    if (!params.pipeline) return;

    void prisma.aiGenerationMetadata.create({
        data: {
            pipeline: params.pipeline,
            promptUsed: "",          // prompt não é salvo por privacidade de conteúdo
            modelName: params.modelName ?? "unknown",
            temperature: params.temperature ?? 0.7,
            generationTimeMs: params.durationMs,
            moduleId: params.moduleId ?? null,
            sessionId: params.sessionId ?? null,
            criticScore: 1.0,
            criticMetrics: {},
            retrievedChunks: [],
        },
    }).catch((err: any) => {
        logger.warn("saveMetadataAsync", "Falha ao salvar metadados (não crítico)", { error: err.message });
    });
}

/** Exporta objeto agrupado para compatibilidade com imports legados */
export const LlmRouter = { generateJson, generateText, generateTextStream };
