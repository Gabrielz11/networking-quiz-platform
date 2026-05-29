"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Clock, TrendingUp, AlertTriangle, RefreshCw, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from "recharts";

interface AnalyticsData {
    global: {
        totalAnswers: number;
        accuracy: number;
        avgResponseTimeMs: number;
    };
    difficulty: Array<{
        difficulty: string;
        total: number;
        avgResponseTimeMs: number;
        accuracy: number;
    }>;
    weaknesses: Array<{
        moduleId: string;
        moduleTitle: string;
        totalAnswers: number;
        accuracy: number;
    }>;
    trends: Array<{
        date: string;
        totalAnswers: number;
        accuracy: number;
    }>;
}

export default function AnalyticsDashboard() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/dashboard/analytics");
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!data) {
        return <div className="p-8 text-red-500">Falha ao carregar o analytics educacional.</div>;
    }

    // Tradução de Dificuldade
    const difficultyMap: Record<string, string> = {
        EASY: "Fácil",
        MEDIUM: "Médio",
        HARD: "Difícil"
    };

    const difficultyColors: Record<string, string> = {
        EASY: "#10b981", // verde
        MEDIUM: "#f59e0b", // amarelo
        HARD: "#ef4444" // vermelho
    };

    const formattedDifficulty = data.difficulty.map(d => ({
        name: difficultyMap[d.difficulty] || d.difficulty,
        accuracyPercent: Number((d.accuracy * 100).toFixed(1)),
        avgTimeSec: Number((d.avgResponseTimeMs / 1000).toFixed(1)),
        fill: difficultyColors[d.difficulty] || "#6366f1"
    }));

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto py-8 px-4 max-w-6xl">
                <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                            <TrendingUp className="w-8 h-8 text-indigo-600" />
                            Analytics Educacional
                        </h1>
                        <p className="text-gray-500 mt-1">Identifique padrões de aprendizagem, fragilidades da turma e engajamento.</p>
                    </div>
                    <Button onClick={fetchData} disabled={loading} variant="outline" className="shadow-sm">
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Atualizar
                    </Button>
                </header>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Taxa de Acerto Global</CardTitle>
                            <Target className="w-4 h-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{(data.global.accuracy * 100).toFixed(1)}%</div>
                            <p className="text-xs text-gray-500 mt-1">
                                Em {data.global.totalAnswers.toLocaleString()} questões respondidas
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Tempo Médio de Resposta</CardTitle>
                            <Clock className="w-4 h-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{(data.global.avgResponseTimeMs / 1000).toFixed(1)}s</div>
                            <p className="text-xs text-gray-500 mt-1">
                                Média global de raciocínio
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Atenção Pedagógica</CardTitle>
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.weaknesses.length} Módulos</div>
                            <p className="text-xs text-gray-500 mt-1">
                                Com taxa de acerto abaixo da média
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Time Series Chart */}
                    <Card className="col-span-1 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-gray-500" />
                                Tendência de Aprendizado (Últimos 14 dias)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {data.trends.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 300 }}>
                                    <ComposedChart data={data.trends}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6b7280" }} tickMargin={10} />
                                        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#6b7280" }} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                                        <RechartsTooltip />
                                        <Legend />
                                        <Bar yAxisId="left" name="Questões Resolvidas" dataKey="totalAnswers" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        <Line yAxisId="right" type="monotone" name="Taxa de Acerto" dataKey="accuracy" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-gray-400">
                                    Sem dados temporais disponíveis.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Difficulty Bar Chart */}
                    <Card className="col-span-1 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart2 className="w-5 h-5 text-gray-500" />
                                Desempenho por Dificuldade
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {formattedDifficulty.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 300 }}>
                                    <BarChart data={formattedDifficulty} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                                        <RechartsTooltip cursor={{ fill: '#f3f4f6' }} />
                                        <Legend />
                                        <Bar yAxisId="left" name="Acerto (%)" dataKey="accuracyPercent" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-gray-400">
                                    Sem dados suficientes por dificuldade.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Weaknesses Data Table */}
                <Card className="shadow-sm border-t-4 border-t-red-500">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Fragilidades da Turma (Revisão Recomendada)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3">Módulo / Tópico</th>
                                        <th className="px-4 py-3">Tentativas</th>
                                        <th className="px-4 py-3">Taxa de Acerto</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.weaknesses.map((w) => (
                                        <tr key={w.moduleId} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-gray-900">{w.moduleTitle}</td>
                                            <td className="px-4 py-3">{w.totalAnswers}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${w.accuracy >= 0.7 ? 'bg-green-100 text-green-700' : w.accuracy >= 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                    {(w.accuracy * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {w.accuracy < 0.5 ? (
                                                    <span className="text-red-600 font-medium">Crítico</span>
                                                ) : w.accuracy < 0.7 ? (
                                                    <span className="text-yellow-600 font-medium">Atenção</span>
                                                ) : (
                                                    <span className="text-green-600 font-medium">Adequado</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {data.weaknesses.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                                Nenhum dado de fragilidade encontrado. A turma está indo bem!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
