import { prisma } from "@/lib/prisma";
import { Prisma, Difficulty } from "@prisma/client";

/** Lançada quando a resposta já foi registrada (proteção contra dupla-submissão). */
export class AlreadyAnsweredError extends Error {
    constructor() {
        super("A questão já foi respondida.");
        this.name = "AlreadyAnsweredError";
    }
}

export class QuizRepository {
    async findSessionById(id: string) {
        return prisma.quizSession.findUnique({
            where: { id },
            include: {
                module: true,
                questions: true,
            },
        });
    }

    /** Busca sessão IN_PROGRESS por usuário e módulo. */
    async findActiveSession(userId: string, moduleId: string) {
        return prisma.quizSession.findFirst({
            where: { userId, moduleId, status: "IN_PROGRESS" },
            include: { questions: true },
        });
    }

    async createSession(data: Prisma.QuizSessionCreateInput) {
        return prisma.quizSession.create({
            data,
            include: { questions: true },
        });
    }

    async updateSessionLevel(id: string, currentLevel: Difficulty, errorsInCurrentLevel: number) {
        return prisma.quizSession.update({
            where: { id },
            data: { currentLevel, errorsInCurrentLevel },
        });
    }

    async completeSession(id: string, score: number) {
        return prisma.quizSession.update({
            where: { id },
            data: { status: "COMPLETED", score },
        });
    }

    async createQuestionInstance(data: Prisma.QuestionInstanceCreateInput) {
        return prisma.questionInstance.create({ data });
    }

    async updateQuestionAnswer(id: string, studentAnswer: number, isCorrect: boolean) {
        return prisma.questionInstance.update({
            where: { id },
            data: { studentAnswer, isCorrect },
        });
    }

    /**
     * P1.1 — Gravação atômica e condicional de resposta + progresso de sessão + telemetria.
     *
     * Usa updateMany com guarda `studentAnswer: null` para garantir que duas requisições
     * concorrentes à mesma questão resultem em exatamente uma pontuação registrada.
     * Lança AlreadyAnsweredError se outra requisição já respondeu a questão.
     */
    async saveAnswerAndProgress(input: {
        sessionId: string;
        questionId: string;
        studentAnswer: number;
        isCorrect: boolean;
        nextLevel: Difficulty;
        nextErrors: number;
        newScore: number;
        nextIndex: number;
        status: "IN_PROGRESS" | "COMPLETED";
        // Campos de telemetria
        userId: string;
        moduleId: string;
        responseTimeMs: number;
        difficultyLevel: Difficulty;
    }) {
        return prisma.$transaction(async (tx) => {
            // Gravação condicional: só atualiza se studentAnswer ainda for null.
            // Garante atomicidade contra requisições paralelas sem depender do cliente.
            const updated = await tx.questionInstance.updateMany({
                where: { id: input.questionId, studentAnswer: null },
                data: { studentAnswer: input.studentAnswer, isCorrect: input.isCorrect },
            });

            if (updated.count === 0) {
                // Outra requisição já respondeu — aborta sem pontuar de novo.
                throw new AlreadyAnsweredError();
            }

            await tx.quizSession.update({
                where: { id: input.sessionId },
                data: {
                    currentLevel: input.nextLevel,
                    errorsInCurrentLevel: input.nextErrors,
                    score: input.newScore,
                    currentQuestionIndex: input.nextIndex,
                    status: input.status,
                },
            });

            await tx.studentQuizTelemetry.create({
                data: {
                    userId: input.userId,
                    moduleId: input.moduleId,
                    sessionId: input.sessionId,
                    questionId: input.questionId,
                    responseTimeMs: Math.max(0, input.responseTimeMs),
                    isCorrect: input.isCorrect,
                    chosenOptionIndex: input.studentAnswer,
                    difficultyLevel: input.difficultyLevel,
                },
            });
        });
    }
}

export const quizRepository = new QuizRepository();
