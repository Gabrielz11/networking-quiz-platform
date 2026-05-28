import { prisma } from "@/lib/prisma";
import { Logger } from "@/lib/logger";

const logger = new Logger("AnalyticsQueryService");

export class AnalyticsQueryService {
    static async getGlobalMetrics() {
        const agg = await prisma.studentQuizTelemetry.aggregate({
            _count: { id: true },
            _avg: { responseTimeMs: true }
        });

        const correctCount = await prisma.studentQuizTelemetry.count({
            where: { isCorrect: true }
        });

        const total = agg._count.id;
        const accuracy = total > 0 ? correctCount / total : 0;
        const avgResponseTime = agg._avg.responseTimeMs || 0;

        return {
            totalAnswers: total,
            accuracy,
            avgResponseTimeMs: avgResponseTime,
        };
    }

    static async getMetricsByDifficulty() {
        const grouped = await prisma.studentQuizTelemetry.groupBy({
            by: ['difficultyLevel'],
            _count: { id: true },
            _avg: { responseTimeMs: true },
        });

        // Trazendo dados de acerto por dificuldade (group by no prisma requer 2 queries para isso ou raw SQL)
        const rawAccuracy = await prisma.$queryRaw<Array<{
            difficultyLevel: string;
            correctCount: number;
        }>>`
            SELECT "difficultyLevel", COUNT(id)::int as "correctCount"
            FROM "StudentQuizTelemetry"
            WHERE "isCorrect" = true
            GROUP BY "difficultyLevel"
        `;

        const accuracyMap = new Map(rawAccuracy.map(r => [r.difficultyLevel, r.correctCount]));

        return grouped.map(g => {
            const correctCount = accuracyMap.get(g.difficultyLevel) || 0;
            const accuracy = g._count.id > 0 ? correctCount / g._count.id : 0;
            return {
                difficulty: g.difficultyLevel,
                total: g._count.id,
                avgResponseTimeMs: g._avg.responseTimeMs || 0,
                accuracy,
            };
        });
    }

    static async getTopicWeaknesses() {
        // Módulos com menor taxa de acerto
        const rawWeaknesses = await prisma.$queryRaw<Array<{
            moduleId: string;
            total: number;
            correct: number;
            accuracy: number;
        }>>`
            SELECT 
                "moduleId",
                COUNT(id)::int as "total",
                SUM(CASE WHEN "isCorrect" = true THEN 1 ELSE 0 END)::int as "correct",
                (SUM(CASE WHEN "isCorrect" = true THEN 1.0 ELSE 0.0 END) / COUNT(id))::float as "accuracy"
            FROM "StudentQuizTelemetry"
            GROUP BY "moduleId"
            HAVING COUNT(id) > 0
            ORDER BY "accuracy" ASC
            LIMIT 5
        `;

        if (rawWeaknesses.length === 0) return [];

        const moduleIds = rawWeaknesses.map(w => w.moduleId);
        const modules = await prisma.module.findMany({
            where: { id: { in: moduleIds } },
            select: { id: true, title: true }
        });

        const moduleMap = new Map(modules.map(m => [m.id, m.title]));

        return rawWeaknesses.map(w => ({
            moduleId: w.moduleId,
            moduleTitle: moduleMap.get(w.moduleId) || "Módulo Excluído",
            totalAnswers: w.total,
            accuracy: w.accuracy,
        }));
    }

    static async getRecentTrends() {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const timeSeriesRaw = await prisma.$queryRaw<Array<{
            date: string;
            totalAnswers: number;
            correctAnswers: number;
        }>>`
            SELECT 
                TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as "date",
                COUNT(id)::int as "totalAnswers",
                SUM(CASE WHEN "isCorrect" = true THEN 1 ELSE 0 END)::int as "correctAnswers"
            FROM "StudentQuizTelemetry"
            WHERE "createdAt" >= ${fourteenDaysAgo}
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY "date" ASC
        `;

        return timeSeriesRaw.map(t => ({
            date: t.date,
            totalAnswers: t.totalAnswers,
            accuracy: t.totalAnswers > 0 ? t.correctAnswers / t.totalAnswers : 0,
        }));
    }
}
