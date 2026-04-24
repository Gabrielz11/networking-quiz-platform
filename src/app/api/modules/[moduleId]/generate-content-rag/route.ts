// src/app/api/modules/[moduleId]/generate-content-rag/route.ts
// POST: Gera conteúdo do módulo com base nos materiais RAG processados

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateModuleContentWithRag } from "@/lib/rag/module-content-generation-service";

export async function POST(
    _request: Request,
    context: { params: Promise<{ moduleId: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { moduleId } = await context.params;

    try {
        const result = await generateModuleContentWithRag({ moduleId });

        return NextResponse.json({
            content: result.module.content,
            description: result.module.description,
            usedChunks: result.usedChunks.length,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : "Falha ao gerar conteúdo com RAG.",
            },
            { status: 500 }
        );
    }
}
