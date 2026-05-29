import Redis from "ioredis";
import { env } from "@/lib/env";

// Singleton para uso geral (rate-limit, idempotency, session lock, semantic cache tier 1)
const globalForRedis = global as unknown as { redis: Redis };

export const redis = globalForRedis.redis || new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

/**
 * P2.3 — Factory para conexões BullMQ (Queue e Worker).
 *
 * BullMQ exige conexões dedicadas (Queue e Worker não podem compartilhar a mesma instância).
 * Esta factory centraliza a configuração em um único lugar e é importada por
 * embedding-queue.ts e embedding-worker.ts, eliminando duplicação de configuração.
 *
 * `enableReadyCheck: false` é necessário para ambientes onde o Redis pode não
 * estar pronto imediatamente no momento do import.
 */
export function createBullMQConnection(): Redis {
    return new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
}
