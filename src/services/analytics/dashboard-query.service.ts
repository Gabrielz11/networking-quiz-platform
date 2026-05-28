import { prisma } from "@/lib/prisma";
import { Logger } from "@/lib/logger";

const logger = new Logger("DashboardQueryService");

export interface StudentListEntry {
  id: string;
  name: string | null;
  email: string | null;
  attemptsCount: number;
  averageScore: number | null;
  lastScore: number | null;
  accessCount: number;
  lastActivityAt: Date | null;
  isTopPerformer: boolean;
}

export interface StudentDetail {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: Date;
  globalKpis: {
    lastLogin: Date | null;
    totalModuleAccesses: number;
    totalAttempts: number;
    overallAverage: number | null;
    lastActivityAt: Date | null;
  };
  moduleMetrics: {
    moduleId: string;
    moduleTitle: string;
    attemptsCount: number;
    averageScore: number | null;
    lastScore: number | null;
    accessesCount: number;
    scores: {
      id: string;
      score: number;
      completedAt: Date;
      sessionId: string;
    }[];
  }[];
  recentActivities: {
    id: string;
    eventType: string;
    moduleId: string | null;
    moduleTitle?: string | null;
    sessionId: string | null;
    metadata: any;
    createdAt: Date;
  }[];
}

export class DashboardQueryService {
  /**
   * Obtém a lista paginada de estudantes com suas métricas para um módulo específico.
   */
  static async getStudentList(params: {
    moduleId: string;
    page: number;
    pageSize: number;
  }): Promise<{
    students: StudentListEntry[];
    total: number;
    totalPages: number;
    page: number;
  }> {
    const { moduleId, page, pageSize } = params;
    const skip = (page - 1) * pageSize;

    try {
      logger.info("getStudentList", "Buscando lista de alunos", { moduleId, page, pageSize });

      // 1. Busca total de estudantes
      const total = await prisma.user.count({
        where: { role: "STUDENT" },
      });

      // 2. Busca estudantes da página
      const studentsRaw = await prisma.user.findMany({
        where: { role: "STUDENT" },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
      });

      // 3. Busca notas do módulo para identificar o maior score médio
      // Para a estrela de "Melhor Desempenho", calculamos a média de notas por aluno no módulo específico
      const allModuleScores = await prisma.studentModuleScore.findMany({
        where: { moduleId },
        select: {
          userId: true,
          score: true,
        },
      });

      const averageScoresByUser: Record<string, { sum: number; count: number }> = {};
      allModuleScores.forEach((score) => {
        if (!averageScoresByUser[score.userId]) {
          averageScoresByUser[score.userId] = { sum: 0, count: 0 };
        }
        averageScoresByUser[score.userId].sum += score.score;
        averageScoresByUser[score.userId].count += 1;
      });

      let maxAverage = 0;
      const userAverages: Record<string, number> = {};
      Object.entries(averageScoresByUser).forEach(([userId, data]) => {
        const avg = data.sum / data.count;
        userAverages[userId] = avg;
        if (avg > maxAverage) {
          maxAverage = avg;
        }
      });

      // 4. Hidrata os estudantes da página com batch queries (evita N+1)
      const studentIds = studentsRaw.map((s) => s.id);

      const [pageScores, accessCountGroups, lastActivities] = await Promise.all([
        // Notas de todos os alunos desta página neste módulo
        prisma.studentModuleScore.findMany({
          where: { userId: { in: studentIds }, moduleId },
          orderBy: { completedAt: "desc" },
          select: { userId: true, score: true, completedAt: true },
        }),
        // Contagem de acessos ao módulo por aluno (agrupada)
        prisma.activityLog.groupBy({
          by: ["userId"],
          where: { userId: { in: studentIds }, moduleId, eventType: "MODULE_ACCESS" },
          _count: { id: true },
        }),
        // Última atividade geral por aluno (distinct userId, mais recente primeiro)
        prisma.activityLog.findMany({
          where: { userId: { in: studentIds } },
          orderBy: { createdAt: "desc" },
          distinct: ["userId"],
          select: { userId: true, createdAt: true },
        }),
      ]);

      // Monta lookups em memória
      const scoresByUser = new Map<string, { score: number; completedAt: Date }[]>();
      for (const s of pageScores) {
        if (!scoresByUser.has(s.userId)) scoresByUser.set(s.userId, []);
        scoresByUser.get(s.userId)!.push(s);
      }

      const accessCountByUser = new Map<string, number>(
        accessCountGroups.map((g) => [g.userId, g._count.id])
      );

      const lastActivityByUser = new Map<string, Date>(
        lastActivities.map((a) => [a.userId, a.createdAt])
      );

      const students: StudentListEntry[] = studentsRaw.map((student) => {
        const scores = scoresByUser.get(student.id) ?? [];
        const accessCount = accessCountByUser.get(student.id) ?? 0;
        const lastActivityAt = lastActivityByUser.get(student.id) ?? null;

        const attemptsCount = scores.length;
        // scores está ordenado por completedAt desc, então scores[0] é o mais recente
        const lastScore = attemptsCount > 0 ? scores[0].score : null;
        const averageScore =
          attemptsCount > 0
            ? scores.reduce((sum, s) => sum + s.score, 0) / attemptsCount
            : null;

        const isTopPerformer =
          averageScore !== null &&
          maxAverage > 0 &&
          Math.abs(averageScore - maxAverage) < 0.01;

        return {
          id: student.id,
          name: student.name,
          email: student.email,
          attemptsCount,
          averageScore,
          lastScore,
          accessCount,
          lastActivityAt,
          isTopPerformer,
        };
      });

      return {
        students,
        total,
        totalPages: Math.ceil(total / pageSize),
        page,
      };
    } catch (err: any) {
      logger.error("getStudentList", "Falha ao buscar lista de alunos", { error: err?.message });
      throw err;
    }
  }

