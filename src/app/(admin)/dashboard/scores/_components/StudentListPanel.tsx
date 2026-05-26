"use client";

import { useState } from "react";
import { Search, Star, ChevronRight, GraduationCap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ModuleEntry {
  id: string;
  title: string;
}

interface StudentListPanelProps {
  modules: ModuleEntry[];
  selectedModuleId: string | null;
  onSelectModule: (id: string) => void;
  studentData: any;
  currentPage: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  selectedStudentId: string | null;
  onSelectStudent: (id: string | null) => void;
}

export function StudentListPanel({
  modules,
  selectedModuleId,
  onSelectModule,
  studentData,
  currentPage,
  onPageChange,
  loading,
  selectedStudentId,
  onSelectStudent,
}: StudentListPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const students = studentData?.students || [];
  const total = studentData?.total || 0;
  const totalPages = studentData?.totalPages || 1;

  // Filtra estudantes da página atual baseado na pesquisa por nome/email
  const filteredStudents = students.filter((student: any) => {
    const query = searchQuery.toLowerCase();
    return (
      (student.name || "").toLowerCase().includes(query) ||
      (student.email || "").toLowerCase().includes(query)
    );
  });

  const getScoreBadgeStyles = (score: number | null) => {
    if (score === null) {
      return "bg-slate-50 text-slate-400 border-slate-100";
    }
    if (score >= 7) {
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400";
    }
    if (score >= 4) {
      return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400";
    }
    return "bg-rose-50 text-rose-750 border-rose-100 dark:bg-rose-950/20 dark:text-rose-450";
  };

  // Formata o texto "Mostrando X a Y de Z"
  const pageSize = 8;
  const fromIndex = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const toIndex = Math.min(currentPage * pageSize, total);

  // Iniciais do estudante para o avatar
  const getInitials = (name: string | null) => {
    if (!name) return "S";
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl flex flex-col h-full shadow-sm overflow-hidden">
      {/* Header com Filtros */}
      <div className="p-5 border-b border-slate-100 space-y-4 bg-slate-50/40 shrink-0">
        <div className="grid grid-cols-2 gap-3">
          {/* Seletor de Módulo */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Módulo
            </label>
            <select
              value={selectedModuleId || ""}
              onChange={(e) => onSelectModule(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors shadow-sm cursor-pointer"
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Turma (Escopo Futuro) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              Turma
              <span className="text-[9px] font-semibold text-blue-500 bg-blue-50 px-1 py-0.2 rounded-md">
                Breve
              </span>
            </label>
            <select
              disabled
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-150 text-slate-400 rounded-xl px-3 py-2 outline-none cursor-not-allowed shadow-none"
              title="A filtragem por turmas estará disponível em breve."
            >
              <option value="">Todas as turmas</option>
            </select>
          </div>
        </div>

        {/* Input de Pesquisa */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar aluno por nome ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 text-slate-800 placeholder-slate-450 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 transition-colors shadow-sm"
          />
        </div>
      </div>

      {/* Lista de Alunos (Scrollable) */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-48 space-y-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="text-xs text-slate-500 font-medium">Buscando estudantes...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-48 text-center p-6">
            <Users className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-650">Nenhum aluno encontrado</p>
            <p className="text-[11px] text-slate-450 mt-1 max-w-[200px]">
              Tente redefinir sua busca ou selecionar outro módulo.
            </p>
          </div>
        ) : (
          filteredStudents.map((student: any) => {
            const isSelected = student.id === selectedStudentId;
            return (
              <div
                key={student.id}
                onClick={() => onSelectStudent(isSelected ? null : student.id)}
                className={`flex items-center justify-between p-4 cursor-pointer transition-all border-l-4 ${
                  isSelected
                    ? "bg-blue-50/60 border-l-blue-600 text-blue-900 shadow-[inset_1px_0_0_0_rgba(37,99,235,0.05)]"
                    : "border-l-transparent hover:bg-slate-50/50 text-slate-700"
                }`}
              >
                {/* Avatar e Detalhes Pessoais */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center border shrink-0 ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-500/10"
                        : "bg-gradient-to-tr from-slate-100 to-slate-50 text-slate-750 border-slate-200"
                    }`}
                  >
                    {getInitials(student.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold truncate leading-snug">
                        {student.name || "Sem Nome"}
                      </p>
                      {student.isTopPerformer && (
                        <span title="Melhor Média do Módulo">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {student.email}
                    </p>
                  </div>
                </div>

                {/* Notas e Estatísticas Rápidas */}
                <div className="flex items-center gap-4 shrink-0 pl-3">
                  <div className="text-right space-y-1">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 block">Última:</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold px-1.5 py-0 rounded-md shrink-0 border ${getScoreBadgeStyles(
                          student.lastScore
                        )}`}
                      >
                        {student.lastScore !== null
                          ? student.lastScore.toFixed(1)
                          : "-"}
                      </Badge>
                    </div>

                    <div className="text-[10px] text-slate-500 font-medium">
                      Média:{" "}
                      <span className="font-bold text-slate-700">
                        {student.averageScore !== null
                          ? student.averageScore.toFixed(1)
                          : "-"}
                      </span>{" "}
                      ({student.attemptsCount}x)
                    </div>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 transition-transform duration-200 shrink-0 ${
                      isSelected ? "text-blue-600 translate-x-0.5" : "text-slate-350"
                    }`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Paginação do Painel */}
      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30 shrink-0">
        <span className="text-[10px] font-bold text-slate-450">
          Mostrando {fromIndex} a {toIndex} de {total} alunos
        </span>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className="w-7 h-7 p-0 flex items-center justify-center border-slate-200 text-slate-650 hover:bg-white rounded-lg disabled:opacity-50"
          >
            &lt;
          </Button>

          {/* Renderização de Páginas */}
          {[...Array(totalPages)].map((_, index) => {
            const pageNum = index + 1;
            const isCurrent = pageNum === currentPage;
            return (
              <Button
                key={pageNum}
                variant={isCurrent ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                disabled={loading}
                className={`w-7 h-7 p-0 flex items-center justify-center rounded-lg font-bold text-xs ${
                  isCurrent
                    ? "bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-sm shadow-blue-500/10"
                    : "border-slate-200 text-slate-600 hover:bg-white"
                }`}
              >
                {pageNum}
              </Button>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className="w-7 h-7 p-0 flex items-center justify-center border-slate-200 text-slate-650 hover:bg-white rounded-lg disabled:opacity-50"
          >
            &gt;
          </Button>
        </div>
      </div>
    </div>
  );
}
