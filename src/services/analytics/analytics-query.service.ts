import { analyticsRepository } from "@/repositories/analytics.repository";

export class AnalyticsQueryService {
    static async getGlobalMetrics() {
        const { total, avgResponseTimeMs, correctCount } = await analyticsRepository.getGlobalTelemetryAggregates();

        const accuracy = total > 0 ? correctCount / total : 0;

        return {
            totalAnswers: total,
            accuracy,
            avgResponseTimeMs,
        };
    }

    static async getMetricsByDifficulty() {
        const grouped = await analyticsRepository.getTelemetryGroupedByDifficulty();
        const rawAccuracy = await analyticsRepository.getAccuracyByDifficultyRaw();

        const accuracyMap = new Map(rawAccuracy.map((r) => [r.difficultyLevel, Number(r.correctCount || 0)]));

        return grouped.map((g) => {
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
        const rawWeaknesses = await analyticsRepository.getRawTopicWeaknesses(5);

        if (rawWeaknesses.length === 0) return [];

        const moduleIds = rawWeaknesses.map((w) => w.moduleId);
        const modules = await analyticsRepository.getModuleTitlesByIds(moduleIds);

        const moduleMap = new Map(modules.map((m) => [m.id, m.title]));

        return rawWeaknesses.map((w) => ({
            moduleId: w.moduleId,
            moduleTitle: moduleMap.get(w.moduleId) || "Módulo Excluído",
            totalAnswers: Number(w.total || 0),
            accuracy: Number(w.accuracy || 0),
        }));
    }

    static async getRecentTrends() {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const timeSeriesRaw = await analyticsRepository.getRecentTrendsRaw(fourteenDaysAgo);

        return timeSeriesRaw.map((t) => {
            const totalAnswers = Number(t.totalAnswers || 0);
            const correctAnswers = Number(t.correctAnswers || 0);
            return {
                date: t.date,
                totalAnswers,
                accuracy: totalAnswers > 0 ? correctAnswers / totalAnswers : 0,
            };
        });
    }
}
