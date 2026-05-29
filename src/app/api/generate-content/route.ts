import { NextResponse } from "next/server";
import { ModuleContentPreviewService } from "@/services/generation/module-content-preview.service";
import { Logger } from "@/lib/logger";
import { requireRole, handleAuthError, AuthError } from "@/lib/auth-guard";

const logger = new Logger("GenerateContentRoute");

export async function POST(req: Request) {
    try {
        // Rota de professor — geração de prévia de conteúdo antes de salvar o módulo
        await requireRole("TEACHER");

        const { title, description, studyMaterial } = await req.json();

        const hasStudyMaterial = studyMaterial && studyMaterial.trim().length > 0;

        if (!title && !hasStudyMaterial) {
            return NextResponse.json(
                { error: "Preencha o Título, o Resumo ou adicione algum Material de Estudo para usar o Assistente IA." },
                { status: 400 }
            );
        }

        const parsedData = await ModuleContentPreviewService.generate(title ?? "", description ?? "", studyMaterial);

        return NextResponse.json(parsedData);
    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }
        logger.error("POST", "Erro na geração rápida de conteúdo via IA", {
            message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Falha ao gerar conteúdo via IA" }, { status: 500 });
    }
}
