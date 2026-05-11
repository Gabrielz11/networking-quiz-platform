import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border-b flex-1 flex items-center">
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
            <Link href="/auth">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base shadow-lg shadow-blue-500/25 bg-blue-600 hover:bg-blue-700 transition-all rounded-full hover:-translate-y-1">
                Começar Agora
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
