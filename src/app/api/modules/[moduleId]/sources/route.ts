// src/app/api/modules/[moduleId]/sources/route.ts
// POST: Upload de arquivo de apoio para um módulo
// GET: Listar arquivos de apoio de um módulo

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Logger } from "@/lib/logger";

const logger = new Logger("SourcesRoute");

const ALLOWED_TYPES = ["application/pdf", "text/plain"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function GET(
    _request: Request,
    context: { params: Promise<{ moduleId: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { moduleId } = await context.params;

    const files = await prisma.moduleSourceFile.findMany({
        where: { moduleId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            originalName: true,
            mimeType: true,
            size: true,
            status: true,
            errorMessage: true,
            createdAt: true,
        },
    });

    return NextResponse.json(files);
}

export async function POST(
    request: Request,
    context: { params: Promise<{ moduleId: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { moduleId } = await context.params;

    // Validar se o módulo existe
    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) {
        return NextResponse.json({ error: "Módulo não encontrado." }, { status: 404 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Nenhum arquivo enviado para este módulo." }, { status: 400 });
        }

        // Validar tipo
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: `Este tipo de arquivo ainda não é suportado. Use PDF ou TXT.` },
                { status: 400 }
            );
        }

        // Validar tamanho
        if (file.size > MAX_SIZE_BYTES) {
            return NextResponse.json(
                { error: "O arquivo excede o limite de 10MB." },
                { status: 400 }
            );
        }

        // Criar diretório de upload
        const uploadBase = process.env.UPLOAD_DIR ?? "./storage/uploads";
        const uploadDir = join(process.cwd(), uploadBase, "modules", moduleId);
        await mkdir(uploadDir, { recursive: true });

        // Nome seguro (nunca usa o nome original do usuário como path)
        const timestamp = Date.now();
        const extension = file.type === "application/pdf" ? ".pdf" : ".txt";
        const safeFileName = `${timestamp}${extension}`;
        const storagePath = join(uploadDir, safeFileName);

        // Salvar arquivo
        const arrayBuffer = await file.arrayBuffer();
        await writeFile(storagePath, Buffer.from(arrayBuffer));

        // Criar registro no banco
        const sourceFile = await prisma.moduleSourceFile.create({
            data: {
                moduleId,
                fileName: safeFileName,
                originalName: file.name,
                mimeType: file.type,
                size: file.size,
                storagePath,
                status: "UPLOADED",
            },
        });

        logger.info("POST", "Arquivo enviado com sucesso", {
            fileId: sourceFile.id,
            moduleId,
            originalName: file.name,
        });

        return NextResponse.json(sourceFile, { status: 201 });
    } catch (error: any) {
        logger.error("POST", `Erro ao salvar arquivo: ${error.message}`);
        return NextResponse.json(
            { error: "Falha ao fazer upload do arquivo." },
            { status: 500 }
        );
    }
}
