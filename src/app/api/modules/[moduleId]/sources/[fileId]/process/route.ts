// src/app/api/modules/[moduleId]/sources/[fileId]/process/route.ts
// POST: Dispara o processamento RAG assíncrono de um arquivo via BullMQ/Redis

import { NextResponse } from "next/server";
import { z } from "zod";
import { processSourceFile } from "@/lib/rag/services/ingestion.service";
import { requireRole, handleAuthError, AuthError } from "@/lib/auth-guard";
import { moduleRepository } from "@/repositories/module.repository";
import { fileRepository } from "@/repositories/file.repository";
import { Logger } from "@/lib/logger";

const logger = new Logger("SourcesProcessRoute");

const paramsSchema = z.object({
    moduleId: z.string().cuid("moduleId inválido"),
    fileId: z.string().cuid("fileId inválido"),
});

export async function POST(
    _request: Request,
    context: { params: Promise<{ moduleId: string; fileId: string }> }
) {
    try {
        // P0.1 — Exige role TEACHER (401 sem login, 403 com role errado)
        const user = await requireRole("TEACHER");

        // P0.1 — Validação dos parâmetros de rota
        const rawParams = await context.params;
        const validatedParams = paramsSchema.safeParse(rawParams);
        if (!validatedParams.success) {
            return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
        }

        const { moduleId, fileId } = validatedParams.data;

        // P0.1 — Verificar ownership do módulo
        const moduleRecord = await moduleRepository.findById(moduleId);
        if (!moduleRecord) {
            return NextResponse.json({ error: "Módulo não encontrado." }, { status: 404 });
        }
        if (moduleRecord.authorId !== user.id) {
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }

        // P0.1 — Verificar que o arquivo pertence ao módulo antes de enfileirar
        const sourceFile = await fileRepository.findById(fileId);
        if (!sourceFile || sourceFile.moduleId !== moduleId) {
            return NextResponse.json({ error: "Arquivo não encontrado neste módulo." }, { status: 404 });
        }

        const result = await processSourceFile({ moduleId, fileId });
        return NextResponse.json(result);

    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }

        logger.error("POST", "Falha ao enfileirar processamento do arquivo", {
            message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Falha ao enfileirar o processamento do arquivo." },
            { status: 500 }
        );
    }
}
