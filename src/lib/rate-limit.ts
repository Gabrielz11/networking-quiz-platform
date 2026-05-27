import { redis } from "@/lib/redis";

interface RateLimitConfig {
    limit: number;
    windowSeconds: number;
}

/**
 * Verifica se um identificador atingiu o limite de requisições em uma determinada rota.
 * Implementação utilizando Sliding Window Log (Sorted Set) no Redis.
 */
export async function isRateLimited(
    identifier: string,
    route: string,
    config: RateLimitConfig
): Promise<boolean> {
    const key = `rate:limit:${identifier}:${route}`;
    const now = Date.now();
    const clearBefore = now - config.windowSeconds * 1000;

    const pipeline = redis.pipeline();
    // 1. Remove timestamps fora da janela de tempo atual
    pipeline.zremrangebyscore(key, 0, clearBefore);
    // 2. Adiciona o timestamp atual
    pipeline.zadd(key, now, now.toString());
    // 3. Obtém o número de registros presentes na janela
    pipeline.zcard(key);
    // 4. Renova a expiração da chave para limpeza automática do Redis
    pipeline.expire(key, config.windowSeconds * 2);

    const results = await pipeline.exec();
    if (!results) return false;

    // O ZCARD está no índice 2 do pipeline
    const cardResult = results[2];
    if (cardResult && cardResult[1] !== null) {
        const count = cardResult[1] as number;
        return count > config.limit;
    }

    return false;
}
