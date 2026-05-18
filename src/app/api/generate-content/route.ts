import { NextResponse } from "next/server";
import { ContentLlmService } from "@/services/llm/content-llm.service";
import { Logger } from "@/lib/logger";

const logger = new Logger("GenerateContentRoute");

export async function POST(req: Request) {
    try {
        const { title, description, studyMaterial } = await req.json();

        const hasStudyMaterial = studyMaterial && studyMaterial.trim().length > 0;

        if (!title && !hasStudyMaterial) {
            return NextResponse.json(
                { error: "Preencha o Título, o Resumo ou adicione algum Material de Estudo para usar o Assistente IA." },
                { status: 400 }
            );
        }

        const parsedData = await ContentLlmService.generate(title ?? "", description ?? "", studyMaterial);

        return NextResponse.json(parsedData);
    } catch (error: any) {
        logger.error("POST", "Erro na geração rápida de conteúdo via IA", {
            message: error.message || error
        });
        return NextResponse.json({ error: "Falha ao gerar conteúdo via IA" }, { status: 500 });
    }
}
