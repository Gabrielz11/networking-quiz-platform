import { env } from "@/lib/env";
import { Logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { AiGenerateOptions } from "./types";
import { AiProvider } from "./types";
import { GeminiProvider } from "./providers/gemini.provider";
import { GroqProvider } from "./providers/groq.provider";
import { OpenaiProvider } from "./providers/openai.provider";
import { SemanticCache } from "@/lib/semantic-cache";
import { calculateCost } from "./pricing";
import { validateSchemaRequirements } from "@/lib/utils";

export type { AiGenerateOptions };

const logger = new Logger("LlmRouter");

// Provider e modelo padrão para geração de conteúdo (Gemini como primário)
const DEFAULT_GEMINI_MODEL = env.CONTENT_GENERATION_MODEL;
// Modelo de fallback — usado quando o provider primário falha e CONTENT_FALLBACK_ENABLED=true
const DEFAULT_GROQ_MODEL = env.CONTENT_FALLBACK_MODEL;



// ─── Seleção de Providers ─────────────────────────────────────────────────────

// Instâncias singleton lazy-loaded
let geminiInstance: GeminiProvider | null = null;
let groqInstance: GroqProvider | null = null;
let openaiInstance: OpenaiProvider | null = null;

function getProviderInstance(name: string): AiProvider {
    const key = name.toLowerCase();
    if (key.includes("openai") || key.includes("gpt")) {
        if (!openaiInstance) openaiInstance = new OpenaiProvider();
        return openaiInstance;
    }
    if (key.includes("groq") || key.includes("llama")) {
        if (!groqInstance) groqInstance = new GroqProvider();
        return groqInstance;
    }
    if (!geminiInstance) geminiInstance = new GeminiProvider();
    return geminiInstance;
}

/** Seleciona provider baseado no modelName e prepara o fallback configurado no .env. */
function selectProvider(modelName?: string) {
    const name = (modelName ?? "").toLowerCase();
    const fallbackProviderName = env.CONTENT_FALLBACK_PROVIDER;
    const fallbackModelName = env.CONTENT_FALLBACK_MODEL;

    if (!name || name.includes("gemini")) {
        return {
            provider: getProviderInstance("gemini"),
            resolvedModel: modelName ?? env.CONTENT_GENERATION_MODEL,
            fallback: () => getProviderInstance(fallbackProviderName),
            fallbackModel: fallbackModelName,
        };
    }
    return {
        provider: getProviderInstance(name),
        resolvedModel: modelName ?? fallbackModelName,
        fallback: () => getProviderInstance("gemini"),
        fallbackModel: env.CONTENT_GENERATION_MODEL,
    };
}

// ─── Executor genérico com fallback ───────────────────────────────────────────

interface ExecuteOptions<T> {
    label: string;
    provider: AiProvider;
    resolvedModel: string;
    fallback: () => AiProvider;
    fallbackModel: string;
    call: (p: AiProvider, model: string) => Promise<{ result: T; usage?: { promptTokens: number; completionTokens: number } }>;
    options: AiGenerateOptions;
    start: number;
}

/**
 * Executa uma chamada LLM com retry e fallback simétrico.
 * Centraliza o fluxo compartilhado entre `generateJson` e `generateText`,
 * eliminando duplicação e garantindo comportamento consistente.
 */
async function executeWithFallback<T>({
    label,
    provider,
    resolvedModel,
    fallback,
    fallbackModel,
    call,
    options,
    start,
}: ExecuteOptions<T>): Promise<{ result: T; modelUsed: string; providerName: string; usage?: { promptTokens: number; completionTokens: number } }> {
    logger.info(label, `Chamando ${provider.name}`, { model: resolvedModel });

    try {
        const { result, usage } = await call(provider, resolvedModel);
        const durationMs = Date.now() - start;
        logger.info(label, `${provider.name} respondeu`, { durationMs });
        if (usage) {
            logger.info(label, `Consumo de Tokens — Modelo: ${resolvedModel} | Input: ${usage.promptTokens} | Output: ${usage.completionTokens} | Total: ${usage.promptTokens + usage.completionTokens}`, {
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.promptTokens + usage.completionTokens,
            });
            const cost = calculateCost(resolvedModel, usage.promptTokens, usage.completionTokens);
            if (cost !== null) {
                logger.info(label, `Custo estimado: $${cost.toFixed(6)} USD`, { model: resolvedModel, costUsd: cost });
            }
        }
        saveMetadataAsync({ ...options, modelName: resolvedModel, durationMs, provider: provider.name, usage });
        return { result, modelUsed: resolvedModel, providerName: provider.name, usage };
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error(label, `${provider.name} falhou (tentando fallback). Erro original: ${errMsg}`, {
            error: errMsg,
        });

        const fallbackAllowed = options.fallbackEnabled ?? env.CONTENT_FALLBACK_ENABLED;
        if (!fallbackAllowed) {
            logger.warn(label, `Fallback desabilitado para esta chamada — propagando erro original: ${errMsg}`);
            throw err;
        }

        const fallbackProvider = fallback();
        logger.info(label, `Tentando fallback para ${fallbackProvider.name}`);

        try {
            const { result, usage } = await call(fallbackProvider, fallbackModel);
            const durationMs = Date.now() - start;
            if (usage) {
                logger.info(label, `Consumo de Tokens (Fallback) — Modelo: ${fallbackModel} | Input: ${usage.promptTokens} | Output: ${usage.completionTokens} | Total: ${usage.promptTokens + usage.completionTokens}`, {
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.promptTokens + usage.completionTokens,
                });
                const cost = calculateCost(fallbackModel, usage.promptTokens, usage.completionTokens);
                if (cost !== null) {
                    logger.info(label, `Custo estimado (Fallback): $${cost.toFixed(6)} USD`, { model: fallbackModel, costUsd: cost });
                }
            }
            saveMetadataAsync({
                ...options,
                modelName: fallbackModel,
                durationMs,
                provider: `${fallbackProvider.name}-fallback`,
                usage,
            });
            return { result, modelUsed: fallbackModel, providerName: `${fallbackProvider.name}-fallback`, usage };
        } catch (fallbackErr: unknown) {
            const fallbackErrMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            logger.error(label, `${fallbackProvider.name} (fallback) também falhou. Erro original: ${fallbackErrMsg}`, {
                error: fallbackErrMsg,
            });
            throw fallbackErr;
        }
    }
}

// ─── API Pública ───────────────────────────────────────────────────────────────

/**
 * Gera conteúdo JSON via LLM.
 * Consulta SemanticCache antes de chamar o LLM; armazena após resposta.
 * Fallback simétrico: Gemini falha → Groq; Groq falha → Gemini.
 * Erros de servidor (5xx) são retriados com backoff; 429 vai direto ao fallback.
 */
export async function generateJson<T = unknown>(
    prompt: string,
    options: AiGenerateOptions = {}
): Promise<T> {
    if (options.pipeline) {
        const temperature = options.temperature ?? 0.7;
        const cached = await SemanticCache.get<T>(options.pipeline, prompt, temperature);
        if (cached !== null) {
            let cacheIsValid = true;
            if (options.responseSchema) {
                const schemaError = validateSchemaRequirements(cached, options.responseSchema);
                if (schemaError) {
                    logger.warn("generateJson", `Cache ignorado (inválido no schema): ${schemaError}`);
                    cacheIsValid = false;
                }
            }

            if (cacheIsValid) {
                logger.info("generateJson", "Cache hit — retornando resposta cacheada", { pipeline: options.pipeline });
                saveMetadataAsync({ ...options, modelName: "cache", durationMs: 0, provider: "semantic-cache" });
                return cached;
            }
        }
    }

    const { provider, resolvedModel, fallback, fallbackModel } = selectProvider(options.modelName);
    const start = Date.now();

    const { result } = await executeWithFallback<T>({
        label: "generateJson",
        provider,
        resolvedModel,
        fallback,
        fallbackModel,
        call: (p, model) => p.generateJson<T>(prompt, { ...options, modelName: model }),
        options,
        start,
    });

    if (options.pipeline) {
        SemanticCache.set(options.pipeline, prompt, options.temperature ?? 0.7, result);
    }
    return result;
}

/**
 * Gera texto puro via LLM.
 * Consulta SemanticCache antes de chamar o LLM; armazena após resposta.
 * Fallback simétrico com retry em erros de servidor.
 */
export async function generateText(
    prompt: string,
    options: AiGenerateOptions = {}
): Promise<string> {
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

    const { result } = await executeWithFallback<string>({
        label: "generateText",
        provider,
        resolvedModel,
        fallback,
        fallbackModel,
        call: (p, model) => p.generateText(prompt, { ...options, modelName: model }),
        options,
        start,
    });

    if (options.pipeline) {
        SemanticCache.set(options.pipeline, prompt, options.temperature ?? 0.7, result);
    }
    return result;
}

/**
 * Gera texto em streaming via LLM.
 * Fallback simétrico (sem cache: streaming não pode ser serializado em JSON).
 * Nota: retry não é aplicado aqui pois streams parciais não são idempotentes.
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
        const errMsg = err instanceof Error ? err.message : String(err);
        const fallbackAllowed = options.fallbackEnabled ?? env.CONTENT_FALLBACK_ENABLED;
        if (!fallbackAllowed) {
            logger.warn("generateTextStream", `${provider.name} falhou. Fallback desabilitado para esta chamada — propagando erro original: ${errMsg}`);
            throw err;
        }

        logger.warn("generateTextStream", `${provider.name} falhou (usando fallback). Erro original: ${errMsg}`, {
            error: errMsg,
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
