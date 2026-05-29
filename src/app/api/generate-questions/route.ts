import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BatchQuizGenerationService } from "@/services/generation/batch-quiz-generation.service";
import { Logger } from "@/lib/logger";
import { requireRole, handleAuthError, AuthError } from "@/lib/auth-guard";

const logger = new Logger("GenerateQuestionsRoute");

const BodySchema = z.object({
    moduleId: z.string().min(1, "moduleId é obrigatório"),
    title: z.string().min(1, "title é obrigatório"),
    content: z.string().min(1, "content é obrigatório"),
});

export async function POST(req: Request) {
    try {
        // P0.2 — Exige role TEACHER (lança 401 sem login, 403 com role errado)
        const user = await requireRole("TEACHER");

        // P0.2 — Validação do body com Zod
        const rawBody = await req.json();
        const parsed = BodySchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Parâmetros inválidos.", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { moduleId, title, content } = parsed.data;

        // P0.2 — Verificar ownership: o módulo deve pertencer ao professor autenticado
        const moduleRecord = await prisma.module.findUnique({
            where: { id: moduleId },
            select: { authorId: true },
        });

        if (!moduleRecord) {
            return NextResponse.json({ error: "Módulo não encontrado." }, { status: 404 });
        }

        if (moduleRecord.authorId !== user.id) {
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }

        // P1.2 — Gera as questões via IA ANTES de apagar as antigas.
        // Se a IA falhar, as questões antigas permanecem intactas.
        const questions = await BatchQuizGenerationService.generate(title, content, moduleId);

        const questionsData = questions.map((q) => ({
            moduleId,
            prompt: q.prompt,
            options: q.options,
            correctOptionIndex: q.correct_option_index,
            explanationBase: JSON.stringify({
                difficulty: q.difficulty,
                text: q.explanation_base,
            }),
        }));

        // P1.2 — deleteMany + createMany em uma única transação atômica.
        // Falha no insert faz rollback, preservando as questões antigas.
        const result = await prisma.$transaction(async (tx) => {
            await tx.question.deleteMany({ where: { moduleId } });
            return tx.question.createMany({ data: questionsData });
        });

        logger.info("POST", `Questões geradas e salvas em lote para o módulo ${moduleId}`, {
            count: result.count,
        });

        return NextResponse.json({ success: true, count: result.count });

    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }

        logger.error("POST", "Falha na geração ou gravação das questões", {
            message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Falha na geração das questões." },
            { status: 500 }
        );
    }
}
