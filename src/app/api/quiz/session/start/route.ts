import { NextResponse } from "next/server";
import { z } from "zod";
import { Logger } from "@/lib/logger";
import { ActivityService } from "@/services/activity.service";
import { redis } from "@/lib/redis";
import { requireUser, handleAuthError, AuthError } from "@/lib/auth-guard";
import { quizRepository } from "@/repositories/quiz.repository";

const logger = new Logger("QuizSessionStartRoute");

const BodySchema = z.object({
    moduleId: z.string().min(1),
});

export async function POST(req: Request) {
    const start = Date.now();
    try {
        // P0.4 / P2.1 — Usa helper central de autenticação
        const user = await requireUser();

        logger.info("POST", "Iniciando ou retomando sessão de quiz", { userId: user.id });

        const parsed = BodySchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "Faltam parâmetros obrigatórios." }, { status: 400 });
        }

        const { moduleId } = parsed.data;
        const lockKey = `lock:quiz:start:${user.id}:${moduleId}`;

        // Lock Redis como otimização de latência (não é a garantia de corretude — ver P1.3)
        const acquired = await redis.set(lockKey, "locked", "PX", 5000, "NX");
        if (!acquired) {
            logger.warn("POST", "Bloqueando requisição de início de quiz paralela", {
                userId: user.id,
                moduleId,
            });
            return NextResponse.json(
                { error: "Uma requisição idêntica já está em processamento." },
                { status: 409 }
            );
        }

        try {
            // P2.1 — Usa repository em vez de prisma direto
            const existingSession = await quizRepository.findActiveSession(user.id!, moduleId);
            if (existingSession) {
                logger.info("POST", "Sessão em andamento retomada", {
                    userId: user.id,
                    moduleId,
                    sessionId: existingSession.id,
                    durationMs: Date.now() - start,
                });
                return NextResponse.json({ success: true, quizSession: existingSession });
            }

            const newSession = await quizRepository.createSession({
                user: { connect: { id: user.id! } },
                module: { connect: { id: moduleId } },
                status: "IN_PROGRESS",
                currentLevel: "EASY",
                errorsInCurrentLevel: 0,
                currentQuestionIndex: 0,
                score: 0,
            });

            logger.info("POST", "Nova sessão de quiz criada", {
                userId: user.id,
                moduleId,
                sessionId: newSession.id,
                durationMs: Date.now() - start,
            });

            ActivityService.logQuizStart(user.id!, moduleId, newSession.id);

            return NextResponse.json({ success: true, quizSession: newSession });

        } catch (innerError: unknown) {
            // P1.3 — Trata violação do índice único parcial (QuizSession_active_unique).
            // Código Postgres 23505 / Prisma P2002: retorna a sessão existente em vez de 500.
            const isPrismaUniqueError =
                typeof innerError === "object" &&
                innerError !== null &&
                "code" in innerError &&
                (innerError as { code: string }).code === "P2002";

            if (isPrismaUniqueError) {
                logger.warn("POST", "Violação de unicidade ao criar sessão — retornando sessão existente", {
                    userId: user.id,
                    moduleId,
                });
                const existingSession = await quizRepository.findActiveSession(user.id!, moduleId);
                if (existingSession) {
                    return NextResponse.json({ success: true, quizSession: existingSession });
                }
            }
            throw innerError;
        } finally {
            await redis.del(lockKey);
        }

    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }

        // P0.4 — Sem detalhes de erro expostos ao cliente
        logger.error("POST", "Falha ao iniciar ou retomar a sessão de quiz", {
            message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Falha ao iniciar ou retomar a sessão de quiz." },
            { status: 500 }
        );
    }
}
