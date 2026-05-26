import { prisma } from "@/lib/prisma";
import { Logger } from "@/lib/logger";

const logger = new Logger("ActivityService");

/**
 * Serviço de registro de comportamento do aluno.
 *
 * Todos os métodos são não-bloqueantes: erros são capturados e logados
 * internamente, nunca propagados. O fluxo principal (quiz, login, etc.)
 * jamais é interrompido por uma falha de log.
 */
export class ActivityService {
    // ─── Login ────────────────────────────────────────────────────────────────

    static async logLogin(userId: string): Promise<void> {
        try {
            await prisma.activityLog.create({
                data: {
                    userId,
                    eventType: "LOGIN",
                },
            });
            logger.info("logLogin", "Login registrado", { userId });
        } catch (err: any) {
            logger.warn("logLogin", "Falha ao registrar login (não crítico)", {
                userId,
                error: err?.message,
            });
        }
    }

    // ─── Acesso a módulo ──────────────────────────────────────────────────────

    static async logModuleAccess(
        userId: string,
        moduleId: string,
        moduleTitle: string
    ): Promise<void> {
        try {
            await prisma.activityLog.create({
                data: {
                    userId,
                    eventType: "MODULE_ACCESS",
                    moduleId,
                    metadata: { moduleTitle },
                },
            });
            logger.info("logModuleAccess", "Acesso ao módulo registrado", {
                userId,
                moduleId,
                moduleTitle,
            });
        } catch (err: any) {
            logger.warn(
                "logModuleAccess",
                "Falha ao registrar acesso ao módulo (não crítico)",
                { userId, moduleId, error: err?.message }
            );
        }
    }

    // ─── Início de quiz ───────────────────────────────────────────────────────

    static async logQuizStart(
        userId: string,
        moduleId: string,
        sessionId: string
    ): Promise<void> {
        try {
            await prisma.activityLog.create({
                data: {
                    userId,
                    eventType: "QUIZ_START",
                    moduleId,
                    sessionId,
                },
            });
            logger.info("logQuizStart", "Início de quiz registrado", {
                userId,
                moduleId,
                sessionId,
            });
        } catch (err: any) {
            logger.warn(
                "logQuizStart",
                "Falha ao registrar início de quiz (não crítico)",
                { userId, moduleId, sessionId, error: err?.message }
            );
        }
    }

    // ─── Conclusão de quiz ────────────────────────────────────────────────────

    static async logQuizComplete(
        userId: string,
        moduleId: string,
        sessionId: string,
        score: number
    ): Promise<void> {
        try {
            await prisma.activityLog.create({
                data: {
                    userId,
                    eventType: "QUIZ_COMPLETE",
                    moduleId,
                    sessionId,
                    metadata: { score },
                },
            });
            logger.info("logQuizComplete", "Conclusão de quiz registrada", {
                userId,
                moduleId,
                sessionId,
                score,
            });
        } catch (err: any) {
            logger.warn(
                "logQuizComplete",
                "Falha ao registrar conclusão de quiz (não crítico)",
                { userId, moduleId, sessionId, error: err?.message }
            );
        }
    }

    // ─── Nota registrada ──────────────────────────────────────────────────────

    static async logScoreRecorded(
        userId: string,
        moduleId: string,
        sessionId: string,
        score: number
    ): Promise<void> {
        try {
            await prisma.activityLog.create({
                data: {
                    userId,
                    eventType: "SCORE_RECORDED",
                    moduleId,
                    sessionId,
                    metadata: { score },
                },
            });
            logger.info("logScoreRecorded", "Nota registrada no activity log", {
                userId,
                moduleId,
                sessionId,
                score,
            });
        } catch (err: any) {
            logger.warn(
                "logScoreRecorded",
                "Falha ao registrar nota no activity log (não crítico)",
                { userId, moduleId, sessionId, error: err?.message }
            );
        }
    }

    // ─── Consultas para o painel do professor ─────────────────────────────────

    /**
     * Retorna a timeline de atividades de um aluno, paginada por cursor.
     * Usada no painel do professor para exibir as últimas ações do aluno.
     */
    static async getTimeline(
        userId: string,
        options: { limit?: number; cursor?: string } = {}
    ) {
        const { limit = 20, cursor } = options;

        const activities = await prisma.activityLog.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            ...(cursor
                ? { cursor: { id: cursor }, skip: 1 }
                : {}),
        });

        const hasMore = activities.length > limit;
        const items = hasMore ? activities.slice(0, limit) : activities;
        const nextCursor = hasMore ? items[items.length - 1].id : null;

        return { items, nextCursor, hasMore };
    }

    /**
     * Conta total de logins de um aluno.
     */
    static async countLogins(userId: string): Promise<number> {
        return prisma.activityLog.count({
            where: { userId, eventType: "LOGIN" },
        });
    }

    /**
     * Conta acessos de um aluno a um módulo específico.
     */
    static async countModuleAccesses(
        userId: string,
        moduleId: string
    ): Promise<number> {
        return prisma.activityLog.count({
            where: { userId, moduleId, eventType: "MODULE_ACCESS" },
        });
    }

    /**
     * Retorna a data da última atividade registrada de um aluno.
     */
    static async getLastActivity(userId: string): Promise<Date | null> {
        const log = await prisma.activityLog.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
        });
        return log?.createdAt ?? null;
    }
}
