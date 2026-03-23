import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, BrainCircuit } from "lucide-react";

export const revalidate = 0; // Disable cache for dev

export default async function Home() {
  const modules = await prisma.module.findMany({
    orderBy: { createdAt: "asc" },
  });
  const error = null;

  return (
    <div className="flex flex-col min-h-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border-b">
        <div className="absolute inset-0 bg-blue-50/50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        <div className="container mx-auto px-4 py-24 relative z-10 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 text-blue-700 text-sm font-semibold mb-6 animate-fade-in cursor-default">
            <Sparkles className="w-4 h-4" />
            <span>Plataforma com Correção por Inteligência Artificial</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight mb-6">
            Aprenda no seu ritmo com a <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Lumina LMS</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed max-w-2xl mx-auto">
            Uma plataforma de ensino que elimina as distrações, focando no essencial, e oferecendo correções pedagógicas sob medida após cada interação de aprendizado.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="#modules">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base shadow-lg shadow-blue-500/25 bg-blue-600 hover:bg-blue-700 transition-all rounded-full hover:-translate-y-1">
                Explorar Conteúdos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Modules List Section */}
      <section id="modules" className="flex-1 container mx-auto px-4 py-20 max-w-5xl">
        <div className="flex items-center gap-3 mb-10 border-b pb-4">
          <div className="bg-gray-900 p-2 rounded-lg">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Catálogo de Módulos</h2>
        </div>

        {error && (
          <div className="p-4 border-l-4 border-red-500 bg-red-50 text-red-700 rounded-md shadow-sm mb-6">
            <p className="font-semibold">Erro ao carregar Módulos.</p>
          </div>
        )}

        {(!modules || modules.length === 0) && !error && (
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-2xl bg-gray-50 mt-8">
            <BookOpen className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">A biblioteca está vazia</h3>
            <p className="text-gray-500 max-w-md">Nenhum módulo foi cadastrado ainda. Professores autenticados podem adicionar novos materiais através do Painel de Controle.</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules?.map((mod) => (
            <Card key={mod.id as string} className="group hover:shadow-xl transition-all duration-300 hover:border-blue-200 bg-white flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              <CardHeader className="flex-1">
                <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {mod.title as string}
                </CardTitle>
                <CardDescription className="text-gray-600 mt-2 line-clamp-3 leading-relaxed">
                  {mod.description as string}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-4 border-t border-gray-100 bg-gray-50/50 mt-auto">
                <Link href={`/module/${mod.id as string}`} className="w-full">
                  <Button variant="default" className="w-full bg-gray-900 hover:bg-blue-600 text-white shadow-sm transition-colors group-hover:shadow-md">
                    Iniciar Estudos
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
