import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, BookOpen } from "lucide-react";
import { auth } from "@/auth";

export const revalidate = 0;

export default async function StudentDashboard() {
  const session = await auth();
  const modules = await prisma.module.findMany({
    orderBy: { createdAt: "asc" },
  });

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
          modules.map((mod) => (
            <Card key={mod.id} className="group hover:shadow-xl transition-all duration-300 hover:border-blue-200 flex flex-col relative overflow-hidden bg-white">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              <CardHeader className="flex-1">
                <CardTitle className="text-xl font-bold group-hover:text-blue-600 transition-colors">
                  {mod.title}
                </CardTitle>
                <CardDescription className="text-sm line-clamp-3 mt-2 leading-relaxed text-gray-600">
                  {mod.content.substring(0, 120).replace(/[#*`]/g, "") + "..."}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-4 border-t border-gray-100 bg-gray-50/50 mt-auto">
                <Link href={`/module/${mod.id}`} className="w-full">
                  <Button variant="default" className="w-full bg-gray-900 hover:bg-blue-600 shadow-sm transition-all rounded-lg">
                    Iniciar Estudos
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))
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
