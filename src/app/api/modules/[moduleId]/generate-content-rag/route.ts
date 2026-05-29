// src/app/api/modules/[moduleId]/generate-content-rag/route.ts
// POST: Gera conteúdo do módulo com base nos materiais RAG usando ModuleContentRagService

import { NextResponse } from "next/server";
import { moduleContentRagService } from "@/services/generation/module-content-rag.service";
import { requireRole, handleAuthError, AuthError } from "@/lib/auth-guard";

export async function POST(
    _request: Request,
    context: { params: Promise<{ moduleId: string }> }
) {
    try {
        // Apenas professores podem regenerar conteúdo de módulo
        await requireRole("TEACHER");

        const { moduleId } = await context.params;

        const result = await moduleContentRagService.generateModuleContentWithRag({ moduleId });

        return NextResponse.json({
            content: result.module.content,
            description: result.module.description,
            usedChunks: result.usedChunks.length,
        });
    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }
        return NextResponse.json(
            { error: "Falha ao gerar conteúdo com RAG." },
            { status: 500 }
        );
    }
}
