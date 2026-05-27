import { redis } from "@/lib/redis";

interface IdempotentResponse {
    status: number;
    body: any;
}

/**
 * Busca uma resposta salva associada a uma chave de idempotência.
 */
export async function getCachedIdempotentResponse(
    key: string
): Promise<IdempotentResponse | null> {
    if (!key || key.trim() === "") return null;
    const cached = await redis.get(`idempotency:${key}`);
    if (!cached) return null;

    try {
        return JSON.parse(cached);
    } catch {
        return null;
    }
}

/**
 * Armazena a resposta de sucesso ou erro associada à chave no Redis com TTL de 24h.
 */
export async function cacheIdempotentResponse(
    key: string,
    status: number,
    body: any,
    ttlSeconds = 86400
): Promise<void> {
    if (!key || key.trim() === "") return;
    await redis.set(
        `idempotency:${key}`,
        JSON.stringify({ status, body }),
        "EX",
        ttlSeconds
    );
}

/**
 * Adquire um lock distribuído para evitar que requisições concorrentes idênticas executem ao mesmo tempo.
 */
export async function acquireIdempotencyLock(
    key: string,
    ttlMs = 10000
): Promise<boolean> {
    if (!key || key.trim() === "") return false;
    const lockKey = `lock:idempotency:${key}`;
    // ioredis SET key value PX ttlMs NX — returns "OK" or null
    const acquired = await redis.set(lockKey, "locked", "PX", ttlMs, "NX");
    return acquired !== null;
}

/**
 * Libera o lock de idempotência.
 */
export async function releaseIdempotencyLock(key: string): Promise<void> {
    if (!key || key.trim() === "") return;
    await redis.del(`lock:idempotency:${key}`);
}
