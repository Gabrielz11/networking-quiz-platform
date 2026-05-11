'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6 border border-slate-100">
        <div className="flex justify-center">
          <div className="p-4 bg-red-50 rounded-full">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Ops! Algo deu errado</h1>
          <p className="text-slate-600">
            Ocorreu um erro inesperado ao processar sua solicitação. Nossa equipe técnica já foi notificada.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 font-mono">ID: {error.digest}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Button 
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Tentar novamente
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/'}
            className="w-full"
          >
            Voltar para a página inicial
          </Button>
        </div>
      </div>
    </div>
  );
}
