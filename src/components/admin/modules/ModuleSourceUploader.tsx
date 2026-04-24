"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModuleSourceUploaderProps {
    moduleId: string;
    onUploadSuccess: () => void;
}

const ALLOWED_EXTENSIONS = [".pdf", ".txt"];
const MAX_SIZE_MB = 10;

export function ModuleSourceUploader({ moduleId, onUploadSuccess }: ModuleSourceUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return toast.error("Tipo não suportado. Use PDF ou TXT.");
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return toast.error(`O arquivo excede o limite de ${MAX_SIZE_MB}MB.`);
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(`/api/modules/${moduleId}/sources`, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.success(`"${file.name}" enviado com sucesso!`);
            onUploadSuccess();
        } catch (err: any) {
            toast.error("Erro ao enviar: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isUploading && inputRef.current?.click()}
            className={`
                relative cursor-pointer rounded-2xl border-2 border-dashed p-8
                flex flex-col items-center justify-center gap-3 transition-all
                ${isDragging
                    ? "border-blue-500 bg-blue-50 scale-[1.01]"
                    : "border-gray-200 bg-gray-50/50 hover:border-blue-300 hover:bg-blue-50/30"
                }
                ${isUploading ? "pointer-events-none opacity-70" : ""}
            `}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = "";
                }}
            />

            {isUploading ? (
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            ) : (
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-blue-600" />
                </div>
            )}

            <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">
                    {isUploading ? "Enviando arquivo..." : "Arraste ou clique para enviar"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    Adicione PDFs ou arquivos TXT que servirão como base para a IA gerar o conteúdo deste módulo.
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
                        <FileText className="w-3 h-3" /> PDF
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
                        <FileText className="w-3 h-3" /> TXT
                    </span>
                    <span className="text-xs text-gray-400">• Máx. 10MB</span>
                </div>
            </div>
        </div>
    );
}
