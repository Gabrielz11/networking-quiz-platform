"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerateContentWithRagButtonProps {
    moduleId: string;
    hasProcessedFiles: boolean;
    onContentGenerated: (content: string, description?: string) => void;
}

export function GenerateContentWithRagButton({
    moduleId,
    hasProcessedFiles,
    onContentGenerated,
}: GenerateContentWithRagButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!hasProcessedFiles) return;

        setIsGenerating(true);
        try {
            const res = await fetch(`/api/modules/${moduleId}/generate-content-rag`, {
                method: "POST",
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.success(`Conteúdo gerado com sucesso! (${data.usedChunks} trechos usados)`);
            onContentGenerated(data.content, data.description);
        } catch (err: any) {
            toast.error("Erro ao gerar: " + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button
            type="button"
            onClick={handleGenerate}
            disabled={!hasProcessedFiles || isGenerating}
            title={
                !hasProcessedFiles
                    ? "Processe ao menos um arquivo antes de gerar com RAG"
                    : "Gerar conteúdo baseado nos materiais enviados"
            }
            className={`
                h-9 px-4 flex gap-2 font-bold text-sm border-none active:scale-95 transition-all shadow-sm
                ${hasProcessedFiles && !isGenerating
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
                }
            `}
        >
            {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Sparkles className="w-4 h-4" />
            )}
            {isGenerating ? "Gerando com RAG..." : "Gerar com Materiais"}
        </Button>
    );
}
