"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, DollarSign, Zap, Clock, Star, RefreshCw, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    LineChart,
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

interface AiMetricsData {
    summary: {
        totalCostUsd: number;
        totalGenerations: number;
        avgCriticScore: number;
        avgGenerationTimeMs: number;
        totalTokens: number;
    };
    cache: {
        totalHits: number;
        totalEntries: number;
    };
    pipelines: Array<{
        name: string;
        costUsd: number;
        count: number;
        avgTime: number;
        avgScore: number;
        totalTokens: number;
    }>;
    timeSeries: Array<{
        date: string;
        totalCost: number;
        avgScore: number;
        count: number;
    }>;
}

export default function AiMetricsDashboard() {
    const [data, setData] = useState<AiMetricsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/dashboard/ai-metrics");
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error("Error fetching AI metrics:", error);
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
        return <div className="p-8 text-red-500">Falha ao carregar as métricas de IA.</div>;
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto py-8 px-4 max-w-6xl">
                <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                            <BrainCircuit className="w-8 h-8 text-blue-600" />
                            Métricas de IA e Custos
                        </h1>
                        <p className="text-gray-500 mt-1">Monitore o desempenho, qualidade pedagógica e custos das gerações da IA.</p>
                    </div>
                    <Button onClick={fetchData} disabled={loading} variant="outline" className="shadow-sm">
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Atualizar
                    </Button>
                </header>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Custo Total (USD)</CardTitle>
                            <DollarSign className="w-4 h-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${data.summary.totalCostUsd.toFixed(4)}</div>
                            <p className="text-xs text-gray-500 mt-1">
                                {data.summary.totalTokens.toLocaleString()} tokens gerados
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Qualidade Pedagógica</CardTitle>
                            <Star className="w-4 h-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{(data.summary.avgCriticScore * 100).toFixed(1)}%</div>
                            <p className="text-xs text-gray-500 mt-1">
                                Média do Critic Score Global
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Economia via Cache</CardTitle>
                            <Zap className="w-4 h-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.cache.totalHits} Hits</div>
                            <p className="text-xs text-gray-500 mt-1">
                                Em {data.cache.totalEntries} entradas armazenadas
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Tempo de Geração</CardTitle>
                            <Clock className="w-4 h-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{(data.summary.avgGenerationTimeMs / 1000).toFixed(2)}s</div>
                            <p className="text-xs text-gray-500 mt-1">
                                Média por chamada à IA
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Time Series Chart */}
                    <Card className="col-span-1 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart2 className="w-5 h-5 text-gray-500" />
                                Evolução de Qualidade e Volume
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {data.timeSeries.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data.timeSeries}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6b7280" }} tickMargin={10} />
                                        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(val) => val} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                                        <RechartsTooltip />
                                        <Legend />
                                        <Line yAxisId="left" type="monotone" name="Gerações" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        <Line yAxisId="right" type="monotone" name="Critic Score" dataKey="avgScore" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-gray-400">
                                    Sem dados temporais disponíveis.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pipeline Breakdown */}
                    <Card className="col-span-1 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Zap className="w-5 h-5 text-gray-500" />
                                Volume por Pipeline
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {data.pipelines.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.pipelines} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: "#4b5563" }} />
                                        <RechartsTooltip cursor={{ fill: '#f3f4f6' }} />
                                        <Legend />
                                        <Bar name="Custo USD" dataKey="costUsd" fill="#10b981" radius={[0, 4, 4, 0]} />
                                        <Bar name="Volume (Qtd)" dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-gray-400">
                                    Nenhum pipeline executado.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Pipeline Data Table */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Detalhamento por Pipeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3">Pipeline</th>
                                        <th className="px-4 py-3">Volume</th>
                                        <th className="px-4 py-3">Score Médio</th>
                                        <th className="px-4 py-3">Tempo Médio</th>
                                        <th className="px-4 py-3">Tokens Totais</th>
                                        <th className="px-4 py-3 text-right">Custo Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.pipelines.map((p) => (
                                        <tr key={p.name} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                                            <td className="px-4 py-3">{p.count}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.avgScore >= 0.8 ? 'bg-green-100 text-green-700' : p.avgScore >= 0.6 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                    {(p.avgScore * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">{(p.avgTime / 1000).toFixed(2)}s</td>
                                            <td className="px-4 py-3">{p.totalTokens.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-medium text-green-600">
                                                ${p.costUsd.toFixed(4)}
                                            </td>
                                        </tr>
                                    ))}
                                    {data.pipelines.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                                Nenhum dado encontrado.
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
