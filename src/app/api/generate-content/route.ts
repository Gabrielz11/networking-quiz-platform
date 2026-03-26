import { NextResponse } from "next/server";
import { ContentLlmService } from "@/services/llm/content-llm.service";

export async function POST(req: Request) {
    try {
        const { title, description } = await req.json();

        if (!title) {
            return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
        }

        const parsedData = await ContentLlmService.generate(title, description);

        return NextResponse.json(parsedData);
    } catch (error: any) {
        console.error("Erro na geração de conteúdo:", error);
        return NextResponse.json({ error: "Falha ao gerar conteúdo via IA" }, { status: 500 });
    }
}
