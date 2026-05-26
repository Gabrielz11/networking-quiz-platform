import { prisma } from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { revalidateTag } from "next/cache";

const logger = new Logger("ScoreService");

/** Janela máxima de sessões completas salvas por aluno × módulo */
const SCORE_WINDOW_SIZE = 4;

export class ScoreService {
    // ─── Registro de nota (janela deslizante) ─────────────────────────────────

    /**
     * Registra a nota de uma sessão completa para um aluno em um módulo.
     *
     * Implementa a janela deslizante de 4 sessões:
     * - Conta os registros atuais do aluno naquele módulo.
     * - Se já tiver SCORE_WINDOW_SIZE (4) ou mais, deleta o mais antigo.
     * - Cria o novo registro.
     * - Invalida o cache do painel do professor.
     */
    static async registerCompletedSession(
        userId: string,
        moduleId: string,
        sessionId: string,
        score: number
    ): Promise<void> {
        try {
            logger.info("registerCompletedSession", "Registrando nota da sessão", {
                userId,
                moduleId,
                sessionId,
                score,
            });

            // Busca os registros existentes, ordenados do mais antigo ao mais novo
            const existingScores = await prisma.studentModuleScore.findMany({
                where: { userId, moduleId },
                orderBy: { completedAt: "asc" },
                select: { id: true },
            });

            // Se já atingiu o limite da janela, deleta o mais antigo
            if (existingScores.length >= SCORE_WINDOW_SIZE) {
                const oldestId = existingScores[0].id;
                await prisma.studentModuleScore.delete({
                    where: { id: oldestId },
                });
                logger.info(
                    "registerCompletedSession",
                    "Registro mais antigo removido (janela deslizante)",
                    { removedId: oldestId, userId, moduleId }
                );
            }

            // Cria o novo registro de nota
            await prisma.studentModuleScore.create({
                data: { userId, moduleId, sessionId, score },
            });

            logger.info(
                "registerCompletedSession",
                "Nota registrada com sucesso",
                { userId, moduleId, score }
            );

            // Invalida o cache do painel do professor (requer contexto de Server Action/Route Handler)
            try {
                revalidateTag("student-scores", "max");
            } catch {
                // revalidateTag só funciona em Server Actions e Route Handlers
                // Se chamado fora desse contexto (ex: em job background), ignora silenciosamente
            }
        } catch (err: any) {
            logger.error(
                "registerCompletedSession",
                "Falha ao registrar nota da sessão",
                { userId, moduleId, sessionId, error: err?.message }
            );
            // Não propaga — o quiz não deve falhar por causa do registro de nota
        }
    }

    // ─── Consultas para a área do aluno ───────────────────────────────────────

    /**
     * Retorna as últimas N notas de um aluno em um módulo específico.
     * Usado nos cards da área do aluno.
     */
    static async getStudentScoresForModule(
        userId: string,
        moduleId: string
    ) {
        return prisma.studentModuleScore.findMany({
            where: { userId, moduleId },
            orderBy: { completedAt: "asc" },
        });
    }

    /**
     * Retorna as notas de um aluno em TODOS os módulos.
     * Resultado: { moduleId → scores[] }
     */
    static async getAllStudentScoresByUser(userId: string) {
        const scores = await prisma.studentModuleScore.findMany({
            where: { userId },
            orderBy: { completedAt: "asc" },
            select: {
                id: true,
                moduleId: true,
                score: true,
                completedAt: true,
            },
        });

        // Agrupa por módulo
        const grouped: Record<string, typeof scores> = {};
        for (const s of scores) {
            if (!grouped[s.moduleId]) grouped[s.moduleId] = [];
            grouped[s.moduleId].push(s);
        }
        return grouped;
    }

    // ─── Consultas para o painel do professor ─────────────────────────────────

