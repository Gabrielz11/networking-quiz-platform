import { prisma } from "@/lib/prisma";
import { DashboardQueryService } from "@/services/dashboard-query.service";
import { ScoresLayout } from "./_components/ScoresLayout";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const revalidate = 0; // Desabilita cache estático para a rota, usando unstable_cache internamente nos serviços.

export default async function ScoresPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth");
  }

  if ((session.user as any).role !== "TEACHER") {
    redirect("/student");
  }

  // 1. Busca todos os módulos para popular o dropdown
  const modules = await prisma.module.findMany({
    select: {
      id: true,
      title: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  const initialModuleId = modules[0]?.id || null;
  let initialData = null;

  // 2. Busca dados dos alunos do primeiro módulo para evitar carregamento em branco inicial
  if (initialModuleId) {
    initialData = await DashboardQueryService.getStudentList({
      moduleId: initialModuleId,
      page: 1,
      pageSize: 8,
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScoresLayout
        modules={modules}
        initialModuleId={initialModuleId}
        initialData={initialData}
      />
    </div>
  );
}
