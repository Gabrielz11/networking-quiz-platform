/**
 * SemanticCache — Two-Tier Cache para respostas da IA
 *
 * Tier 1 (Redis):   Cache exato por SHA-256 do prompt. O(1), < 1ms.
 * Tier 2 (pgvector): Cache semântico por similaridade cosine >= 0.92.
 *                    Útil para prompts semanticamente equivalentes mas textualmente diferentes.
 *
 * Uso:
 *   const cached = await SemanticCache.get<T>(pipeline, prompt, temperature);
 *   if (cached) return cached;
 *   const result = await callLLM(prompt);
 *   await SemanticCache.set(pipeline, prompt, temperature, result);
 */

import { createHash } from "crypto";
import { redis } from "@/lib/redis";
import { Logger } from "@/lib/logger";

const logger = new Logger("SemanticCache");

// ─── Configuração por pipeline ───────────────────────────────────────────────

interface PipelineCacheConfig {
    tier1TtlSeconds: number; // TTL do Redis (Tier 1)
    tier2TtlDays: number;    // TTL do pgvector (Tier 2)
    useTier2: boolean;       // Habilita busca semântica (Tier 2)
    similarityThreshold: number; // Mínimo de cosine similarity para hit (Tier 2)
}

const PIPELINE_CONFIG: Record<string, PipelineCacheConfig> = {
    EXPLANATION: {
        tier1TtlSeconds: 60 * 60 * 24 * 7, // 7 dias
        tier2TtlDays: 7,
        useTier2: true,
        similarityThreshold: 0.92,
    },
    QUIZ_GEN: {
        tier1TtlSeconds: 60 * 60, // 1 hora (race condition protection only)
        tier2TtlDays: 0,
        useTier2: false, // Questões precisam de variedade
        similarityThreshold: 0,
    },
    CONTENT_GEN: {
        tier1TtlSeconds: 60 * 30, // 30 min
        tier2TtlDays: 0,
        useTier2: false, // Geração de conteúdo sempre nova
        similarityThreshold: 0,
    },
};

const DEFAULT_CONFIG: PipelineCacheConfig = {
    tier1TtlSeconds: 60 * 60,
    tier2TtlDays: 0,
    useTier2: false,
    similarityThreshold: 0.92,
};

