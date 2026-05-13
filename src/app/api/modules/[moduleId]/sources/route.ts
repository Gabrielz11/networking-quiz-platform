// src/app/api/modules/[moduleId]/sources/route.ts
// POST: Upload de arquivo de apoio para um módulo
// GET: Listar arquivos de apoio de um módulo

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fileRepository } from "@/repositories/file.repository";
import { moduleRepository } from "@/repositories/module.repository";
import { StorageService } from "@/lib/storage";
import { Logger } from "@/lib/logger";
import { z } from "zod";

const logger = new Logger("SourcesRoute");

const ALLOWED_TYPES = ["application/pdf", "text/plain"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const paramsSchema = z.object({
    moduleId: z.string().cuid(),
});

export async function GET(
    _request: Request,
    context: { params: Promise<{ moduleId: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { moduleId } = await context.params;

    const files = await fileRepository.findByModuleId(moduleId);

    return NextResponse.json(files);
}

export async function POST(
    request: Request,
    context: { params: Promise<{ moduleId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const params = paramsSchema.safeParse(await context.params);
    if (!params.success) {
        return NextResponse.json({ error: "ID do módulo inválido." }, { status: 400 });
    }

    const { moduleId } = params.data;

    // Verificar se o módulo existe e se o usuário é o autor
    const module = await moduleRepository.findById(moduleId);
    if (!module) {
        return NextResponse.json({ error: "Módulo não encontrado." }, { status: 404 });
    }

    if (module.authorId !== session.user.id) {
        return NextResponse.json({ error: "Acesso negado. Você não é o autor deste módulo." }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "Tipo de arquivo não suportado. Use PDF ou TXT." }, { status: 400 });
        }

        if (file.size > MAX_SIZE_BYTES) {
            return NextResponse.json({ error: "O arquivo excede o limite de 10MB." }, { status: 400 });
        }

        // Salvar arquivo via StorageService
        const { storagePath, fileName } = await StorageService.saveFile(moduleId, file);

        const sourceFile = await fileRepository.create({
            module: { connect: { id: moduleId } },
            fileName,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
            storagePath,
            status: "UPLOADED",
        });

        logger.info("POST", "Arquivo enviado com sucesso", { fileId: sourceFile.id, moduleId });

        return NextResponse.json(sourceFile, { status: 201 });
    } catch (error: any) {
        logger.error("POST", `Erro ao salvar arquivo: ${error.message}`);
        return NextResponse.json({ error: "Falha ao fazer upload." }, { status: 500 });
    }
}
