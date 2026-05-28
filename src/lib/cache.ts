import { unstable_cache } from "next/cache";
import { DashboardQueryService } from "@/services/analytics/dashboard-query.service";

/**
 * Busca a lista de alunos com cache de 60 segundos.
 * Invalida com a tag "student-scores".
 */
export const getCachedStudentList = (moduleId: string, page: number, pageSize: number) => {
  return unstable_cache(
    async () => {
      return DashboardQueryService.getStudentList({ moduleId, page, pageSize });
    },
    [`student-list-${moduleId}-p${page}-s${pageSize}`],
    {
      revalidate: 60, // 60 segundos
      tags: ["student-scores"],
    }
  )();
};

/**
 * Busca os detalhes de um aluno com cache de 30 segundos.
 * Invalida com a tag "student-scores".
 */
export const getCachedStudentDetail = (studentId: string) => {
  return unstable_cache(
    async () => {
      return DashboardQueryService.getStudentDetail(studentId);
    },
    [`student-detail-${studentId}`],
    {
      revalidate: 30, // 30 segundos
      tags: ["student-scores"],
    }
  )();
};
