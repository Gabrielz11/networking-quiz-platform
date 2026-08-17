// src/app/(admin)/dashboard/ai-quality/page.tsx
// Painel "Qualidade da IA" para o professor acompanhar a confiabilidade (Faithfulness RAGAS)
// dos conteúdos educacionais gerados por IA a partir dos PDFs.

"use client";

import { useEffect, useState } from "react";
import { QualityBadge } from "@/components/admin/modules/QualityBadge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    ShieldCheck,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    BrainCircuit,
    RefreshCw,
    Search,
    Filter,
    Calendar,
    FileText,
    Eye,
    Clock,
    Layers,
    Cpu,
    Check,
} from "lucide-react";

interface ClaimItem {
    statement: string;
    supported: boolean;
    reason: string;
}

interface EvaluationDetails {
    totalClaims?: number;
    supportedClaims?: number;
    unsupportedClaims?: number;
    claims?: ClaimItem[];
    sourceChunkIds?: string[];
    contextHash?: string;
    evaluator?: string;
    evaluatorVersion?: string;
    provider?: string;
    model?: string;
    latencyMs?: number;
    isSegmented?: boolean;
    segmentsCount?: number;
}

interface AiQualityItem {
    moduleId: string;
    moduleTitle: string;
    description?: string;
    hasSourceFiles: boolean;
    evaluationId?: string | null;
    metric: string;
    score: number | null;
    status: string;
    evaluatorVersion?: string | null;
    provider?: string | null;
    model?: string | null;
    details?: EvaluationDetails | null;
    updatedAt?: string | null;
    createdAt: string;
}

interface AiQualitySummary {
    totalModules: number;
    totalEvaluated: number;
    avgFaithfulness: number | null;
    trustedCount: number;
    reviewCount: number;
    attentionCount: number;
    outdatedCount: number;
    pendingCount: number;
}

