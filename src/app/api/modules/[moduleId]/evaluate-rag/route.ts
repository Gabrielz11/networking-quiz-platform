// src/app/api/modules/[moduleId]/evaluate-rag/route.ts
// POST: Dispara manualmente a reavaliação RAGAS (Faithfulness) do conteúdo do módulo.

import { NextResponse } from "next/server";
import { requireRole, handleAuthError, AuthError } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { computeContentHash } from "@/lib/rag/eval/hash.utils";
import { enqueueRagEvaluation } from "@/lib/rag/jobs/queues/evaluation-queue";
import { getVectorStore } from "@/lib/rag/core/vector-store";
import { env } from "@/lib/env";
import { Logger } from "@/lib/logger";

const logger = new Logger("evaluate-rag-route");

export async function POST(
    _request: Request,
    context: { params: Promise<{ moduleId: string }> }
) {
    try {
        await requireRole("TEACHER");

        const { moduleId } = await context.params;

        const moduleRecord = await prisma.module.findUnique({
            where: { id: moduleId },
        });

        if (!moduleRecord || !moduleRecord.content) {
            return NextResponse.json(
                { error: "Módulo não encontrado ou sem conteúdo gerado." },
                { status: 404 }
            );
        }

        const contentHash = computeContentHash(moduleRecord.content);

        // Verificar se já existe um registro de avaliação para este mesmo contentHash com sourceChunkIds gravados
        const existingEval = await prisma.ragEvaluation.findUnique({
            where: {
                moduleId_metric_contentHash: {
                    moduleId,
                    metric: "faithfulness",
                    contentHash,
                },
            },
        });

        const existingDetails = existingEval?.details as { sourceChunkIds?: string[] } | null;
        let sourceChunkIds: string[] = [];

        if (existingDetails?.sourceChunkIds && Array.isArray(existingDetails.sourceChunkIds) && existingDetails.sourceChunkIds.length > 0) {
            sourceChunkIds = existingDetails.sourceChunkIds;
            logger.info("POST", "Reutilizando sourceChunkIds da avaliação/geração original para conteúdo não alterado", {
                moduleId,
                contentHash: contentHash.slice(0, 12),
                chunksCount: sourceChunkIds.length,
            });
        } else {
            // Buscar chunks de contexto do vector store caso não existam no registro prévio
            const vectorStore = getVectorStore();
            const searchQuery = `${moduleRecord.title} ${moduleRecord.description ?? ""}`.trim() || "conceitos principais";
            const contextChunks = await vectorStore.searchSimilar({
                moduleId,
                query: searchQuery,
                limit: env.RAG_FINAL_CONTEXT_LIMIT,
            });

            if (contextChunks.length === 0) {
                return NextResponse.json(
                    { error: "Não há materiais de estudo processados para este módulo." },
                    { status: 400 }
                );
            }

            sourceChunkIds = contextChunks.map((c) => c.id);
        }

        // Política de Reavaliação V1: reutilizar o mesmo registro RagEvaluation se já existir para o mesmo contentHash,
        // realizando o ciclo COMPLETED -> PENDING -> PROCESSING -> COMPLETED
        const evaluation = await prisma.ragEvaluation.upsert({
            where: {
                moduleId_metric_contentHash: {
                    moduleId,
                    metric: "faithfulness",
                    contentHash,
                },
            },
            create: {
                moduleId,
                metric: "faithfulness",
                contentHash,
                status: "PENDING",
                details: { sourceChunkIds },
            },
            update: {
                status: "PENDING",
                score: null,
                error: null,
                startedAt: null,
                finishedAt: null,
                details: { sourceChunkIds },
            },
        });

        await enqueueRagEvaluation({
            evaluationId: evaluation.id,
            moduleId,
            contentHash,
            sourceChunkIds,
        });

        logger.info("POST", "Reavaliação manual disparada pelo professor", {
            moduleId,
            evaluationId: evaluation.id,
            contentHash: contentHash.slice(0, 12),
        });

        return NextResponse.json({
            success: true,
            message: "Reavaliação enfileirada com sucesso.",
            evaluationId: evaluation.id,
            status: "PENDING",
        });

    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }
        logger.error("POST", "Falha ao solicitar reavaliação", {
            error: (error as { message?: string }).message,
        });
        return NextResponse.json(
            { error: "Falha ao solicitar reavaliação RAGAS." },
            { status: 500 }
        );
    }
}