  /**
   * Obtém os detalhes completos de um estudante para exibição no painel lateral.
   */
  static async getStudentDetail(studentId: string): Promise<StudentDetail | null> {
    try {
      logger.info("getStudentDetail", "Buscando detalhes do estudante", { studentId });

      const student = await prisma.user.findUnique({
        where: { id: studentId, role: "STUDENT" },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

      if (!student) {
        logger.warn("getStudentDetail", "Estudante não encontrado", { studentId });
        return null;
      }

      // 1. Busca todos os módulos para mapear o progresso
      const allModules = await prisma.module.findMany({
        select: {
          id: true,
          title: true,
        },
        orderBy: { id: "asc" }, // ou outra ordem lógica
      });

      // 2. Busca todas as notas e acessos do estudante
      const [allScores, allAccesses, lastLoginLog, lastActivityLog] = await Promise.all([
        prisma.studentModuleScore.findMany({
          where: { userId: studentId },
          orderBy: { completedAt: "desc" },
          select: {
            id: true,
            moduleId: true,
            score: true,
            completedAt: true,
            sessionId: true,
          },
        }),
        prisma.activityLog.findMany({
          where: { userId: studentId, eventType: "MODULE_ACCESS" },
          select: { moduleId: true },
        }),
        prisma.activityLog.findFirst({
          where: { userId: studentId, eventType: "LOGIN" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.activityLog.findFirst({
          where: { userId: studentId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

      // 3. Calcula KPIs globais
      const totalAttempts = allScores.length;
      const overallAverage =
        totalAttempts > 0
          ? allScores.reduce((sum, s) => sum + s.score, 0) / totalAttempts
          : null;

      const globalKpis = {
        lastLogin: lastLoginLog ? lastLoginLog.createdAt : null,
        totalModuleAccesses: allAccesses.length,
        totalAttempts,
        overallAverage,
        lastActivityAt: lastActivityLog ? lastActivityLog.createdAt : null,
      };

      // 4. Agrupa métricas por módulo
      const moduleMetrics = allModules.map((mod) => {
        const modScores = allScores.filter((s) => s.moduleId === mod.id);
        const modAccessesCount = allAccesses.filter((a) => a.moduleId === mod.id).length;

        const attemptsCount = modScores.length;
        const averageScore =
          attemptsCount > 0
            ? modScores.reduce((sum, s) => sum + s.score, 0) / attemptsCount
            : null;
        const lastScore = attemptsCount > 0 ? modScores[0].score : null;

        // Histórico de scores do módulo (ordenados do mais antigo para o mais recente para o gráfico)
        const sortedScoresForChart = [...modScores]
          .reverse()
          .map((s) => ({
            id: s.id,
            score: s.score,
            completedAt: s.completedAt,
            sessionId: s.sessionId,
          }));

        return {
          moduleId: mod.id,
          moduleTitle: mod.title,
          attemptsCount,
          averageScore,
          lastScore,
          accessesCount: modAccessesCount,
          scores: sortedScoresForChart,
        };
      });

      // 5. Busca timeline de atividades recentes (últimas 20)
      const recentLogs = await prisma.activityLog.findMany({
        where: { userId: studentId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          eventType: true,
          moduleId: true,
          sessionId: true,
          metadata: true,
          createdAt: true,
        },
      });

      // Hidrata os logs de atividade com títulos de módulos
      const recentActivities = recentLogs.map((log) => {
        let moduleTitle: string | null = null;
        if (log.moduleId) {
          const matchingMod = allModules.find((m) => m.id === log.moduleId);
          moduleTitle = matchingMod ? matchingMod.title : null;
        }

        // Se o título estiver no metadado do log de acesso, usamos ele
        if (!moduleTitle && log.metadata && typeof log.metadata === "object") {
          moduleTitle = (log.metadata as any).moduleTitle || null;
        }

        return {
          id: log.id,
          eventType: log.eventType,
          moduleId: log.moduleId,
          moduleTitle,
          sessionId: log.sessionId,
          metadata: log.metadata,
          createdAt: log.createdAt,
        };
      });

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        createdAt: student.createdAt,
        globalKpis,
        moduleMetrics,
        recentActivities,
      };
    } catch (err: any) {
      logger.error("getStudentDetail", "Falha ao buscar detalhes do estudante", {
        studentId,
        error: err?.message,
      });
      throw err;
    }
  }

  /**
   * Obtém a timeline de atividades paginada por cursor para a timeline completa de um aluno.
   */
  static async getActivityTimeline(params: {
    studentId: string;
    limit: number;
    cursor?: string;
  }) {
    const { studentId, limit, cursor } = params;

    try {
      logger.info("getActivityTimeline", "Buscando timeline paginada", { studentId, limit, cursor });

      const logs = await prisma.activityLog.findMany({
        where: { userId: studentId },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        select: {
          id: true,
          eventType: true,
          moduleId: true,
          sessionId: true,
          metadata: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined = undefined;
      if (logs.length > limit) {
        const nextItem = logs.pop();
        nextCursor = nextItem?.id;
      }

      // Buscar módulos para mapear títulos
      const modules = await prisma.module.findMany({
        select: { id: true, title: true },
      });

      const items = logs.map((log) => {
        const matchedModule = modules.find((m) => m.id === log.moduleId);
        return {
          id: log.id,
          eventType: log.eventType,
          moduleId: log.moduleId,
          moduleTitle: matchedModule ? matchedModule.title : (log.metadata as any)?.moduleTitle || null,
          sessionId: log.sessionId,
          metadata: log.metadata,
          createdAt: log.createdAt,
        };
      });

      return {
        items,
        nextCursor,
      };
    } catch (err: any) {
      logger.error("getActivityTimeline", "Falha ao buscar timeline", { studentId, error: err?.message });
      throw err;
    }
  }
}
