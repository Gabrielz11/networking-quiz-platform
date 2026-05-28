import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { BatchQuizGenerationService } from "@/services/generation/batch-quiz-generation.service";
import { Logger } from "@/lib/logger";

const logger = new Logger("GenerateQuestionsRoute");

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
        const questions = await BatchQuizGenerationService.generate(title, content, moduleId);

        // Limpar questões antigas via Prisma
        await prisma.question.deleteMany({
            where: { moduleId }
        });

        // Inserir as novas questões em lote (Bulk Insert) de alta performance
        const questionsData = questions.map((q) => ({
            moduleId,
            prompt: q.prompt,
            options: q.options,
            correctOptionIndex: q.correct_option_index,
            explanationBase: JSON.stringify({
                difficulty: q.difficulty,
                text: q.explanation_base
            })
        }));

        const resultInsert = await prisma.question.createMany({
            data: questionsData
        });

        logger.info("POST", `Questões geradas e salvas em lote para o módulo ${moduleId}`, {
            count: resultInsert.count
        });

        return NextResponse.json({ success: true, count: resultInsert.count });

    } catch (error: any) {
        logger.error("POST", "Falha na geração ou gravação das questões", {
            message: error.message || error
        });
        return NextResponse.json(
            { error: "Falha na geração das questões." },
            { status: 500 }
        );
    }
}
