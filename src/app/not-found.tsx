import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 text-center space-y-8 border border-slate-100">
        <div className="flex justify-center">
          <div className="p-5 bg-indigo-50 rounded-full animate-bounce">
            <FileQuestion className="w-16 h-16 text-indigo-600" />
          </div>
        </div>
        
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">404</h1>
          <h2 className="text-2xl font-semibold text-slate-800">Página não encontrada</h2>
          <p className="text-slate-500 leading-relaxed">
            Parece que você se perdeu no caminho. A página que você está procurando não existe ou foi movida.
          </p>
        </div>

        <Link href="/">
          <Button className="w-full h-12 text-lg font-medium flex items-center justify-center gap-2 group">
            <Home className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
            Voltar ao Início
          </Button>
        </Link>
        
        <div className="pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-400">
            Lumina LMS - Inteligência em Redes
          </p>
        </div>
      </div>
    </div>
  );
}
