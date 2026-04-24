"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { FileText, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SourceFile {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    status: "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED";
    errorMessage?: string | null;
    createdAt: string;
}

interface ModuleSourceFilesListProps {
    moduleId: string;
    refreshKey?: number;
    onFilesChange?: (files: SourceFile[]) => void;
}

const STATUS_CONFIG = {
    UPLOADED: { label: "Enviado", icon: Clock, className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    PROCESSING: { label: "Processando...", icon: Loader2, className: "bg-blue-50 text-blue-700 border-blue-200" },
    PROCESSED: { label: "Processado", icon: CheckCircle2, className: "bg-green-50 text-green-700 border-green-200" },
    FAILED: { label: "Erro", icon: AlertCircle, className: "bg-red-50 text-red-700 border-red-200" },
};

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ModuleSourceFilesList({ moduleId, refreshKey, onFilesChange }: ModuleSourceFilesListProps) {
    const [files, setFiles] = useState<SourceFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

    const fetchFiles = useCallback(async () => {
        try {
            const res = await fetch(`/api/modules/${moduleId}/sources`);
            if (!res.ok) return;
            const data = await res.json();
            setFiles(data);
            onFilesChange?.(data);
        } catch {
            // silencioso
        } finally {
            setLoading(false);
        }
    }, [moduleId, onFilesChange]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles, refreshKey]);

    const handleProcess = async (fileId: string, fileName: string) => {
        setProcessingIds((prev) => new Set(prev).add(fileId));
        // Otimistic UI: atualizar status local
        setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, status: "PROCESSING" } : f))
        );

        try {
            const res = await fetch(`/api/modules/${moduleId}/sources/${fileId}/process`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.success(`"${fileName}" processado! ${data.chunks} chunks gerados.`);
            fetchFiles();
        } catch (err: any) {
            toast.error("Erro ao processar: " + err.message);
            fetchFiles();
        } finally {
            setProcessingIds((prev) => {
                const next = new Set(prev);
                next.delete(fileId);
                return next;
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
        );
    }

    if (files.length === 0) {
        return (
            <p className="text-center text-sm text-gray-400 py-4">
                Nenhum arquivo enviado ainda.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {files.map((file) => {
                const config = STATUS_CONFIG[file.status];
                const StatusIcon = config.icon;
                const isProcessing = processingIds.has(file.id) || file.status === "PROCESSING";

                return (
                    <div
                        key={file.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm"
                    >
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-blue-600" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{file.originalName}</p>
                            <p className="text-xs text-gray-400">{formatBytes(file.size)} · {file.mimeType === "application/pdf" ? "PDF" : "TXT"}</p>
                            {file.errorMessage && (
                                <p className="text-xs text-red-500 mt-0.5 truncate">{file.errorMessage}</p>
                            )}
                        </div>

                        <Badge
                            variant="outline"
                            className={`text-xs flex items-center gap-1 flex-shrink-0 ${config.className}`}
                        >
                            <StatusIcon className={`w-3 h-3 ${isProcessing ? "animate-spin" : ""}`} />
                            {config.label}
                        </Badge>

                        {(file.status === "UPLOADED" || file.status === "FAILED") && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleProcess(file.id, file.originalName)}
                                disabled={isProcessing}
                                className="h-8 px-2 text-xs text-blue-600 hover:bg-blue-50 flex-shrink-0"
                                title={file.status === "FAILED" ? "Reprocessar" : "Processar"}
                            >
                                {file.status === "FAILED" ? (
                                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                ) : (
                                    <Zap className="w-3.5 h-3.5 mr-1" />
                                )}
                                {file.status === "FAILED" ? "Reprocessar" : "Processar"}
                            </Button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
