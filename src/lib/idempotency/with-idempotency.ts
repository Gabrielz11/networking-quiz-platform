import { NextResponse } from "next/server";
import { Logger } from "@/lib/logger";
import {
    getCachedIdempotentResponse,
    cacheIdempotentResponse,
    acquireIdempotencyLock,
    releaseIdempotencyLock,
} from "@/lib/idempotency";

export type IdempotencyHandlerResult = {
    status: number;
    body: unknown;
};

type WithIdempotencyParams = {
    key: string | null;
    logger: Logger;
    handler: () => Promise<IdempotencyHandlerResult>;
};

export async function withIdempotency(
    params: WithIdempotencyParams
): Promise<NextResponse> {
    const { key, logger, handler } = params;
    let lockAcquired = false;

    if (key) {
        const cached = await getCachedIdempotentResponse(key);

        if (cached) {
            logger.info("withIdempotency", "Retornando resposta idempotente cacheada", {
                idempotencyKeyPrefix: key.slice(0, 8),
            });

            return NextResponse.json(cached.body, { status: cached.status });
        }

        const locked = await acquireIdempotencyLock(key);

        if (!locked) {
            return NextResponse.json(
                { error: "Uma requisição idêntica já está em processamento." },
                { status: 409 }
            );
        }

        lockAcquired = true;
    }

    try {
        const result = await handler();

        if (key && result.status === 200) {
            await cacheIdempotentResponse(key, result.status, result.body);
        }

        return NextResponse.json(result.body, { status: result.status });
    } finally {
        if (key && lockAcquired) {
            await releaseIdempotencyLock(key).catch(() => { });
        }
    }
}