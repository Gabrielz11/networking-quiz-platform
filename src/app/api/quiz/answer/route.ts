import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { QuizService } from "@/services/quiz.service";
import { ScoreService } from "@/services/score.service";
import { ActivityService } from "@/services/activity.service";
import { z } from "zod";
import { Logger } from "@/lib/logger";
import {
    getCachedIdempotentResponse,
    cacheIdempotentResponse,
    acquireIdempotencyLock,
    releaseIdempotencyLock
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
            const cachedResponse = await getCachedIdempotentResponse(idempotencyKey);
            if (cachedResponse) {
                logger.info("POST", "Retornando resposta idempotente cacheada", {
                    userId: sessionReq.user.id,
                    idempotencyKey
                });
                return NextResponse.json(cachedResponse.body, { status: cachedResponse.status });
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
            return NextResponse.json(
                { error: "Parâmetros inválidos ou ausentes.", details: parsed.error.flatten().fieldErrors },
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
            include: { questions: true }
        });

        if (!session) {
            return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
        }

        if (session.userId !== sessionReq.user.id) {
            return NextResponse.json({ error: "Acesso negado à sessão." }, { status: 403 });
        }

        if (session.status === "COMPLETED") {
            return NextResponse.json({ error: "O quiz já foi finalizado." }, { status: 400 });
        }

        // Verify if the question instance exists and hasn't been answered yet
        const question = session.questions.find(q => q.id === questionId);

        if (!question) {
            return NextResponse.json({ error: "Questão não encontrada nesta sessão." }, { status: 404 });
        }

        if (question.studentAnswer !== null) {
            return NextResponse.json({ error: "A questão já foi respondida." }, { status: 400 });
        }

        // Answer analysis
        const isCorrect = studentAnswerIndex === question.correctOptionIndex;

        // Lógica adaptativa delegada ao QuizService
        const { nextLevel, nextErrors } = QuizService.calculateAdaptiveProgression(
            session.currentLevel,
            session.errorsInCurrentLevel,
            isCorrect
        );

        const updatedScore = isCorrect ? session.score + 1 : session.score;
        const nextIndex = session.currentQuestionIndex + 1;
        const isCompleted = nextIndex >= 10;

        // Calcula tempo de resposta baseado em quando a questão foi instanciada
        const responseTimeMs = Date.now() - question.createdAt.getTime();

        // Transaction to ensure atomicity
        await prisma.$transaction([
            prisma.questionInstance.update({
                where: { id: question.id },
                data: {
                    studentAnswer: studentAnswerIndex,
                    isCorrect: isCorrect
                }
            }),
            prisma.quizSession.update({
                where: { id: session.id },
                data: {
                    currentLevel: nextLevel,
                    errorsInCurrentLevel: nextErrors,
                    score: updatedScore,
                    currentQuestionIndex: nextIndex,
                    status: isCompleted ? "COMPLETED" : "IN_PROGRESS"
                }
            }),
            prisma.studentQuizTelemetry.create({
                data: {
                    userId: sessionReq.user.id!,
                    moduleId: session.moduleId,
                    sessionId: session.id,
                    questionId: question.id,
                    responseTimeMs: Math.max(0, responseTimeMs),
                    isCorrect: isCorrect,
                    chosenOptionIndex: studentAnswerIndex,
                    difficultyLevel: question.difficulty
                }
            })
        ]);

        logger.info("POST", "Resposta processada com sucesso", {
            userId: sessionReq.user.id,
            sessionId,
            isCorrect,
            updatedScore,
            isCompleted,
            durationMs: Date.now() - start,
        });

        // Se o quiz foi concluído, registra nota e eventos de comportamento
        if (isCompleted) {
            const userId = sessionReq.user.id!;
            const moduleId = session.moduleId;

            // Todas as chamadas abaixo são não-bloqueantes
            ScoreService.registerCompletedSession(userId, moduleId, sessionId, updatedScore);
            ActivityService.logQuizComplete(userId, moduleId, sessionId, updatedScore);
            ActivityService.logScoreRecorded(userId, moduleId, sessionId, updatedScore);
        }

        const responseJson = {
            success: true,
            isCorrect: isCorrect,
            correctOptionIndex: question.correctOptionIndex,
            explanation: question.explanation,
            nextLevel,
            completed: isCompleted,
            newScore: updatedScore
        };

        if (idempotencyKey) {
            await cacheIdempotentResponse(idempotencyKey, 200, responseJson);
            await releaseIdempotencyLock(idempotencyKey);
        }

        return NextResponse.json(responseJson);

    } catch (error: any) {
        logger.error("POST", "Falha ao processar e salvar a resposta do estudante", {
            message: error.message || error
        });

        const idempotencyKey = req.headers.get("Idempotency-Key");
        if (idempotencyKey) {
            await releaseIdempotencyLock(idempotencyKey);
        }

        return NextResponse.json(
            { error: "Falha ao analisar resposta da questão." },
            { status: 500 }
        );
    }
}