export default function AiQualityPage() {
    const [data, setData] = useState<{ summary: AiQualitySummary; items: AiQualityItem[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [reevaluatingId, setReevaluatingId] = useState<string | null>(null);
    const [selectedDiagnostic, setSelectedDiagnostic] = useState<AiQualityItem | null>(null);
    const [claimsFilter, setClaimsFilter] = useState<"ALL" | "SUPPORTED" | "UNSUPPORTED">("ALL");

    const fetchData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const res = await fetch("/api/dashboard/ai-quality");
            if (!res.ok) throw new Error("Falha ao carregar dados");
            const result: { summary: AiQualitySummary; items: AiQualityItem[] } = await res.json();

            // Detectar transições de PENDING/PROCESSING para COMPLETED ou FAILED
            if (data?.items) {
                const prevPendingMap = new Map(
                    data.items
                        .filter((i) => i.status === "PENDING" || i.status === "PROCESSING")
                        .map((i) => [i.moduleId, i.moduleTitle])
                );

                for (const newItem of result.items) {
                    if (prevPendingMap.has(newItem.moduleId)) {
                        const title = newItem.moduleTitle;
                        if (newItem.status === "COMPLETED" && typeof newItem.score === "number") {
                            const pct = Math.round(newItem.score * 100);
                            toast.success(
                                `Avaliação RAGAS concluída para "${title}"! Fidelidade: ${pct}%`,
                                { duration: 6000 }
                            );
                        } else if (newItem.status === "FAILED") {
                            toast.error(`Falha na avaliação RAGAS para "${title}".`, { duration: 6000 });
                        }
                    }
                }
            }

            setData(result);
        } catch (err: any) {
            if (!isSilent) {
                toast.error("Erro ao carregar métricas de qualidade: " + err.message);
            }
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Polling automático a cada 5 segundos enquanto houver avaliações em PENDING ou PROCESSING
    useEffect(() => {
        const hasPending = data?.items.some(
            (item) => item.status === "PENDING" || item.status === "PROCESSING"
        );

        if (!hasPending) return;

        const interval = setInterval(() => {
            fetchData(true);
        }, 5000);

        return () => clearInterval(interval);
    }, [data]);

    const handleReevaluate = async (moduleId: string) => {
        setReevaluatingId(moduleId);
        try {
            const res = await fetch(`/api/modules/${moduleId}/evaluate-rag`, {
                method: "POST",
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            toast.success("Reavaliação enfileirada com sucesso!");
            fetchData();
        } catch (err: any) {
            toast.error("Erro ao solicitar reavaliação: " + err.message);
        } finally {
            setReevaluatingId(null);
        }
    };

    const items = data?.items || [];
    const summary = data?.summary;

    const filteredItems = items.filter((item) => {
        const matchesSearch =
            item.moduleTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;

        if (filterStatus === "TRUSTED") {
            return item.status === "COMPLETED" && (item.score || 0) >= 0.90;
        }
        if (filterStatus === "REVIEW") {
            return item.status === "COMPLETED" && (item.score || 0) >= 0.80 && (item.score || 0) < 0.90;
        }
        if (filterStatus === "ATTENTION") {
            return item.status === "COMPLETED" && (item.score || 0) < 0.80;
        }
        if (filterStatus === "OUTDATED_OR_NOT") {
            return item.status === "OUTDATED" || item.status === "NOT_EVALUATED" || item.status === "FAILED";
        }

        return true;
    });

    const diagDetails = selectedDiagnostic?.details;
    const allClaims = diagDetails?.claims || [];
    const filteredClaims = allClaims.filter((c) => {
        if (claimsFilter === "SUPPORTED") return c.supported;
        if (claimsFilter === "UNSUPPORTED") return !c.supported;
        return true;
    });

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 min-h-screen">
            <div className="container mx-auto py-8 px-6 max-w-7xl space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-tr from-indigo-600 to-blue-600 rounded-2xl text-white shadow-md shadow-indigo-500/20">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                Qualidade & Confiabilidade da IA
                            </h1>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                Avaliação assíncrona de fidelidade pedagógica (RAGAS Faithfulness) dos módulos gerados a partir dos materiais de apoio.
                            </p>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchData()}
                        disabled={loading}
                        className="gap-2 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 shrink-0 self-start md:self-auto"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        Atualizar Dados
                    </Button>
                </div>

                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Faithfulness Média */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Faithfulness Médio
                            </span>
                            <span className="text-3xl font-black text-slate-900 block mt-1">
                                {summary?.avgFaithfulness !== null && summary?.avgFaithfulness !== undefined
                                    ? `${summary.avgFaithfulness}%`
                                    : "—"}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium block mt-1">
                                Fidelidade global ao contexto RAG
                            </span>
                        </div>
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                            <BrainCircuit className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Conteúdos Avaliados */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Módulos Avaliados
                            </span>
                            <span className="text-3xl font-black text-slate-900 block mt-1">
                                {summary?.totalEvaluated ?? 0}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium block mt-1">
                                De {summary?.totalModules ?? 0} módulos cadastrados
                            </span>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                            <FileText className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Confiáveis */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Confiáveis (≥ 90%)
                            </span>
                            <span className="text-3xl font-black text-emerald-600 block mt-1">
                                {summary?.trustedCount ?? 0}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium block mt-1">
                                Fundamentação forte nas fontes
                            </span>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Precisam de Revisão */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Precisam de Revisão
                            </span>
                            <span className="text-3xl font-black text-amber-600 block mt-1">
                                {(summary?.reviewCount ?? 0) + (summary?.attentionCount ?? 0)}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium block mt-1">
                                {summary?.reviewCount ?? 0} revisar · {summary?.attentionCount ?? 0} atenção
                            </span>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* Tabela de Módulos & Filtros */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Barra de Filtros */}
                    <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
                        {/* Campo de Busca */}
                        <div className="relative w-full md:w-80">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Buscar módulo por título..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>

                        {/* Botoes de Filtro de Status */}
                        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                                <Filter className="w-3 h-3" /> Filtro:
                            </span>
                            {[
                                { id: "ALL", label: "Todos" },
                                { id: "TRUSTED", label: "🟢 Confiáveis" },
                                { id: "REVIEW", label: "🟡 Revisar" },
                                { id: "ATTENTION", label: "🔴 Atenção" },
                                { id: "OUTDATED_OR_NOT", label: "⚠️ Outros / Não avaliados" },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilterStatus(tab.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === tab.id
                                        ? "bg-slate-900 text-white shadow-sm"
                                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Conteúdo da Tabela */}
                    {loading ? (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                            <span className="text-xs font-semibold">Carregando dados de confiabilidade...</span>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                            <ShieldCheck className="w-8 h-8 text-slate-300" />
                            <p className="text-sm font-bold text-slate-700">Nenhum módulo encontrado</p>
                            <p className="text-xs text-slate-400">Não há módulos correspondentes aos filtros selecionados.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                                        <th className="py-3.5 px-6">Módulo</th>
                                        <th className="py-3.5 px-4">Status & Faithfulness</th>
                                        <th className="py-3.5 px-4">Modelo / Provider</th>
                                        <th className="py-3.5 px-4">Última Avaliação</th>
                                        <th className="py-3.5 px-6 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {filteredItems.map((item) => (
                                        <tr key={item.moduleId} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Módulo */}
                                            <td className="py-4 px-6">
                                                <div className="font-bold text-slate-900 leading-tight">
                                                    {item.moduleTitle}
                                                </div>
                                                {item.description && (
                                                    <p className="text-slate-500 text-[11px] line-clamp-1 mt-0.5 max-w-md">
                                                        {item.description}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Status & Faithfulness */}
                                            <td className="py-4 px-4">
                                                <QualityBadge score={item.score} status={item.status} />
                                            </td>

                                            {/* Modelo / Provider */}
                                            <td className="py-4 px-4 font-mono text-[11px] text-slate-600">
                                                {item.model ? (
                                                    <span>
                                                        {item.model}{" "}
                                                        <span className="text-slate-400 font-sans">
                                                            ({item.provider || "google"})
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-sans italic">—</span>
                                                )}
                                            </td>

                                            {/* Última Avaliação */}
                                            <td className="py-4 px-4 text-slate-500 font-medium">
                                                {item.updatedAt ? (
                                                    <span className="flex items-center gap-1 text-[11px]">
                                                        <Calendar className="w-3 h-3 text-slate-400" />
                                                        {new Date(item.updatedAt).toLocaleString("pt-BR", {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Pendente</span>
                                                )}
                                            </td>

                                            {/* Ações */}
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {item.status === "COMPLETED" && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setSelectedDiagnostic(item)}
                                                            className="h-8 rounded-lg border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs gap-1.5 transition-colors"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                                                            Ver diagnóstico
                                                        </Button>
                                                    )}

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleReevaluate(item.moduleId)}
                                                        disabled={reevaluatingId === item.moduleId || !item.hasSourceFiles}
                                                        title={
                                                            !item.hasSourceFiles
                                                                ? "Processe arquivos de apoio antes de avaliar"
                                                                : "Solicitar reavaliação do conteúdo"
                                                        }
                                                        className="h-8 rounded-lg hover:bg-blue-50 text-blue-600 font-semibold text-xs gap-1 transition-colors disabled:opacity-40"
                                                    >
                                                        <RefreshCw
                                                            className={`w-3.5 h-3.5 ${reevaluatingId === item.moduleId ? "animate-spin" : ""}`}
                                                        />
                                                        Reavaliar
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Diagnóstico de Fidelidade RAGAS */}
            <Dialog open={selectedDiagnostic !== null} onOpenChange={(open) => !open && setSelectedDiagnostic(null)}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
                    {selectedDiagnostic && (
                        <>
                            {/* Modal Header */}
                            <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                Diagnóstico de Faithfulness
                                            </span>
                                            {diagDetails?.isSegmented && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                    <Layers className="w-3 h-3" /> Avaliação Segmentada ({diagDetails.segmentsCount} partes)
                                                </span>
                                            )}
                                        </div>
                                        <DialogTitle className="text-xl font-black text-slate-900 mt-1">
                                            {selectedDiagnostic.moduleTitle}
                                        </DialogTitle>
                                        <DialogDescription className="text-xs text-slate-500 mt-0.5">
                                            Análise detalhada de fundamentação das afirmações extraídas do conteúdo contra o material de apoio.
                                        </DialogDescription>
                                    </div>
                                    <QualityBadge score={selectedDiagnostic.score} status={selectedDiagnostic.status} />
                                </div>
                            </DialogHeader>

                            {/* Scrollable Content Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                                {/* Resumo de Claims */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 text-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                            Total de Afirmações
                                        </span>
                                        <span className="text-2xl font-black text-slate-800 block mt-0.5">
                                            {diagDetails?.totalClaims ?? 0}
                                        </span>
                                    </div>
                                    <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 text-center">
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                                            Suportadas
                                        </span>
                                        <span className="text-2xl font-black text-emerald-700 block mt-0.5">
                                            {diagDetails?.supportedClaims ?? 0}
                                        </span>
                                    </div>
                                    <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-100 text-center">
                                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                                            Não Suportadas
                                        </span>
                                        <span className="text-2xl font-black text-rose-700 block mt-0.5">
                                            {diagDetails?.unsupportedClaims ?? 0}
                                        </span>
                                    </div>
                                </div>

                                {/* Barra de Filtro de Claims */}
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                        Afirmações Identificadas ({filteredClaims.length})
                                    </h4>
                                    <div className="flex items-center gap-1">
                                        {[
                                            { id: "ALL", label: `Todas (${allClaims.length})` },
                                            { id: "SUPPORTED", label: `🟢 Suportadas (${diagDetails?.supportedClaims ?? 0})` },
                                            { id: "UNSUPPORTED", label: `🔴 Não Suportadas (${diagDetails?.unsupportedClaims ?? 0})` },
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => setClaimsFilter(t.id as any)}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${claimsFilter === t.id
                                                    ? "bg-slate-800 text-white shadow-xs"
                                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                                    }`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Lista de Afirmações */}
                                {filteredClaims.length === 0 ? (
                                    <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                                        Nenhuma afirmação encontrada para o filtro selecionado.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredClaims.map((claim, i) => (
                                            <div
                                                key={i}
                                                className={`p-4 rounded-xl border transition-all ${claim.supported
                                                    ? "bg-white border-slate-200 shadow-2xs"
                                                    : "bg-rose-50/30 border-rose-200/80 shadow-2xs"
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 shrink-0">
                                                        {claim.supported ? (
                                                            <div className="p-1 bg-emerald-100 text-emerald-700 rounded-full">
                                                                <Check className="w-3.5 h-3.5" />
                                                            </div>
                                                        ) : (
                                                            <div className="p-1 bg-rose-100 text-rose-700 rounded-full">
                                                                <XCircle className="w-3.5 h-3.5" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="text-xs font-bold text-slate-900 leading-snug">
                                                                &ldquo;{claim.statement}&rdquo;
                                                            </p>
                                                            <span
                                                                className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${claim.supported
                                                                    ? "bg-emerald-100 text-emerald-800"
                                                                    : "bg-rose-100 text-rose-800"
                                                                    }`}
                                                            >
                                                                {claim.supported ? "SUPORTADA" : "NÃO SUPORTADA"}
                                                            </span>
                                                        </div>

                                                        {/* Justificativa do avaliador */}
                                                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-600">
                                                            <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">
                                                                Justificativa do avaliador:
                                                            </span>
                                                            <p className="italic leading-relaxed">{claim.reason}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Seção de Auditoria */}
                                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                        <Cpu className="w-3.5 h-3.5 text-indigo-500" /> Metadados de Auditoria & Confiabilidade
                                    </h4>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Modelo Avaliador</span>
                                            <span className="font-mono text-slate-800 font-semibold">
                                                {diagDetails?.model || selectedDiagnostic.model || "gemini-3.6-flash"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Versão RAGAS</span>
                                            <span className="font-mono text-slate-800 font-semibold">
                                                {diagDetails?.evaluatorVersion || selectedDiagnostic.evaluatorVersion || "0.4.3"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Latência</span>
                                            <span className="font-mono text-slate-800 font-semibold flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                {diagDetails?.latencyMs ? `${(diagDetails.latencyMs / 1000).toFixed(1)}s` : "—"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Contextos Utilizados</span>
                                            <span className="font-mono text-slate-800 font-semibold">
                                                {diagDetails?.sourceChunkIds ? `${diagDetails.sourceChunkIds.length} chunks` : "—"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
