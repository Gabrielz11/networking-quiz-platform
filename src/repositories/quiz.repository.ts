import { prisma } from "@/lib/prisma";
import { Prisma, Difficulty } from "@prisma/client";

export class QuizRepository {
    async findSessionById(id: string) {
        return prisma.quizSession.findUnique({
            where: { id },
            include: {
                module: true,
                questions: true
            }
        });
    }

    async createSession(data: Prisma.QuizSessionCreateInput) {
        return prisma.quizSession.create({ data });
    }

    async updateSessionLevel(id: string, currentLevel: Difficulty, errorsInCurrentLevel: number) {
        return prisma.quizSession.update({
            where: { id },
            data: { 
                currentLevel,
                errorsInCurrentLevel
            }
        });
    }

    async completeSession(id: string, score: number) {
        return prisma.quizSession.update({
            where: { id },
            data: { 
                status: "COMPLETED",
                score
            }
        });
    }

    async createQuestionInstance(data: Prisma.QuestionInstanceCreateInput) {
        return prisma.questionInstance.create({ data });
    }

    async updateQuestionAnswer(id: string, studentAnswer: number, isCorrect: boolean) {
        return prisma.questionInstance.update({
            where: { id },
            data: { 
                studentAnswer,
                isCorrect
            }
        });
    }

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
    }) {
        return prisma.$transaction([
            prisma.questionInstance.update({
                where: { id: input.questionId },
                data: {
                    studentAnswer: input.studentAnswer,
                    isCorrect: input.isCorrect
                }
            }),
            prisma.quizSession.update({
                where: { id: input.sessionId },
                data: {
                    currentLevel: input.nextLevel,
                    errorsInCurrentLevel: input.nextErrors,
                    score: input.newScore,
                    currentQuestionIndex: input.nextIndex,
                    status: input.status
                }
            })
        ]);
    }
}

export const quizRepository = new QuizRepository();
