import { NextResponse } from "next/server";
import { QuizQuestionGenerationService } from "@/services/generation/quiz-question-generation.service";
import { Logger } from "@/lib/logger";
import { isRateLimited } from "@/lib/rate-limit";
import { requireUser, handleAuthError, AuthError } from "@/lib/auth-guard";
import { quizRepository } from "@/repositories/quiz.repository";
import { z } from "zod";

const logger = new Logger("QuizGenerateQuestionRoute");

const BodySchema = z.object({
    sessionId: z.string().min(1, "sessionId é obrigatório"),
});

export async function POST(req: Request) {
    const start = Date.now();
    try {
        // P2.1 — Usa helper central de autenticação
        const user = await requireUser();

        const isLimited = await isRateLimited(user.id!, "generate-question", { limit: 10, windowSeconds: 300 });
        if (isLimited) {
            logger.warn("POST", "Rate limit atingido para geração de questão", { userId: user.id });
            return NextResponse.json(
                { error: "Limite de solicitações atingido. Por favor, aguarde alguns minutos antes de solicitar outra questão." },
                { status: 429 }
            );
        }

        const parsed = BodySchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Parâmetro sessionId é obrigatório e deve ser uma string válida." },
                { status: 400 }
            );
        }

        const { sessionId } = parsed.data;

        logger.info("POST", "Gerando próxima questão adaptativa", { userId: user.id, sessionId });

        // P2.1 — Usa repository em vez de prisma direto
        const session = await quizRepository.findSessionById(sessionId);

        if (!session) {
            return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
        }

        if (session.userId !== user.id) {
            return NextResponse.json({ error: "Acesso negado à sessão." }, { status: 403 });
        }

        if (session.status === "COMPLETED") {
            return NextResponse.json({ error: "O quiz já foi finalizado." }, { status: 400 });
        }

        const pendingQuestions = session.questions.filter((q) => q.studentAnswer === null);
        if (pendingQuestions.length > 0) {
            const existingQuestion = pendingQuestions[pendingQuestions.length - 1];
            // Omite correctOptionIndex e explanation para evitar trapaça
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { correctOptionIndex: _ci1, explanation: _ex1, ...safeQuestion } = existingQuestion;
            return NextResponse.json({ success: true, question: safeQuestion });
        }

        const difficulty = session.currentLevel;
        const moduleContent = session.module.content;
        const previousPrompts = session.questions.map((q) => q.prompt);

        const qData = await QuizQuestionGenerationService.generate(
            difficulty,
            moduleContent,
            previousPrompts,
            session.moduleId,
            session.id
        );

        // P2.1 — Usa repository para criar QuestionInstance
        const newQuestion = await quizRepository.createQuestionInstance({
            session: { connect: { id: session.id } },
            difficulty: session.currentLevel,
            prompt: qData.prompt,
            options: qData.options,
            correctOptionIndex: qData.correct_option_index,
            explanation: qData.explanation,
        });

        // Omite correctOptionIndex e explanation para evitar trapaça
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { correctOptionIndex: _ci2, explanation: _ex2, ...safeQuestion } = newQuestion;

        logger.info("POST", "Questão gerada pela IA e salva", {
            userId: user.id,
            sessionId,
            questionId: newQuestion.id,
            difficulty: session.currentLevel,
            durationMs: Date.now() - start,
        });

        return NextResponse.json({ success: true, question: safeQuestion });

    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }

        logger.error("POST", "Falha na geração dinâmica da questão", {
            message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Falha na geração da questão." }, { status: 500 });
    }
}
