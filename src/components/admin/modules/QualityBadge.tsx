// src/components/admin/modules/QualityBadge.tsx
// Componente reusável de exibição do status e score de fidelidade RAGAS (Faithfulness).
// Suporta tooltips educativos e os 7 estados possíveis da avaliação.

"use client";

import { CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, HelpCircle, XCircle } from "lucide-react";

interface QualityBadgeProps {
    score?: number | null;
    status?: string | null;
    className?: string;
    showTooltip?: boolean;
    trustedThreshold?: number;
    reviewThreshold?: number;
}

export function QualityBadge({
    score,
    status = "NOT_EVALUATED",
    className = "",
    showTooltip = true,
    trustedThreshold = 0.90,
    reviewThreshold = 0.80,
}: QualityBadgeProps) {

    let badgeConfig = {
        label: "Não avaliado",
        scoreText: "",
        tooltip: "Este conteúdo ainda não passou pela avaliação automática de confiabilidade.",
        bgColor: "bg-slate-100",
        textColor: "text-slate-600",
        borderColor: "border-slate-200",
        icon: HelpCircle,
    };

    if (status === "PENDING" || status === "PROCESSING") {
        badgeConfig = {
            label: "Avaliando...",
            scoreText: "",
            tooltip: "A IA está avaliando a fidelidade deste conteúdo em relação aos documentos fornecidos.",
            bgColor: "bg-blue-50",
            textColor: "text-blue-700",
            borderColor: "border-blue-200",
            icon: RefreshCw,
        };
    } else if (status === "OUTDATED") {
        badgeConfig = {
            label: "Avaliação desatualizada",
            scoreText: "",
            tooltip: "O conteúdo foi editado após a última avaliação. Clique em Reavaliar para atualizar o score.",
            bgColor: "bg-amber-50",
            textColor: "text-amber-700",
            borderColor: "border-amber-200",
            icon: AlertTriangle,
        };
    } else if (status === "FAILED") {
        badgeConfig = {
            label: "Falha na avaliação",
            scoreText: "",
            tooltip: "Ocorreu um erro temporário durante a avaliação RAGAS. Você pode solicitar reavaliação.",
            bgColor: "bg-orange-50",
            textColor: "text-orange-700",
            borderColor: "border-orange-200",
            icon: XCircle,
        };
    } else if (status === "COMPLETED" && typeof score === "number") {
        const percentage = Math.round(score * 100);
        const scoreFormatted = `${percentage}% de fidelidade`;

        if (score >= trustedThreshold) {
            badgeConfig = {
                label: "Confiável",
                scoreText: scoreFormatted,
                tooltip: "Indica o grau em que as afirmações produzidas pela IA estão fundamentadas nos trechos recuperados dos materiais fornecidos.",
                bgColor: "bg-emerald-50",
                textColor: "text-emerald-700",
                borderColor: "border-emerald-200",
                icon: CheckCircle2,
            };
        } else if (score >= reviewThreshold) {
            badgeConfig = {
                label: "Revisar",
                scoreText: scoreFormatted,
                tooltip: "Alguns trechos podem não ter fundamentação completa nos documentos recuperados. Recomenda-se revisão.",
                bgColor: "bg-amber-50",
                textColor: "text-amber-700",
                borderColor: "border-amber-200",
                icon: AlertTriangle,
            };
        } else {
            badgeConfig = {
                label: "Atenção",
                scoreText: scoreFormatted,
                tooltip: "Baixa fidelidade ao contexto recuperado. O conteúdo pode conter trechos sem fundamentação direta nas fontes.",
                bgColor: "bg-rose-50",
                textColor: "text-rose-700",
                borderColor: "border-rose-200",
                icon: AlertCircle,
            };
        }
    }

    const Icon = badgeConfig.icon;
    const isSpinning = status === "PENDING" || status === "PROCESSING";

    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${badgeConfig.bgColor} ${badgeConfig.textColor} ${badgeConfig.borderColor} ${className}`}
            title={showTooltip ? badgeConfig.tooltip : undefined}
        >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${isSpinning ? "animate-spin" : ""}`} />
            <span className="font-bold">{badgeConfig.label}</span>
            {badgeConfig.scoreText && (
                <>
                    <span className="opacity-40">|</span>
                    <span className="font-mono">{badgeConfig.scoreText}</span>
                </>
            )}
        </div>
    );
}
