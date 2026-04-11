import { NextResponse } from "next/server";
import { ContentLlmService } from "@/services/llm/content-llm.service";

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
        console.error("Erro na geração de conteúdo:", error);
        return NextResponse.json({ error: "Falha ao gerar conteúdo via IA" }, { status: 500 });
    }
}
