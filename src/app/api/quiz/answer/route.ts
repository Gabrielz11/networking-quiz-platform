import { NextResponse } from "next/server";
import { QuizProgressionService } from "@/services/quiz-progression.service";
import { ScoreService } from "@/services/score.service";
import { ActivityService } from "@/services/activity.service";
import { z } from "zod";
import { Logger } from "@/lib/logger";
import {
    getCachedIdempotentResponse,
    cacheIdempotentResponse,
    acquireIdempotencyLock,
    releaseIdempotencyLock,
} from "@/lib/idempotency";
import { requireUser, handleAuthError, AuthError } from "@/lib/auth-guard";
import { quizRepository, AlreadyAnsweredError } from "@/repositories/quiz.repository";
import { QUIZ_QUESTION_LIMIT } from "@/lib/quiz-config";

const logger = new Logger("QuizAnswerRoute");

const AnswerSchema = z.object({
    sessionId: z.string().min(1, "ID da sessão é obrigatório"),
    questionId: z.string().min(1, "ID da questão é obrigatório"),
    studentAnswerIndex: z.number().int().min(0).max(3, "Índice de resposta deve ser entre 0 e 3"),
});

export async function POST(req: Request) {
    const start = Date.now();

    try {
        // P2.1 — Usa helper central de autenticação
        const user = await requireUser();

        const idempotencyKey = req.headers.get("Idempotency-Key");

        if (idempotencyKey) {
            const cached = await getCachedIdempotentResponse(idempotencyKey);
            if (cached) {
                logger.info("POST", "Retornando resposta idempotente cacheada", { idempotencyKey });
                return NextResponse.json(cached.body, { status: cached.status });
            }

            const locked = await acquireIdempotencyLock(idempotencyKey);
            if (!locked) {
                return NextResponse.json(
                    { error: "Uma requisição idêntica já está em processamento." },
                    { status: 409 }
                );
            }
        }

        const body = await req.json();
        const parsed = AnswerSchema.safeParse(body);

        if (!parsed.success) {
            if (idempotencyKey) await releaseIdempotencyLock(idempotencyKey);
            return NextResponse.json(
                { error: "Parâmetros inválidos.", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { sessionId, questionId, studentAnswerIndex } = parsed.data;

        logger.info("POST", "Processando resposta do aluno", {
            userId: user.id,
            sessionId,
            questionId,
        });

        // P2.1 — Usa repository em vez de prisma direto
        const session = await quizRepository.findSessionById(sessionId);

        if (!session) {
            if (idempotencyKey) await releaseIdempotencyLock(idempotencyKey);
            return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
        }

        if (session.userId !== user.id) {
            if (idempotencyKey) await releaseIdempotencyLock(idempotencyKey);
            return NextResponse.json({ error: "Acesso negado à sessão." }, { status: 403 });
        }

        if (session.status === "COMPLETED") {
            if (idempotencyKey) await releaseIdempotencyLock(idempotencyKey);
            return NextResponse.json({ error: "O quiz já foi finalizado." }, { status: 400 });
        }

        const question = session.questions.find((q) => q.id === questionId);
        if (!question) {
            if (idempotencyKey) await releaseIdempotencyLock(idempotencyKey);
            return NextResponse.json({ error: "Questão não encontrada nesta sessão." }, { status: 404 });
        }

        const isCorrect = studentAnswerIndex === question.correctOptionIndex;

        const { nextLevel, nextErrors } = QuizProgressionService.calculateAdaptiveProgression(
            session.currentLevel,
            session.errorsInCurrentLevel,
            isCorrect
        );

        const updatedScore = isCorrect ? session.score + 1 : session.score;
        const nextIndex = session.currentQuestionIndex + 1;
        // P3.1 — Usa constante em vez de magic number
        const isCompleted = nextIndex >= QUIZ_QUESTION_LIMIT;
        const responseTimeMs = Date.now() - question.createdAt.getTime();

        // P1.1 / P2.1 — Usa saveAnswerAndProgress do repository com updateMany condicional.
        // Garante que duas requisições paralelas à mesma questão resultem em exatamente
        // uma pontuação registrada (corretude não depende de Idempotency-Key).
        await quizRepository.saveAnswerAndProgress({
            sessionId: session.id,
            questionId: question.id,
            studentAnswer: studentAnswerIndex,
            isCorrect,
            nextLevel,
            nextErrors,
            newScore: updatedScore,
            nextIndex,
            status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
            userId: user.id!,
            moduleId: session.moduleId,
            responseTimeMs,
            difficultyLevel: question.difficulty,
        });

        logger.info("POST", "Resposta processada com sucesso", {
            userId: user.id,
            sessionId,
            isCorrect,
            updatedScore,
            isCompleted,
            durationMs: Date.now() - start,
        });

        if (isCompleted) {
            const userId = user.id!;
            ScoreService.registerCompletedSession(userId, session.moduleId, sessionId, updatedScore);
            ActivityService.logQuizComplete(userId, session.moduleId, sessionId, updatedScore);
            ActivityService.logScoreRecorded(userId, session.moduleId, sessionId, updatedScore);
        }

        const responseJson = {
            success: true,
            isCorrect,
            correctOptionIndex: question.correctOptionIndex,
            explanation: question.explanation,
            nextLevel,
            completed: isCompleted,
            newScore: updatedScore,
        };

        if (idempotencyKey) {
            await cacheIdempotentResponse(idempotencyKey, 200, responseJson);
            await releaseIdempotencyLock(idempotencyKey);
        }

        return NextResponse.json(responseJson);

    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }

        // P1.1 — Resposta já registrada por outra requisição concorrente → 409
        if (error instanceof AlreadyAnsweredError) {
            const idempotencyKey = req.headers.get("Idempotency-Key");
            if (idempotencyKey) await releaseIdempotencyLock(idempotencyKey).catch(() => {});
            return NextResponse.json({ error: "A questão já foi respondida." }, { status: 409 });
        }

        logger.error("POST", "Falha ao processar resposta do estudante", {
            message: error instanceof Error ? error.message : String(error),
        });

        const idempotencyKey = req.headers.get("Idempotency-Key");
        if (idempotencyKey) await releaseIdempotencyLock(idempotencyKey).catch(() => {});

        return NextResponse.json(
            { error: "Falha ao analisar resposta da questão." },
            { status: 500 }
        );
    }
}
