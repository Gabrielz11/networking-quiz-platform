import { env } from "@/lib/env";
import { Logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { AiGenerateOptions, AiResponse } from "./types";
import { GeminiProvider } from "./providers/gemini.provider";
import { GroqProvider } from "./providers/groq.provider";
import { SemanticCache } from "@/lib/semantic-cache";
import { calculateCost } from "./pricing";

export type { AiGenerateOptions };

const logger = new Logger("LlmRouter");

const DEFAULT_GROQ_MODEL = env.REASONING_FALLBACK_MODEL;
const DEFAULT_GEMINI_MODEL = env.GEMINI_MODEL;

// Configuração da política de retry com backoff exponencial.
// Apenas erros transitórios (429, 5xx) são reexecutados; 4xx de auth/quota não são.
const RETRY_CONFIG = {
    maxAttempts: 3,
    baseDelayMs: 500,
    retryableStatusCodes: new Set([429, 500, 502, 503, 504]),
};

function isTransientError(err: unknown): boolean {
    if (typeof err !== "object" || err === null) return false;
    const status = (err as { status?: number }).status;
    if (status !== undefined) return RETRY_CONFIG.retryableStatusCodes.has(status);
    const msg = ((err as { message?: string }).message ?? "").toLowerCase();
    return msg.includes("timeout") || msg.includes("econnreset") || msg.includes("network");
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (!isTransientError(err) || attempt === RETRY_CONFIG.maxAttempts) {
                throw err;
            }
            const delayMs = RETRY_CONFIG.baseDelayMs * 2 ** (attempt - 1);
            logger.warn("withRetry", `${label} — tentativa ${attempt} falhou, aguardando ${delayMs}ms`, {
                error: (err as { message?: string }).message,
            });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    throw lastError;
}

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
    if (!name || name.includes("gemini")) {
        return { provider: getGemini(), resolvedModel: modelName ?? DEFAULT_GEMINI_MODEL, fallback: () => groq, fallbackModel: DEFAULT_GROQ_MODEL };
    }
    return { provider: groq, resolvedModel: modelName ?? DEFAULT_GROQ_MODEL, fallback: () => getGemini(), fallbackModel: DEFAULT_GEMINI_MODEL };
}

/**
 * Gera conteúdo JSON via LLM.
 * P2.2 — Consulta SemanticCache antes de chamar o LLM; armazena após resposta.
 * Fallback simétrico: Gemini falha → Groq; Groq falha → Gemini.
 * Erros transitórios são reexecutados com backoff exponencial antes do fallback.
 */
export async function generateJson<T = unknown>(
    prompt: string,
    options: AiGenerateOptions = {}
): Promise<T> {
    // P2.2 — Consultar cache antes de chamar o LLM (evita custo/latência)
    if (options.pipeline) {
        const temperature = options.temperature ?? 0.7;
        const cached = await SemanticCache.get<T>(options.pipeline, prompt, temperature);
        if (cached !== null) {
            logger.info("generateJson", "Cache hit — retornando resposta cacheada", { pipeline: options.pipeline });
            saveMetadataAsync({ ...options, modelName: "cache", durationMs: 0, provider: "semantic-cache" });
            return cached;
        }
    }

    const { provider, resolvedModel, fallback, fallbackModel } = selectProvider(options.modelName);
    const start = Date.now();

    logger.info("generateJson", `Chamando ${provider.name}`, { model: resolvedModel });

    try {
        const { result, usage } = await withRetry(
            () => provider.generateJson<T>(prompt, { ...options, modelName: resolvedModel }),
            `generateJson:${provider.name}`
        );
        const durationMs = Date.now() - start;
        logger.info("generateJson", `${provider.name} respondeu`, { durationMs });
        saveMetadataAsync({ ...options, modelName: resolvedModel, durationMs, provider: provider.name, usage });
        // P2.2 — Armazenar no cache (fire-and-forget)
        if (options.pipeline) {
            SemanticCache.set(options.pipeline, prompt, options.temperature ?? 0.7, result);
        }
        return result;
    } catch (err: unknown) {
        logger.error("generateJson", `${provider.name} falhou, tentando fallback`, {
            error: (err as { message?: string }).message,
        });

        const fallbackProvider = fallback();
        logger.info("generateJson", `Tentando fallback para ${fallbackProvider.name}`);
        const { result: fallbackResult, usage: fallbackUsage } = await withRetry(
            () => fallbackProvider.generateJson<T>(prompt, { ...options, modelName: fallbackModel }),
            `generateJson:${fallbackProvider.name}-fallback`
        );
        const durationMs = Date.now() - start;
        saveMetadataAsync({
            ...options,
            modelName: fallbackModel,
            durationMs,
            provider: `${fallbackProvider.name}-fallback`,
            usage: fallbackUsage
        });
        if (options.pipeline) {
            SemanticCache.set(options.pipeline, prompt, options.temperature ?? 0.7, fallbackResult);
        }
        return fallbackResult;
    }
}