function getConfig(pipeline: string): PipelineCacheConfig {
    return PIPELINE_CONFIG[pipeline] ?? DEFAULT_CONFIG;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

/** Normaliza o prompt removendo espaços extras e quebras de linha duplas. */
function normalizePrompt(prompt: string): string {
    return prompt.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Gera a chave de hash SHA-256 determinística para Tier 1. */
function hashPrompt(pipeline: string, prompt: string, temperature: number): string {
    const normalized = normalizePrompt(prompt);
    const input = `${pipeline}:${temperature}:${normalized}`;
    return createHash("sha256").update(input).digest("hex");
}

/** Chave Redis com namespace para evitar colisões. */
function redisKey(pipeline: string, hash: string): string {
    return `semantic_cache:${pipeline}:${hash}`;
}

/**
 * Cosine similarity entre dois vetores (produto escalar normalizado).
 * Retorna valor entre -1 e 1. Para embeddings normalizados, é equivalente ao produto escalar.
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

// ─── SemanticCache ───────────────────────────────────────────────────────────

export class SemanticCache {

    /**
     * Tier 1: Busca no Redis por hash exato.
     * Retorna o valor cacheado ou null.
     */
    private static async getTier1<T>(
        pipeline: string,
        hash: string
    ): Promise<T | null> {
        try {
            const key = redisKey(pipeline, hash);
            const raw = await redis.get(key);
            if (!raw) return null;

            const parsed = JSON.parse(raw) as T;
            // Incrementa hit count no Redis (fire-and-forget)
            redis.incr(`${key}:hits`).catch(() => {});
            logger.info("getTier1", "[CACHE HIT] Tier 1 (Redis hash)", { pipeline, hash: hash.slice(0, 8) });
            return parsed;
        } catch (err: any) {
            logger.warn("getTier1", "Erro ao ler do Redis — ignorando cache", { error: err.message });
            return null;
        }
    }

    /**
     * Tier 2: Busca no pgvector por similaridade cosine >= threshold.
     * Retorna o valor cacheado ou null.
     */
    private static async getTier2<T>(
        pipeline: string,
        prompt: string,
        config: PipelineCacheConfig
    ): Promise<T | null> {
        if (!config.useTier2) return null;

        try {
            const { getEmbeddingProvider } = await import(
                "@/lib/rag/core/providers/embedding-provider"
            );
            const provider = getEmbeddingProvider();
            const queryEmbedding = await provider.embedText(normalizePrompt(prompt));

            const { prisma } = await import("@/lib/prisma");

            // Busca as 3 entradas mais próximas semanticamente via pgvector
            const rows = await prisma.$queryRawUnsafe<
                Array<{ id: string; responseJson: string; similarity: number; hitCount: number }>
            >(
                `SELECT id, "responseJson", "hitCount",
                        1 - (embedding <=> $1::vector) AS similarity
                 FROM "SemanticCacheEntry"
                 WHERE pipeline = $2
                   AND "ttlExpiresAt" > NOW()
                   AND embedding IS NOT NULL
                 ORDER BY embedding <=> $1::vector
                 LIMIT 3`,
                `[${queryEmbedding.join(",")}]`,
                pipeline
            );

            const hit = rows.find(r => r.similarity >= config.similarityThreshold);
            if (!hit) return null;

            logger.info("getTier2", "[CACHE HIT] Tier 2 (pgvector semantic)", {
                pipeline,
                similarity: hit.similarity.toFixed(4),
                hitCount: hit.hitCount,
            });

            // Incrementa hit count (fire-and-forget)
            prisma.semanticCacheEntry
                .update({ where: { id: hit.id }, data: { hitCount: { increment: 1 } } })
                .catch(() => {});

            return JSON.parse(hit.responseJson) as T;
        } catch (err: any) {
            logger.warn("getTier2", "Erro no Tier 2 — ignorando cache semântico", { error: err.message });
            return null;
        }
    }

    /**
     * Persiste a resposta no Tier 1 (Redis) e opcionalmente no Tier 2 (pgvector).
     * Fire-and-forget: não bloqueia a resposta principal.
     */
    private static async store<T>(
        pipeline: string,
        prompt: string,
        hash: string,
        temperature: number,
        response: T,
        config: PipelineCacheConfig
    ): Promise<void> {
        const responseJson = JSON.stringify(response);

        // Tier 1: Redis
        try {
            const key = redisKey(pipeline, hash);
            await redis.set(key, responseJson, "EX", config.tier1TtlSeconds);
            logger.info("store", "Resposta salva no Tier 1 (Redis)", {
                pipeline,
                ttlSeconds: config.tier1TtlSeconds,
            });
        } catch (err: any) {
            logger.warn("store", "Falha ao salvar no Redis", { error: err.message });
        }

        // Tier 2: pgvector (apenas para pipelines habilitados)
        if (!config.useTier2) return;

        try {
            const { getEmbeddingProvider } = await import(
                "@/lib/rag/core/providers/embedding-provider"
            );
            const provider = getEmbeddingProvider();
            const embedding = await provider.embedText(normalizePrompt(prompt));

            const { prisma } = await import("@/lib/prisma");
            const ttlExpiresAt = new Date(
                Date.now() + config.tier2TtlDays * 24 * 60 * 60 * 1000
            );

            const newEntry = await prisma.semanticCacheEntry.create({
                data: {
                    pipeline,
                    promptHash: hash,
                    promptText: prompt.substring(0, 4000), // limita tamanho armazenado
                    responseJson,
                    ttlExpiresAt,
                },
            });

            // Injeta o embedding via SQL raw (pgvector não é suportado pelo Prisma client)
            await prisma.$executeRawUnsafe(
                `UPDATE "SemanticCacheEntry" SET embedding = $1::vector WHERE id = $2`,
                `[${embedding.join(",")}]`,
                newEntry.id
            );

            logger.info("store", "Resposta salva no Tier 2 (pgvector)", {
                pipeline,
                ttlDays: config.tier2TtlDays,
                embeddingDims: embedding.length,
            });
        } catch (err: any) {
            logger.warn("store", "Falha ao salvar no pgvector", { error: err.message });
        }
    }

    // ─── API Pública ──────────────────────────────────────────────────────────

    /**
     * Busca uma resposta cacheada. Tenta Tier 1 (Redis) primeiro, depois Tier 2 (pgvector).
     * Retorna null se não encontrado em nenhum tier.
     */
    static async get<T>(
        pipeline: string,
        prompt: string,
        temperature: number
    ): Promise<T | null> {
        const config = getConfig(pipeline);
        const hash = hashPrompt(pipeline, prompt, temperature);

        // Tier 1 primeiro (mais rápido)
        const tier1 = await this.getTier1<T>(pipeline, hash);
        if (tier1 !== null) return tier1;

        // Tier 2 (mais lento, mas captura variações semânticas)
        const tier2 = await this.getTier2<T>(pipeline, prompt, config);
        if (tier2 !== null) {
            // Propaga para Tier 1 para acelerar próximas requisições (sem aguardar)
            redis
                .set(redisKey(pipeline, hash), JSON.stringify(tier2), "EX", config.tier1TtlSeconds)
                .catch(() => {});
            return tier2;
        }

        return null;
    }

    /**
     * Persiste uma resposta no cache (fire-and-forget).
     * Não lança exceções — falhas são logadas e ignoradas.
     */
    static set<T>(
        pipeline: string,
        prompt: string,
        temperature: number,
        response: T
    ): void {
        const config = getConfig(pipeline);
        const hash = hashPrompt(pipeline, prompt, temperature);
        // Fire-and-forget: não bloqueia a resposta ao usuário
        this.store(pipeline, prompt, hash, temperature, response, config).catch((err: any) => {
            logger.warn("set", "Falha silenciosa no cache store", { error: err.message });
        });
    }

    /**
     * Invalida o cache do Tier 1 (Redis) para um pipeline/módulo específico.
     * Útil quando o conteúdo de um módulo é atualizado pelo professor.
     */
    static async invalidate(pipeline: string, promptPrefix?: string): Promise<void> {
        try {
            const pattern = `semantic_cache:${pipeline}:*`;
            const keys = await redis.keys(pattern);
            if (keys.length === 0) return;
            await redis.del(...keys);
            logger.info("invalidate", `Cache do pipeline ${pipeline} invalidado`, {
                keysRemoved: keys.length,
            });
        } catch (err: any) {
            logger.warn("invalidate", "Falha na invalidação do cache", { error: err.message });
        }
    }
}
