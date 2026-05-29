import { aiMetricsRepository } from "@/repositories/ai-metrics.repository";
import { redis } from "@/lib/redis";
import { Logger } from "@/lib/logger";

const logger = new Logger("AiMetricsService");

const CACHE_KEY = "dashboard:ai-metrics:v1";
const CACHE_TTL_SECONDS = 300; // 5 minutos

// Lista de pipelines monitorados para a contagem do cache Tier 1
const PIPELINES = ["EXPLANATION", "QUIZ_GEN", "CONTENT_GEN"];

export interface DashboardMetrics {
    summary: {
        totalCostUsd: number;
        totalGenerations: number;
        avgGenerationTimeMs: number;
        totalTokens: number;
    };
    cache: {
        totalHits: number;
        totalEntries: number;
    };
    pipelines: Array<{
        name: string;
        costUsd: number;
        count: number;
        avgTime: number;
        totalTokens: number;
    }>;
    timeSeries: Array<{
        date: string;
        totalCost: number;
        count: number;
    }>;
}

export class AiMetricsService {
    async getDashboardMetrics(): Promise<DashboardMetrics> {
        // 1. Tenta ler do cache Redis
        try {
            const cached = await redis.get(CACHE_KEY);
            if (cached) {
                logger.info("getDashboardMetrics", "Cache hit — retornando dados memoizados");
                return JSON.parse(cached) as DashboardMetrics;
            }
        } catch (err: any) {
            logger.warn("getDashboardMetrics", "Erro ao acessar o cache Redis (read)", { error: err.message });
        }

        logger.info("getDashboardMetrics", "Cache miss — buscando dados do banco");

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // 2. Executa queries em paralelo utilizando o repositório puro e buscas no Redis
        const [agg, cacheAgg, pipelineGroup, timeSeriesRaw, tier1HitsResults] = await Promise.all([
            aiMetricsRepository.aggregateGlobals(),
            aiMetricsRepository.aggregateCacheEntries(),
            aiMetricsRepository.groupByPipeline(),
            aiMetricsRepository.getTimeSeries(sevenDaysAgo),
            Promise.all(PIPELINES.map(p => redis.get(`metrics:cache:${p}:hits`)))
        ]);

        // 3. Monta o DTO com as devidas conversões de tipo
        const totalTier1Hits = tier1HitsResults.reduce((acc, val) => acc + (val ? parseInt(val, 10) : 0), 0);

        const result: DashboardMetrics = {
            summary: {
                totalCostUsd: Number(agg._sum.costUsd || 0),
                totalGenerations: Number(agg._count.id || 0),
                avgGenerationTimeMs: Number(agg._avg.generationTimeMs || 0),
                totalTokens: Number((agg._sum.promptTokens || 0) + (agg._sum.completionTokens || 0)),
            },
            cache: {
                totalHits: Number((cacheAgg._sum.hitCount || 0)) + totalTier1Hits,
                totalEntries: Number(cacheAgg._count.id || 0),
            },
            pipelines: pipelineGroup.map(p => ({
                name: p.pipeline,
                costUsd: Number(p._sum.costUsd || 0),
                count: Number(p._count.id || 0),
                avgTime: Number(p._avg.generationTimeMs || 0),
                totalTokens: Number((p._sum.promptTokens || 0) + (p._sum.completionTokens || 0)),
            })),
            timeSeries: timeSeriesRaw.map(t => ({
                date: t.date,
                totalCost: Number(t.totalCost),
                count: Number(t.count)
            }))
        };

        // 4. Grava os dados no cache Redis
        try {
            await redis.set(CACHE_KEY, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
        } catch (err: any) {
            logger.warn("getDashboardMetrics", "Erro ao gravar dados no cache Redis (write)", { error: err.message });
        }

        return result;
    }
}

export const aiMetricsService = new AiMetricsService();