/**
 * Gera texto puro via LLM.
 * P2.2 — Consulta SemanticCache antes de chamar o LLM.
 * Fallback simétrico com retry.
 */
export async function generateText(
    prompt: string,
    options: AiGenerateOptions = {}
): Promise<string> {
    // P2.2 — Consultar cache antes de chamar o LLM
    if (options.pipeline) {
        const temperature = options.temperature ?? 0.7;
        const cached = await SemanticCache.get<string>(options.pipeline, prompt, temperature);
        if (cached !== null) {
            logger.info("generateText", "Cache hit — retornando resposta cacheada", { pipeline: options.pipeline });
            saveMetadataAsync({ ...options, modelName: "cache", durationMs: 0, provider: "semantic-cache" });
            return cached;
        }
    }

    const { provider, resolvedModel, fallback, fallbackModel } = selectProvider(options.modelName);
    const start = Date.now();

    logger.info("generateText", `Chamando ${provider.name}`, { model: resolvedModel });

    try {
        const { result, usage } = await withRetry(
            () => provider.generateText(prompt, { ...options, modelName: resolvedModel }),
            `generateText:${provider.name}`
        );
        const durationMs = Date.now() - start;
        logger.info("generateText", `${provider.name} respondeu`, { durationMs });
        saveMetadataAsync({ ...options, modelName: resolvedModel, durationMs, provider: provider.name, usage });
        if (options.pipeline) {
            SemanticCache.set(options.pipeline, prompt, options.temperature ?? 0.7, result);
        }
        return result;
    } catch (err: unknown) {
        logger.error("generateText", `${provider.name} falhou, tentando fallback`, {
            error: (err as { message?: string }).message,
        });

        const fallbackProvider = fallback();
        logger.info("generateText", `Tentando fallback para ${fallbackProvider.name}`);
        const { result: fallbackResult, usage: fallbackUsage } = await withRetry(
            () => fallbackProvider.generateText(prompt, { ...options, modelName: fallbackModel }),
            `generateText:${fallbackProvider.name}-fallback`
        );
        const durationMs = Date.now() - start;
        saveMetadataAsync({
            ...options,
            modelName: fallbackModel,
            durationMs,
            provider: `${fallbackProvider.name}-fallback`,
            usage: fallbackUsage
        });
        if (options.pipeline) {
            SemanticCache.set(options.pipeline, prompt, options.temperature ?? 0.7, fallbackResult);
        }
        return fallbackResult;
    }
}

/**
 * Gera texto em streaming via LLM.
 * Fallback simétrico (sem cache: streaming não pode ser armazenado em JSON).
 */
export async function generateTextStream(
    prompt: string,
    options: AiGenerateOptions = {}
): Promise<ReadableStream<Uint8Array>> {
    const { provider, resolvedModel, fallback, fallbackModel } = selectProvider(options.modelName);

    logger.info("generateTextStream", `Iniciando stream com ${provider.name}`, { model: resolvedModel });

    try {
        return await provider.generateTextStream(prompt, { ...options, modelName: resolvedModel });
    } catch (err: unknown) {
        logger.warn("generateTextStream", `${provider.name} falhou, usando fallback`, {
            error: (err as { message?: string }).message,
        });

        const fallbackProvider = fallback();
        logger.info("generateTextStream", `Tentando fallback para ${fallbackProvider.name}`);
        return fallbackProvider.generateTextStream(prompt, { ...options, modelName: fallbackModel });
    }
}

// ─── Persistência de metadados (fire-and-forget) ──────────────────────────────

interface MetadataParams extends AiGenerateOptions {
    durationMs: number;
    provider: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}

function saveMetadataAsync(params: MetadataParams): void {
    if (!params.pipeline) return;
    // Não persiste metadados de cache hits (durationMs = 0 indica hit)
    if (params.provider === "semantic-cache") return;

    const promptTokens = params.usage?.promptTokens ?? null;
    const completionTokens = params.usage?.completionTokens ?? null;
    let costUsd: number | null = null;

    if (promptTokens !== null && completionTokens !== null && params.modelName) {
        costUsd = calculateCost(params.modelName, promptTokens, completionTokens);
    }

    void prisma.aiGenerationMetadata.create({
        data: {
            pipeline: params.pipeline,
            promptUsed: "",          // prompt não é salvo por privacidade de conteúdo
            modelName: params.modelName ?? "unknown",
            temperature: params.temperature ?? 0.7,
            generationTimeMs: params.durationMs,
            moduleId: params.moduleId ?? null,
            sessionId: params.sessionId ?? null,
            promptTokens,
            completionTokens,
            costUsd,
        },
    }).catch((err: unknown) => {
        logger.warn("saveMetadataAsync", "Falha ao salvar metadados (não crítico)", {
            error: (err as { message?: string }).message,
        });
    });
}

/** Exporta objeto agrupado para compatibilidade com imports legados */
export const LlmRouter = { generateJson, generateText, generateTextStream };
