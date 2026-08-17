// src/app/api/dashboard/ai-quality/route.ts
// GET: Retorna dados consolidados e métricas de qualidade RAGAS para a tela do professor.

import { NextResponse } from "next/server";
import { requireRole, handleAuthError, AuthError } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { computeContentHash } from "@/lib/rag/eval/hash.utils";
import { Logger } from "@/lib/logger";

const logger = new Logger("ai-quality-route");

export async function GET() {
    try {
        await requireRole("TEACHER");

        const modules = await prisma.module.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                evaluations: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
                sourceFiles: {
                    select: { id: true, fileName: true, status: true },
                },
            },
        });

        const items = modules.map((mod) => {
            const currentHash = computeContentHash(mod.content || "");
            const latestEval = mod.evaluations[0] || null;

            // Se o hash do conteúdo atual for diferente do hash avaliado, o status é OUTDATED
            let effectiveStatus: string = latestEval?.status || "NOT_EVALUATED";
            let effectiveScore: number | null = latestEval?.score ?? null;

            if (latestEval && latestEval.status === "COMPLETED" && latestEval.contentHash !== currentHash) {
                effectiveStatus = "OUTDATED";
            }

            return {
                moduleId: mod.id,
                moduleTitle: mod.title,
                description: mod.description,
                hasSourceFiles: mod.sourceFiles.some((f) => f.status === "PROCESSED"),
                evaluationId: latestEval?.id || null,
                metric: latestEval?.metric || "faithfulness",
                score: effectiveScore,
                status: effectiveStatus,
                evaluatorVersion: latestEval?.evaluatorVersion || null,
                provider: latestEval?.provider || null,
                model: latestEval?.model || null,
                details: latestEval?.details || null,
                updatedAt: latestEval?.updatedAt || null,
                createdAt: mod.createdAt,
            };
        });

        // Métricas agregadas
        const completedItems = items.filter(
            (i) => i.status === "COMPLETED" && i.score !== null
        );

        const totalEvaluated = completedItems.length;
        const avgFaithfulness =
            totalEvaluated > 0
                ? completedItems.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalEvaluated
                : null;

        const trustedCount = completedItems.filter(
            (i) => (i.score || 0) >= env.RAG_EVALUATION_TRUSTED_THRESHOLD
        ).length;

        const reviewCount = completedItems.filter(
            (i) =>
                (i.score || 0) >= env.RAG_EVALUATION_REVIEW_THRESHOLD &&
                (i.score || 0) < env.RAG_EVALUATION_TRUSTED_THRESHOLD
        ).length;

        const attentionCount = completedItems.filter(
            (i) => (i.score || 0) < env.RAG_EVALUATION_REVIEW_THRESHOLD
        ).length;

        const outdatedCount = items.filter((i) => i.status === "OUTDATED").length;
        const pendingCount = items.filter(
            (i) => i.status === "PENDING" || i.status === "PROCESSING"
        ).length;

        return NextResponse.json({
            summary: {
                totalModules: modules.length,
                totalEvaluated,
                avgFaithfulness: avgFaithfulness !== null ? Math.round(avgFaithfulness * 100) : null,
                trustedCount,
                reviewCount,
                attentionCount,
                outdatedCount,
                pendingCount,
                thresholds: {
                    trusted: env.RAG_EVALUATION_TRUSTED_THRESHOLD,
                    review: env.RAG_EVALUATION_REVIEW_THRESHOLD,
                },
            },
            items,
        });

    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }
        logger.error("GET", "Falha ao carregar métricas de qualidade", {
            error: (error as { message?: string }).message,
        });
        return NextResponse.json(
            { error: "Falha ao obter dados de qualidade da IA." },
            { status: 500 }
        );
    }
}
