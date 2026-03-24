import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
    try {
        const sessionReq = await auth();
        if (!sessionReq?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
        }

        const { sessionId, questionId, studentAnswerIndex } = await req.json();

        if (!sessionId || !questionId || studentAnswerIndex === undefined) {
            return NextResponse.json({ error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
        }

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

        // Adaptive logic progression (v3.0 PDR rules)
        let nextLevel = session.currentLevel;
        let nextErrors = 0; // Default: reset if level moves or correct

        if (isCorrect) {
            // Rule 1: Acerto: Sobe de nível IMEDIATAMENTE e LINEARMENTE
            nextErrors = 0; 
            if (session.currentLevel === "EASY") {
                nextLevel = "MEDIUM";
            } else if (session.currentLevel === "MEDIUM") {
                nextLevel = "HARD";
            } else {
                nextLevel = "HARD"; // Already at limit
            }
        } else {
            // Rule 2: Erro
            const currentErrors = session.errorsInCurrentLevel + 1;
            
            if (currentErrors >= 2) {
                // Rule 2.2: Segunda vez seguida de erro no mesmo nível: Cai para o nível anterior
                nextErrors = 0; // Reset counter AFTER drop
                if (session.currentLevel === "HARD") nextLevel = "MEDIUM";
                else if (session.currentLevel === "MEDIUM") nextLevel = "EASY";
                else nextLevel = "EASY";
            } else {
                // Rule 2.1: Primeira vez no nível: Mantém o nível atual.
                nextLevel = session.currentLevel;
                nextErrors = currentErrors;
            }
        }

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
            { error: "Falha ao analisar resposta da questão.", details: error.message },
            { status: 500 }
        );
    }
}
