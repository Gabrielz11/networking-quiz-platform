// src/app/api/modules/[moduleId]/sources/[fileId]/process/route.ts
// POST: Dispara o processamento RAG de um arquivo (extração, chunking, embeddings, pgvector)

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { processSourceFile } from "@/lib/rag/rag-ingestion-service";

export async function POST(
    _request: Request,
    context: { params: Promise<{ moduleId: string; fileId: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { moduleId, fileId } = await context.params;

    try {
        const result = await processSourceFile({ moduleId, fileId });
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : "Falha ao processar o arquivo.",
            },
            { status: 500 }
        );
    }
}
