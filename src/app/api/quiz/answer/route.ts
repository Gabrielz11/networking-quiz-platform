import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { QuizService } from "@/services/quiz.service";

import { z } from "zod";

const AnswerSchema = z.object({
    sessionId: z.string().min(1, "ID da sessão é obrigatório"),
    questionId: z.string().min(1, "ID da questão é obrigatório"),
    studentAnswerIndex: z.number().int().min(0).max(3, "Índice de resposta deve ser entre 0 e 3"),
});

export async function POST(req: Request) {
    try {
        const sessionReq = await auth();
        if (!sessionReq?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
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
            })
        ]);

        return NextResponse.json({
            success: true,
            isCorrect: isCorrect,
            correctOptionIndex: question.correctOptionIndex,
            explanation: question.explanation,
            nextLevel,
            completed: isCompleted,
            newScore: updatedScore
        });

    } catch (error: any) {
        console.error("Answer Question Error:", error);
        return NextResponse.json(
            { error: "Falha ao analisar resposta da questão." },
            { status: 500 }
        );
    }
}
