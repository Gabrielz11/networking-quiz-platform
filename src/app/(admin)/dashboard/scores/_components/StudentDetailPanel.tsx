"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap,
  Calendar,
  Clock,
  BookOpen,
  Award,
  ChevronLeft,
  Activity,
  User,
  CheckCircle,
  HelpCircle,
  LogIn
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface StudentDetailPanelProps {
  studentId: string | null;
  moduleId: string | null;
  onBackToList: () => void;
}

export function StudentDetailPanel({
  studentId,
  moduleId,
  onBackToList,
}: StudentDetailPanelProps) {
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!studentId) {
      setStudent(null);
      return;
    }

    const fetchStudentDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/student/${studentId}`);
        if (!res.ok) {
          throw new Error("Erro ao carregar detalhes do aluno.");
        }
        const data = await res.json();
        setStudent(data);
      } catch (err: any) {
        toast.error(err.message || "Não foi possível carregar o perfil.");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentDetail();
  }, [studentId]);

  // Se nenhum aluno estiver selecionado
  if (!studentId) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full shadow-sm">
        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-5 border border-slate-100 shadow-inner">
          <GraduationCap className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-base font-bold text-slate-800">Nenhum aluno selecionado</h3>
        <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
          Selecione um aluno na lista à esquerda para analisar o seu progresso de aprendizado, tentativas e atividades recentes.
        </p>
      </div>
    );
  }

  // Se estiver carregando os detalhes
  if (loading || !student) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-6 flex flex-col h-full shadow-sm space-y-6 overflow-y-auto animate-pulse">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-14 h-14 bg-slate-200 rounded-full"></div>
          <div className="space-y-2">
            <div className="h-4 w-40 bg-slate-200 rounded"></div>
            <div className="h-3 w-56 bg-slate-150 rounded"></div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl"></div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-slate-100 rounded-xl"></div>
          <div className="h-48 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Localiza os dados específicos do módulo selecionado
  const currentModMetric = student.moduleMetrics.find(
    (m: any) => m.moduleId === moduleId
  );

  const attemptsCount = currentModMetric?.attemptsCount || 0;
  const averageScore = currentModMetric?.averageScore;
  const lastScore = currentModMetric?.lastScore;
  const accessesCount = currentModMetric?.accessesCount || 0;

  // Prepara dados do gráfico de evolução (AreaChart)
  const evolutionData = (currentModMetric?.scores || []).map(
    (s: any, index: number) => ({
      name: `${index + 1}ª Tent`,
      nota: s.score,
    })
  );

  // Prepara dados do gráfico de pizza (Donut: Acertos vs Erros da última tentativa)
  const lastAttemptScoreVal = lastScore !== null && lastScore !== undefined ? lastScore : 0;
  const correctCount = lastAttemptScoreVal;
  const incorrectCount = 10 - correctCount;

  const donutData = [
    { name: "Acertos", value: correctCount, color: "#10b981" },
    { name: "Erros", value: incorrectCount, color: "#cbd5e1" },
  ];

  // Estilo de cores para os badges de notas
  const getScoreBadgeStyles = (score: number | null) => {
    if (score === null) return "bg-slate-50 text-slate-400 border-slate-200";
    if (score >= 7) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (score >= 4) return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-rose-50 text-rose-700 border-rose-100";
  };

  // Iniciais do aluno
  const studentInitials = student.name
    ? student.name
        .split(" ")
        .map((p: string) => p.charAt(0))
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "S";

  return (
    <div className="bg-white border border-slate-100 rounded-2xl flex flex-col h-full shadow-sm overflow-hidden">
      {/* Detail Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/20 shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToList}
            className="lg:hidden w-8 h-8 p-0 flex items-center justify-center border-slate-200 text-slate-650 hover:bg-white rounded-lg shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center border-2 border-white shadow-md shrink-0"
          >
            {studentInitials}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {student.name || "Sem Nome"}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">{student.email}</p>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1 justify-end">
            <Calendar className="w-3 h-3 text-slate-350" />
            Cadastro
          </div>
          <p className="text-xs font-bold text-slate-700 mt-1">
            {new Date(student.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      {/* Detail Body (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
          {/* Card 1: Última Nota */}
          <div className="bg-slate-50/50 border border-slate-100/80 rounded-xl p-3 text-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)] flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Última Nota
            </span>
            <div className="my-1.5">
              <span className="text-lg font-black text-slate-800">
                {lastScore !== null && lastScore !== undefined ? lastScore.toFixed(1) : "-"}
              </span>
              {lastScore !== null && lastScore !== undefined && (
                <span className="text-[10px] text-slate-400 font-semibold">/10</span>
              )}
            </div>
            <Badge
              variant="outline"
              className={`text-[9px] font-bold py-0 justify-center block border ${getScoreBadgeStyles(
                lastScore !== undefined ? lastScore : null
              )}`}
            >
              {lastScore !== null && lastScore !== undefined
                ? lastScore >= 7
                  ? "Aprovado"
                  : lastScore >= 4
                  ? "Recuperação"
                  : "Reprovado"
                : "Sem quiz"}
            </Badge>
          </div>

          {/* Card 2: Média */}
          <div className="bg-slate-50/50 border border-slate-100/80 rounded-xl p-3 text-center flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Média Geral
            </span>
            <div className="my-1.5">
              <span className="text-lg font-black text-slate-800">
                {averageScore !== null && averageScore !== undefined
                  ? averageScore.toFixed(1)
                  : "-"}
              </span>
              {averageScore !== null && averageScore !== undefined && (
                <span className="text-[10px] text-slate-400 font-semibold">/10</span>
              )}
            </div>
            <span className="text-[9px] font-medium text-slate-500 block">
              Histórico no módulo
            </span>
          </div>

          {/* Card 3: Tentativas */}
          <div className="bg-slate-50/50 border border-slate-100/80 rounded-xl p-3 text-center flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Tentativas
            </span>
            <div className="my-1.5">
              <span className="text-lg font-black text-slate-800">
                {attemptsCount}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">/4</span>
            </div>
            <span className="text-[9px] font-medium text-slate-500 block">
              Máx. suportado
            </span>
          </div>

          {/* Card 4: Acessos */}
          <div className="bg-slate-50/50 border border-slate-100/80 rounded-xl p-3 text-center flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Acessos
            </span>
            <div className="my-1.5">
              <span className="text-lg font-black text-slate-800">
                {accessesCount}
              </span>
            </div>
            <span className="text-[9px] font-medium text-slate-500 block">
              Leituras de conteúdo
            </span>
          </div>

          {/* Card 5: Último Acesso */}
          <div className="bg-slate-50/50 border border-slate-100/80 rounded-xl p-3 text-center col-span-2 sm:col-span-1 flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Último Acesso
            </span>
            <div className="my-1.5 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-450" />
              <span className="text-[10px] font-extrabold text-slate-700 leading-tight">
                {student.globalKpis.lastActivityAt
                  ? new Date(student.globalKpis.lastActivityAt).toLocaleDateString(
                      "pt-BR"
                    )
                  : "Sem dados"}
              </span>
            </div>
            <span className="text-[9px] font-medium text-slate-500 block truncate">
              {student.globalKpis.lastActivityAt
                ? new Date(student.globalKpis.lastActivityAt).toLocaleTimeString(
                    "pt-BR",
                    { hour: "2-digit", minute: "2-digit" }
                  )
                : "Sem atividade"}
            </span>
          </div>
        </div>

        {/* Charts Container */}
        <div>
          <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-3">
            Análise Gráfica (Módulo Atual)
          </h3>

          {attemptsCount === 0 ? (
            <div className="border border-dashed border-slate-200 bg-slate-50/40 rounded-xl p-6 text-center">
              <Award className="w-6 h-6 text-slate-350 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-650">Nenhuma tentativa registrada</p>
              <p className="text-[10px] text-slate-450 mt-0.5">
                O aluno ainda não concluiu nenhum quiz neste módulo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Gráfico 1: Evolução */}
              <div className="md:col-span-8 border border-slate-100 bg-white rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <h4 className="text-[11px] font-bold text-slate-700 mb-4 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-blue-500" />
                  Evolução do Score por Tentativa
                </h4>
                <div className="h-[160px] w-full">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 160 }}>
                    <AreaChart
                      data={evolutionData}
                      margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorNota" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" fontSize={9} stroke="#94a3b8" />
                      <YAxis
                        domain={[0, 10]}
                        ticks={[0, 2, 4, 6, 8, 10]}
                        fontSize={9}
                        stroke="#94a3b8"
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: "10px",
                          borderRadius: "8px",
                          border: "1px solid #f1f5f9",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="nota"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorNota)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico 2: Donut de Acertos */}
              <div className="md:col-span-4 border border-slate-100 bg-white rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <h4 className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Último Quiz
                </h4>
                <div className="relative flex items-center justify-center h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 200, height: 120 }}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={48}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-sm font-black text-slate-800">
                      {correctCount}
                      <span className="text-[10px] text-slate-400 font-semibold">/10</span>
                    </span>
                    <span className="text-[8px] text-slate-450 font-bold">
                      {correctCount * 10}% acerto
                    </span>
                  </div>
                </div>

                <div className="flex justify-center gap-4 text-[9px] font-semibold text-slate-500 mt-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded bg-emerald-500" />
                    Acertos: {correctCount}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded bg-slate-350" />
                    Erros: {incorrectCount}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Attempt History Table */}
        {attemptsCount > 0 && (
          <div>
            <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-3">
              Histórico de Tentativas no Módulo
            </h3>
            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs text-slate-650">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-450 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="p-3">Tentativa</th>
                    <th className="p-3">Data Conclusão</th>
                    <th className="p-3 text-center">Acertos</th>
                    <th className="p-3 text-right">Nota Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentModMetric.scores.map((score: any, i: number) => {
                    const attemptNum = currentModMetric.scores.length - i;
                    return (
                      <tr key={score.id} className="hover:bg-slate-50/20">
                        <td className="p-3 font-semibold text-slate-800">
                          {attemptNum}ª tentativa
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(score.completedAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {score.score}/10
                        </td>
                        <td className="p-3 text-right">
                          <Badge
                            className={`text-[10px] font-bold px-2 py-0 border ${getScoreBadgeStyles(
                              score.score
                            )}`}
                            variant="outline"
                          >
                            {score.score.toFixed(1)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Timeline Activities */}
        <div>
          <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-3">
            Atividades Recentes do Estudante
          </h3>

          {student.recentActivities.length === 0 ? (
            <div className="border border-dashed border-slate-200 bg-slate-50/40 rounded-xl p-6 text-center">
              <Activity className="w-6 h-6 text-slate-350 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-650">Sem histórico disponível</p>
              <p className="text-[10px] text-slate-450 mt-0.5">
                Não há logs de atividade registrados para este estudante.
              </p>
            </div>
          ) : (
            <div className="border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
              <div className="relative border-l border-slate-150 pl-5 ml-2.5 space-y-5">
                {student.recentActivities.map((activity: any) => {
                  // Configuração visual do evento de atividade
                  const getActivityConfig = (type: string) => {
                    switch (type) {
                      case "LOGIN":
                        return {
                          icon: LogIn,
                          color: "bg-blue-100 text-blue-600 border-blue-200",
                          title: "Login Realizado",
                          description: "Acessou a plataforma",
                        };
                      case "MODULE_ACCESS":
                        return {
                          icon: BookOpen,
                          color: "bg-teal-100 text-teal-600 border-teal-200",
                          title: "Leitura de Módulo",
                          description: `Acessou o conteúdo: ${
                            activity.moduleTitle || "Sem título"
                          }`,
                        };
                      case "QUIZ_START":
                        return {
                          icon: HelpCircle,
                          color: "bg-purple-100 text-purple-600 border-purple-200",
                          title: "Iniciou Quiz",
                          description: `Iniciou questionário do módulo: ${
                            activity.moduleTitle || "Sem título"
                          }`,
                        };
                      case "QUIZ_COMPLETE":
                        return {
                          icon: CheckCircle,
                          color: "bg-emerald-100 text-emerald-600 border-emerald-200",
                          title: "Concluiu Quiz",
                          description: `Finalizou questionário do módulo: ${
                            activity.moduleTitle || "Sem título"
                          }`,
                        };
                      case "SCORE_RECORDED":
                        return {
                          icon: Award,
                          color: "bg-amber-100 text-amber-600 border-amber-200",
                          title: "Nota Gravada",
                          description: `Score de ${
                            activity.metadata?.score !== undefined ? activity.metadata.score : "-"
                          }/10 registrado`,
                        };
                      default:
                        return {
                          icon: Activity,
                          color: "bg-slate-100 text-slate-650 border-slate-200",
                          title: "Ação Genérica",
                          description: "Interagiu com o sistema",
                        };
                    }
                  };

                  const config = getActivityConfig(activity.eventType);
                  const IconComponent = config.icon;

                  return (
                    <div key={activity.id} className="relative group">
                      {/* Ponto na linha vertical */}
                      <div
                        className={`absolute -left-8.5 top-0.5 w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${config.color}`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>

                      {/* Conteúdo da Atividade */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-slate-800">
                            {config.title}
                          </p>
                          <span className="text-[9px] text-slate-400 font-semibold">
                            {new Date(activity.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                          {config.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
