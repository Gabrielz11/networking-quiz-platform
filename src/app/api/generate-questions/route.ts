import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { BatchLlmService } from "@/services/llm/batch-llm.service";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
        }

        const { moduleId, title, content } = await req.json();

        if (!moduleId || !title || !content) {
            return NextResponse.json(
                { error: "Faltam parâmetros obrigatórios." },
                { status: 400 }
            );
        }

        // Gera questões via BatchLlmService (AiService → Gemini + fallback Groq)
        const questions = await BatchLlmService.generate(title, content);

        // Limpar questões antigas via Prisma
        await prisma.question.deleteMany({
            where: { moduleId }
        });

        // Inserir as novas questões
        const createdQuestions = await Promise.all(questions.map((q) => {
            const serializedExplanation = JSON.stringify({
                difficulty: q.difficulty,
                text: q.explanation_base
            });

            return prisma.question.create({
                data: {
                    moduleId,
                    prompt: q.prompt,
                    options: q.options,
                    correctOptionIndex: q.correct_option_index,
                    explanationBase: serializedExplanation
                }
            });
        }));

        return NextResponse.json({ success: true, count: createdQuestions.length });

    } catch (error: any) {
        console.error("Generate Questions Error:", error);
        return NextResponse.json(
            { error: "Falha na geração das questões." },
            { status: 500 }
        );
    }
}
