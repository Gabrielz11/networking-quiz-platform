import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
        }

        const { moduleId } = await req.json();

        if (!moduleId) {
            return NextResponse.json(
                { error: "Faltam parâmetros obrigatórios." },
                { status: 400 }
            );
        }

        // Check if there is already an IN_PROGRESS session for this user and module
        const existingSession = await prisma.quizSession.findFirst({
            where: {
                userId: session.user.id,
                moduleId: moduleId,
                status: "IN_PROGRESS"
            },
            include: {
                questions: true
            }
        });

        if (existingSession) {
            return NextResponse.json({ success: true, quizSession: existingSession });
        }

        // Create a new session
        const newSession = await prisma.quizSession.create({
            data: {
                userId: session.user.id!,
                moduleId: moduleId,
                status: "IN_PROGRESS",
                currentLevel: "EASY",
                errorsInCurrentLevel: 0,
                currentQuestionIndex: 0,
                score: 0
            },
            include: {
                questions: true
            }
        });

        return NextResponse.json({ success: true, quizSession: newSession });

    } catch (error: any) {
        console.error("Start Quiz Session Error:", error);
        return NextResponse.json(
            { error: "Falha ao iniciar ou retomar a sessão de quiz.", details: error.message },
            { status: 500 }
        );
    }
}
