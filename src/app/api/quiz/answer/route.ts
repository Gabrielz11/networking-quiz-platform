import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
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

const logger = new Logger("QuizAnswerRoute");

const AnswerSchema = z.object({
    sessionId: z.string().min(1, "ID da sessão é obrigatório"),
    questionId: z.string().min(1, "ID da questão é obrigatório"),
    studentAnswerIndex: z.number().int().min(0).max(3, "Índice de resposta deve ser entre 0 e 3"),
});

export async function POST(req: Request) {
    const start = Date.now();

    try {
        const sessionReq = await auth();
        if (!sessionReq?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
        }

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
            userId: sessionReq.user.id,
            sessionId,
            questionId,
        });

        const session = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            include: { questions: true },
        });

        if (!session) {
            if (idempotencyKey) await releaseIdempotencyLock(idempotencyKey);
            return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
        }

        if (session.userId !== sessionReq.user.id) {
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

        if (question.studentAnswer !== null) {
            if (idempotencyKey) await releaseIdempotencyLock(idempotencyKey);
            return NextResponse.json({ error: "A questão já foi respondida." }, { status: 400 });
        }

        const isCorrect = studentAnswerIndex === question.correctOptionIndex;

        const { nextLevel, nextErrors } = QuizProgressionService.calculateAdaptiveProgression(
            session.currentLevel,
            session.errorsInCurrentLevel,
            isCorrect
        );

        const updatedScore = isCorrect ? session.score + 1 : session.score;
        const nextIndex = session.currentQuestionIndex + 1;
        const isCompleted = nextIndex >= 10;
        const responseTimeMs = Date.now() - question.createdAt.getTime();

        await prisma.$transaction([
            prisma.questionInstance.update({
                where: { id: question.id },
                data: { studentAnswer: studentAnswerIndex, isCorrect },
            }),
            prisma.quizSession.update({
                where: { id: session.id },
                data: {
                    currentLevel: nextLevel,
                    errorsInCurrentLevel: nextErrors,
                    score: updatedScore,
                    currentQuestionIndex: nextIndex,
                    status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
                },
            }),
            prisma.studentQuizTelemetry.create({
                data: {
                    userId: sessionReq.user.id!,
                    moduleId: session.moduleId,
                    sessionId: session.id,
                    questionId: question.id,
                    responseTimeMs: Math.max(0, responseTimeMs),
                    isCorrect,
                    chosenOptionIndex: studentAnswerIndex,
                    difficultyLevel: question.difficulty,
                },
            }),
        ]);

        logger.info("POST", "Resposta processada com sucesso", {
            userId: sessionReq.user.id,
            sessionId,
            isCorrect,
            updatedScore,
            isCompleted,
            durationMs: Date.now() - start,
        });

        // Registra eventos não-bloqueantes se quiz completado
        if (isCompleted) {
            const userId = sessionReq.user.id!;
            ScoreService.registerCompletedSession(userId, session.moduleId, sessionId, updatedScore);
            ActivityService.logQuizComplete(userId, session.moduleId, sessionId, updatedScore);
            ActivityService.logScoreRecorded(userId, session.moduleId, sessionId, updatedScore);
        }

        const responseJson = {
            success: true,
            isCorrect,
            correctOptionIndex: question.correctOptionIndex,
            // Explicação base da DB — exibida imediatamente para respostas corretas.
            // Para respostas erradas, o frontend também usa /api/explain para a versão personalizada em streaming.
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

    } catch (error: any) {
        logger.error("POST", "Falha ao processar resposta do estudante", { message: error.message });

        const idempotencyKey = req.headers.get("Idempotency-Key");
        if (idempotencyKey) await releaseIdempotencyLock(idempotencyKey).catch(() => {});

        return NextResponse.json(
            { error: "Falha ao analisar resposta da questão." },
            { status: 500 }
        );
    }
}
