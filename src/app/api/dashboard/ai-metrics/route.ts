import { NextResponse } from "next/server";
import { requireRole, handleAuthError, AuthError } from "@/lib/auth-guard";
import { aiMetricsService } from "@/services/analytics/ai-metrics.service";

export async function GET() {
    try {
        // P0.1 — Usa helper central de autorização
        await requireRole("TEACHER");

        const data = await aiMetricsService.getDashboardMetrics();

        return NextResponse.json(data);
    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }
        console.error("[AI_METRICS_GET]", error);
        return new NextResponse("Erro interno no servidor.", { status: 500 });
    }
}
