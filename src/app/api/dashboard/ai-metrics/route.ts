import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
    try {
        const session = await auth();
        
        // Verifica se é professor (admin)
        if (!session?.user || session.user.role !== "TEACHER") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // 1. Totais Globais
        const agg = await prisma.aiGenerationMetadata.aggregate({
            _sum: {
                costUsd: true,
                promptTokens: true,
                completionTokens: true,
            },
            _avg: {
                criticScore: true,
                generationTimeMs: true,
            },
            _count: {
                id: true,
            }
        });

        // 2. Cache Stats
        const cacheAgg = await prisma.semanticCacheEntry.aggregate({
            _sum: {
                hitCount: true,
            },
            _count: {
                id: true,
            }
        });

        // 3. Distribuição por Pipeline
        const pipelineGroup = await prisma.aiGenerationMetadata.groupBy({
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
                criticScore: true,
            }
        });

        // 4. Dados Temporais (Últimos 7 dias)
        // Usamos queryRaw para fazer truncamento de data de forma performática
        const timeSeriesRaw = await prisma.$queryRaw<Array<{
            date: string;
            totalCost: number;
            avgScore: number;
            count: number;
        }>>`
            SELECT 
                TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as "date",
                COALESCE(SUM("costUsd"), 0) as "totalCost",
                COALESCE(AVG("criticScore"), 0) as "avgScore",
                COUNT(id)::int as "count"
            FROM "AiGenerationMetadata"
            WHERE "createdAt" >= ${sevenDaysAgo}
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY "date" ASC
        `;

        // Formatar o retorno
        return NextResponse.json({
            summary: {
                totalCostUsd: agg._sum.costUsd || 0,
                totalGenerations: agg._count.id || 0,
                avgCriticScore: agg._avg.criticScore || 0,
                avgGenerationTimeMs: agg._avg.generationTimeMs || 0,
                totalTokens: (agg._sum.promptTokens || 0) + (agg._sum.completionTokens || 0),
            },
            cache: {
                totalHits: cacheAgg._sum.hitCount || 0,
                totalEntries: cacheAgg._count.id || 0,
            },
            pipelines: pipelineGroup.map(p => ({
                name: p.pipeline,
                costUsd: p._sum.costUsd || 0,
                count: p._count.id || 0,
                avgTime: p._avg.generationTimeMs || 0,
                avgScore: p._avg.criticScore || 0,
                totalTokens: (p._sum.promptTokens || 0) + (p._sum.completionTokens || 0),
            })),
            timeSeries: timeSeriesRaw.map(t => ({
                date: t.date, // YYYY-MM-DD
                totalCost: Number(t.totalCost),
                avgScore: Number(t.avgScore),
                count: Number(t.count)
            }))
        });

    } catch (error) {
        console.error("[AI_METRICS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