    /**
     * Retorna todos os alunos com notas em um módulo, junto com suas
     * últimas N notas. Usado na tabela de alunos do painel do professor.
     *
     * Suporta paginação offset e inclui contagem total para paginação numérica.
     */
    static async getAllStudentScoresForModule(
        moduleId: string,
        options: { page?: number; pageSize?: number } = {}
    ) {
        const { page = 1, pageSize = 8 } = options;
        const skip = (page - 1) * pageSize;

        // Busca todos os userIds distintos com score neste módulo
        const distinctUsers = await prisma.studentModuleScore.findMany({
            where: { moduleId },
            distinct: ["userId"],
            select: { userId: true },
            skip,
            take: pageSize,
        });

        const totalUsers = await prisma.studentModuleScore.groupBy({
            by: ["userId"],
            where: { moduleId },
            _count: true,
        });

        // Para cada aluno, busca os dados completos e as notas
        const results = await Promise.all(
            distinctUsers.map(async ({ userId }) => {
                const [user, scores] = await Promise.all([
                    prisma.user.findUnique({
                        where: { id: userId },
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            createdAt: true,
                        },
                    }),
                    prisma.studentModuleScore.findMany({
                        where: { userId, moduleId },
                        orderBy: { completedAt: "asc" },
                        select: {
                            id: true,
                            score: true,
                            completedAt: true,
                            sessionId: true,
                        },
                    }),
                ]);

                if (!user) return null;

                const lastScore = scores[scores.length - 1] ?? null;
                const average =
                    scores.length > 0
                        ? scores.reduce((acc, s) => acc + s.score, 0) /
                          scores.length
                        : null;

                return {
                    user,
                    scores,
                    lastScore: lastScore?.score ?? null,
                    lastScoreDate: lastScore?.completedAt ?? null,
                    averageScore: average !== null ? Math.round(average * 10) / 10 : null,
                    totalAttempts: scores.length,
                };
            })
        );

        const filtered = results.filter(Boolean) as NonNullable<(typeof results)[number]>[];

        return {
            students: filtered,
            total: totalUsers.length,
            totalPages: Math.ceil(totalUsers.length / pageSize),
            page,
            pageSize,
        };
    }

    /**
     * Retorna o perfil de notas completo de um aluno (todos os módulos).
     * Usado no painel lateral direito do professor.
     */
    static async getStudentProfile(userId: string) {
        const scores = await prisma.studentModuleScore.findMany({
            where: { userId },
            orderBy: { completedAt: "asc" },
            include: {
                module: {
                    select: { id: true, title: true },
                },
            },
        });

        // Agrupa por módulo
        const byModule: Record<
            string,
            {
                moduleId: string;
                moduleTitle: string;
                scores: { score: number; completedAt: Date; sessionId: string }[];
                lastScore: number | null;
                averageScore: number | null;
                totalAttempts: number;
            }
        > = {};

        for (const s of scores) {
            const key = s.moduleId;
            if (!byModule[key]) {
                byModule[key] = {
                    moduleId: s.moduleId,
                    moduleTitle: s.module.title,
                    scores: [],
                    lastScore: null,
                    averageScore: null,
                    totalAttempts: 0,
                };
            }
            byModule[key].scores.push({
                score: s.score,
                completedAt: s.completedAt,
                sessionId: s.sessionId,
            });
        }

        // Calcula métricas por módulo
        const moduleList = Object.values(byModule).map((m) => {
            const last = m.scores[m.scores.length - 1] ?? null;
            const avg =
                m.scores.length > 0
                    ? m.scores.reduce((a, s) => a + s.score, 0) / m.scores.length
                    : null;
            return {
                ...m,
                lastScore: last?.score ?? null,
                averageScore: avg !== null ? Math.round(avg * 10) / 10 : null,
                totalAttempts: m.scores.length,
            };
        });

        // Média geral do aluno
        const allScores = scores.map((s) => s.score);
        const overallAverage =
            allScores.length > 0
                ? Math.round(
                      (allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10
                  ) / 10
                : null;

        return {
            moduleList,
            overallAverage,
            totalCompletedSessions: scores.length,
        };
    }

    /**
     * Retorna as médias gerais por módulo.
     * Usado em cards de visão geral do painel.
     */
    static async getAllModulesScoresSummary() {
        const grouped = await prisma.studentModuleScore.groupBy({
            by: ["moduleId"],
            _avg: { score: true },
            _count: { score: true },
        });

        const moduleTitles = await prisma.module.findMany({
            where: { id: { in: grouped.map((g) => g.moduleId) } },
            select: { id: true, title: true },
        });

        const titleMap = Object.fromEntries(moduleTitles.map((m) => [m.id, m.title]));

        return grouped.map((g) => ({
            moduleId: g.moduleId,
            moduleTitle: titleMap[g.moduleId] ?? "Módulo",
            averageScore:
                g._avg.score !== null
                    ? Math.round(g._avg.score * 10) / 10
                    : null,
            totalAttempts: g._count.score,
        }));
    }
}
