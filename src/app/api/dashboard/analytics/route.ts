import { NextResponse } from "next/server";
import { AnalyticsQueryService } from "@/services/analytics/analytics-query.service";
import { auth } from "@/auth";

export async function GET() {
    try {
        const session = await auth();
        
        // Verifica se é professor (admin)
        if (!session?.user || (session.user as any).role !== "TEACHER") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const [global, difficulty, weaknesses, trends] = await Promise.all([
            AnalyticsQueryService.getGlobalMetrics(),
            AnalyticsQueryService.getMetricsByDifficulty(),
            AnalyticsQueryService.getTopicWeaknesses(),
            AnalyticsQueryService.getRecentTrends()
        ]);

        return NextResponse.json({
            global,
            difficulty,
            weaknesses,
            trends
        });

    } catch (error) {
        console.error("[ANALYTICS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
