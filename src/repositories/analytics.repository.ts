import { prisma } from "@/lib/prisma";

export interface RawDifficultyAccuracy {
    difficultyLevel: string;
    correctCount: number;
}

export interface RawTopicWeakness {
    moduleId: string;
    total: number;
    correct: number;
    accuracy: number;
}

export interface RawRecentTrend {
    date: string;
    totalAnswers: number;
    correctAnswers: number;
}

export class AnalyticsRepository {
    /** Busca agregações globais da telemetria (total de respostas e tempo médio de resposta). */
    async getGlobalTelemetryAggregates() {
        const agg = await prisma.studentQuizTelemetry.aggregate({
            _count: { id: true },
            _avg: { responseTimeMs: true },
        });

        const correctCount = await prisma.studentQuizTelemetry.count({
            where: { isCorrect: true },
        });

        return {
            total: agg._count.id,
            avgResponseTimeMs: agg._avg.responseTimeMs || 0,
            correctCount,
        };
    }

    /** Busca a contagem e média de tempo por dificuldade via Prisma groupBy. */
    async getTelemetryGroupedByDifficulty() {
        return prisma.studentQuizTelemetry.groupBy({
            by: ["difficultyLevel"],
            _count: { id: true },
            _avg: { responseTimeMs: true },
        });
    }

    /** Busca a quantidade de acertos por dificuldade via SQL cru. */
    async getAccuracyByDifficultyRaw(): Promise<RawDifficultyAccuracy[]> {
        return prisma.$queryRaw<RawDifficultyAccuracy[]>`
            SELECT "difficultyLevel", COUNT(id)::int as "correctCount"
            FROM "StudentQuizTelemetry"
            WHERE "isCorrect" = true
            GROUP BY "difficultyLevel"
        `;
    }

    /** Busca os tópicos/módulos com menor taxa de acerto via SQL cru. */
    async getRawTopicWeaknesses(limit = 5): Promise<RawTopicWeakness[]> {
        return prisma.$queryRaw<RawTopicWeakness[]>`
            SELECT 
                "moduleId",
                COUNT(id)::int as "total",
                SUM(CASE WHEN "isCorrect" = true THEN 1 ELSE 0 END)::int as "correct",
                (SUM(CASE WHEN "isCorrect" = true THEN 1.0 ELSE 0.0 END) / COUNT(id))::float as "accuracy"
            FROM "StudentQuizTelemetry"
            GROUP BY "moduleId"
            HAVING COUNT(id) > 0
            ORDER BY "accuracy" ASC
            LIMIT ${limit}
        `;
    }

    /** Busca títulos dos módulos pelo ID. */
    async getModuleTitlesByIds(moduleIds: string[]) {
        if (moduleIds.length === 0) return [];

        return prisma.module.findMany({
            where: { id: { in: moduleIds } },
            select: { id: true, title: true },
        });
    }

    /** Busca a série temporal de respostas dos últimos N dias via SQL cru. */
    async getRecentTrendsRaw(since: Date): Promise<RawRecentTrend[]> {
        return prisma.$queryRaw<RawRecentTrend[]>`
            SELECT 
                TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as "date",
                COUNT(id)::int as "totalAnswers",
                SUM(CASE WHEN "isCorrect" = true THEN 1 ELSE 0 END)::int as "correctAnswers"
            FROM "StudentQuizTelemetry"
            WHERE "createdAt" >= ${since}
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY "date" ASC
        `;
    }
}

export const analyticsRepository = new AnalyticsRepository();
