import { prisma } from "@/lib/prisma";

export class AiMetricsRepository {
    async aggregateGlobals() {
        return prisma.aiGenerationMetadata.aggregate({
            _sum: {
                costUsd: true,
                promptTokens: true,
                completionTokens: true,
            },
            _avg: {
                generationTimeMs: true,
            },
            _count: {
                id: true,
            }
        });
    }

    async aggregateCacheEntries() {
        return prisma.semanticCacheEntry.aggregate({
            _sum: {
                hitCount: true,
            },
            _count: {
                id: true,
            }
        });
    }

    async groupByPipeline() {
        return prisma.aiGenerationMetadata.groupBy({
            by: ['pipeline'],
            _sum: {
                costUsd: true,
                promptTokens: true,
                completionTokens: true,
            },
            _count: {
                id: true,
            },
            _avg: {
                generationTimeMs: true,
            }
        });
    }

    async getTimeSeries(since: Date) {
        return prisma.$queryRaw<Array<{
            date: string;
            totalCost: number | string;
            count: number | bigint;
        }>>`
            SELECT
                TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as "date",
                COALESCE(SUM("costUsd"), 0) as "totalCost",
                COUNT(id)::int as "count"
            FROM "AiGenerationMetadata"
            WHERE "createdAt" >= ${since}
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY "date" ASC
        `;
    }
}

export const aiMetricsRepository = new AiMetricsRepository();
