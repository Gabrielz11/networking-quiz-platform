import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, BookOpen } from "lucide-react";
import { auth } from "@/auth";

export const revalidate = 0;

export default async function StudentDashboard() {
  const session = await auth();
  const userId = session?.user?.id;

  // Busca paralela de módulos e notas do estudante logado
  const [modules, studentScores] = await Promise.all([
    prisma.module.findMany({
      orderBy: { createdAt: "asc" },
    }),
    userId
      ? prisma.studentModuleScore.findMany({
        where: { userId },
        orderBy: { completedAt: "desc" },
      })
      : Promise.resolve([]),
  ]);

  const getScoreBadgeConfig = (scores: any[]) => {
    if (scores.length === 0) {
      return {
        label: "Não Iniciado",
        style: "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-500",
      };
    }
    const lastScore = scores[0].score;
    if (lastScore >= 7) {
      return {
        label: `Nota: ${lastScore.toFixed(1)} (Aprovado)`,
        style: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400",
      };
    }
    if (lastScore >= 4) {
      return {
        label: `Nota: ${lastScore.toFixed(1)} (Recuperação)`,
        style: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400",
      };
    }
    return {
      label: `Nota: ${lastScore.toFixed(1)} (Reprovado)`,
      style: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400",
    };
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Área do Aluno</h1>
        <p className="text-gray-500 mt-2">Olá, {session?.user?.name || "Estudante"}. Escolha um módulo e inicie seus estudos.</p>
      </header>

      <div className="flex items-center gap-3 mb-8 pb-4 border-b">
        <div className="bg-blue-600 p-2 rounded-lg text-white">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Meus Módulos Disponíveis</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {modules.length > 0 ? (
          modules.map((mod) => {
            const modScores = studentScores.filter((s) => s.moduleId === mod.id);
            const badgeConfig = getScoreBadgeConfig(modScores);

            return (
              <Link key={mod.id} href={`/module/${mod.id}`} className="block group">
                <Card className="hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col relative overflow-hidden bg-white h-full">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>

                  {/* Badge de Desempenho no canto superior direito */}
                  <div className="absolute top-0.5 right-2 z-8">
                    <Badge variant="outline" className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-md ${badgeConfig.style}`}>
                      {badgeConfig.label}
                    </Badge>
                  </div>

                  <CardHeader className="flex-1 pr-28">
                    <CardTitle className="text-xl font-bold group-hover:text-blue-600 transition-colors">
                      {mod.title}
                    </CardTitle>
                    <CardDescription className="text-sm line-clamp-3 mt-2 leading-relaxed text-gray-600">
                      {mod.content.substring(0, 120).replace(/[#*`]/g, "") + "..."}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-4 border-t border-gray-100 bg-gray-50/50 mt-auto">
                    <Button variant="default" className="w-full bg-gray-900 group-hover:bg-blue-600 text-white shadow-sm transition-all rounded-lg pointer-events-none">
                      Iniciar Estudos
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl bg-gray-50">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum módulo disponibilizado pelo professor ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
