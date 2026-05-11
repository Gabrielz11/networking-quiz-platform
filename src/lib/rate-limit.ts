import { env } from "./env";

interface RateLimitInfo {
    count: number;
    resetTime: number;
}

const memoryStore = new Map<string, RateLimitInfo>();

/**
 * Simple Memory-based Rate Limiter.
 * In a real production environment with multiple server instances, 
 * you should use Redis (already configured in env.ts).
 */
export class RateLimiter {
    private limit: number;
    private windowMs: number;

    constructor(limit: number, windowMs: number) {
        this.limit = limit;
        this.windowMs = windowMs;
    }

    async check(key: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
        const now = Date.now();
        const info = memoryStore.get(key);

        if (!info || now > info.resetTime) {
            // New window
            const newInfo = {
                count: 1,
                resetTime: now + this.windowMs
            };
            memoryStore.set(key, newInfo);
            return {
                success: true,
                limit: this.limit,
                remaining: this.limit - 1,
                reset: newInfo.resetTime
            };
        }

        if (info.count >= this.limit) {
            return {
                success: false,
                limit: this.limit,
                remaining: 0,
                reset: info.resetTime
            };
        }

        info.count += 1;
        return {
            success: true,
            limit: this.limit,
            remaining: this.limit - info.count,
            reset: info.resetTime
        };
    }
}

// Pre-defined limiters
export const aiContentLimiter = new RateLimiter(20, 60 * 60 * 1000); // 20 requisições por hora
export const quizLimiter = new RateLimiter(50, 60 * 1000); // 50 questões por minuto
