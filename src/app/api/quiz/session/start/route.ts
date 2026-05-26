import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";
import { Logger } from "@/lib/logger";
import { ActivityService } from "@/services/activity.service";

const logger = new Logger("QuizSessionStartRoute");
export async function POST(req: Request) {
    const start = Date.now();
    try {
        const session = await auth();
        //aqui define que só o aluno logado pode iniciar o quiz
        if (!session?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
        }

        logger.info("POST", "Iniciando ou retomando sessão de quiz", {
            userId: session.user.id,
        });

        const schema = z.object({
            moduleId: z.string().min(1),
        });

        const parsed = schema.safeParse(await req.json());

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Faltam parâmetros obrigatórios." },
                { status: 400 }
            );
        }

        const body = parsed.data;

        // aqui ele verifica se o usuario já tem uma sessão em andamento se tiver ele traz a questão de onde ele parou
        const existingSession = await prisma.quizSession.findFirst({
            where: {
                userId: session.user.id,
                moduleId: body.moduleId,
                status: "IN_PROGRESS"
            },
            include: {
                questions: true
            }
        });
        //se existir uma sessão em andamento, retorna ela
        if (existingSession) {
            logger.info("POST", "Sessão em andamento retomada", {
                userId: session.user.id,
                moduleId: body.moduleId,
                sessionId: existingSession.id,
                durationMs: Date.now() - start,
            });
            return NextResponse.json({ success: true, quizSession: existingSession });
        }

        // Create a new session
        //aqui ele cria uma nova sessão
        //E já é possível ver as questões do módulo que o usuário vai responder.
        const newSession = await prisma.quizSession.create({
            data: {
                userId: session.user.id!,
                moduleId: body.moduleId,
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
        //retorna a nova sessão
        logger.info("POST", "Nova sessão de quiz criada", {
            userId: session.user.id,
            moduleId: body.moduleId,
            sessionId: newSession.id,
            durationMs: Date.now() - start,
        });

        // Registra o evento de início de quiz — não-bloqueante
        ActivityService.logQuizStart(session.user.id!, body.moduleId, newSession.id);

        return NextResponse.json({ success: true, quizSession: newSession });

    } catch (error: any) {
        logger.error("POST", "Falha ao iniciar ou retomar a sessão de quiz", {
            message: error.message || error
        });
        return NextResponse.json(
            { error: "Falha ao iniciar ou retomar a sessão de quiz.", details: error.message },
            { status: 500 }
        );
    }
}
