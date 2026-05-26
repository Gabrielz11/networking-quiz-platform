"use client";

import { useState, useEffect, useRef } from "react";
import { Download, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentListPanel } from "./StudentListPanel";
import { StudentDetailPanel } from "./StudentDetailPanel";
import { toast } from "sonner";

interface ModuleEntry {
  id: string;
  title: string;
}

interface ScoresLayoutProps {
  modules: ModuleEntry[];
  initialModuleId: string | null;
  initialData: any;
}

export function ScoresLayout({
  modules,
  initialModuleId,
  initialData,
}: ScoresLayoutProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(
    initialModuleId
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );
  const [studentData, setStudentData] = useState<any>(initialData);

  // Refs para os valores iniciais vindos do servidor — estáveis, não devem
  // acionar re-execuções do efeito quando o módulo selecionado muda.
  const initialModuleIdRef = useRef(initialModuleId);
  const initialDataRef = useRef(initialData);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // Determina o título do módulo selecionado para o CSV/Relatórios
  const currentModuleTitle =
    modules.find((m) => m.id === selectedModuleId)?.title || "Modulo";

  // Função para buscar lista de estudantes do banco
  const fetchStudents = async (moduleId: string, page: number) => {
    setLoadingStudents(true);
    try {
      const res = await fetch(
        `/api/dashboard/students?moduleId=${moduleId}&page=${page}&pageSize=8`
      );
      if (!res.ok) {
        throw new Error("Erro ao buscar alunos.");
      }
      const data = await res.json();
      setStudentData(data);
    } catch (error: any) {
      toast.error(error.message || "Erro de conexão ao carregar alunos.");
    } finally {
      setLoadingStudents(false);
    }
  };

  // Ao alterar o módulo, resetamos a página e o aluno selecionado.
  // initialModuleIdRef/initialDataRef são usados para evitar re-fetch quando o
  // módulo inicial já veio pré-carregado do servidor.
  useEffect(() => {
    if (selectedModuleId) {
      if (selectedModuleId === initialModuleIdRef.current && currentPage === 1) {
        setStudentData(initialDataRef.current);
      } else {
        fetchStudents(selectedModuleId, 1);
        setCurrentPage(1);
      }
      setSelectedStudentId(null);
    }
    // fetchStudents é recriada a cada render; como dependência intencional
    // apenas selectedModuleId dispara a busca ao trocar de módulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModuleId]);

  // Ao alterar a página
  const handlePageChange = (page: number) => {
    if (selectedModuleId) {
      setCurrentPage(page);
      fetchStudents(selectedModuleId, page);
    }
  };

  // Exportar relatório completo de todos os alunos deste módulo em CSV
  const handleExportCSV = async () => {
    if (!selectedModuleId) return;
    setExporting(true);
    try {
      // Busca todos os estudantes para o módulo de uma vez só (pageSize grande)
      const res = await fetch(
        `/api/dashboard/students?moduleId=${selectedModuleId}&page=1&pageSize=1000`
      );
      if (!res.ok) throw new Error("Erro ao gerar dados do relatório.");

      const data = await res.json();
      const studentsList = data.students || [];

      if (studentsList.length === 0) {
        toast.info("Não há dados de alunos para exportar.");
        return;
      }

      // Cabeçalho CSV
      const headers = [
        "Nome",
        "E-mail",
        "Última Nota (0-10)",
        "Média de Notas (0-10)",
        "Tentativas Concluídas",
        "Acessos ao Conteúdo",
        "Última Atividade",
      ];

      // Linhas de dados
      const rows = studentsList.map((student: any) => [
        student.name || "Sem nome",
        student.email || "Sem e-mail",
        student.lastScore !== null ? student.lastScore.toFixed(1) : "-",
        student.averageScore !== null ? student.averageScore.toFixed(1) : "-",
        student.attemptsCount,
        student.accessCount,
        student.lastActivityAt
          ? new Date(student.lastActivityAt).toLocaleString("pt-BR")
          : "-",
      ]);

      // Une cabeçalho e linhas em formato CSV (separado por ponto e vírgula para compatibilidade com Excel)
      const csvContent =
        "\uFEFF" + // UTF-8 BOM para caracteres especiais como acentos
        [headers.join(";"), ...rows.map((r: any) => r.join(";"))].join("\n");

      // Cria blob e dispara download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const cleanTitle = currentModuleTitle
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_notas_${cleanTitle}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Relatório exportado com sucesso!");
    } catch (err: any) {
      toast.error("Falha ao exportar relatório: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 space-y-6 overflow-hidden min-h-0 bg-slate-50/30">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Notas &amp; Desempenho
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Monitore o aproveitamento dos alunos, acertos, tentativas e histórico de atividades por módulo.
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          disabled={exporting || !selectedModuleId}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/10 active:scale-[0.98]"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Exportando..." : "Exportar Relatório"}
        </Button>
      </div>

      {/* Grid Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden min-h-0">
        {/* Left Side: Student List */}
        <div className="lg:col-span-5 flex flex-col overflow-hidden min-h-0">
          <StudentListPanel
            modules={modules}
            selectedModuleId={selectedModuleId}
            onSelectModule={setSelectedModuleId}
            studentData={studentData}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            loading={loadingStudents}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
          />
        </div>

        {/* Right Side: Student Detail */}
        <div className="lg:col-span-7 flex flex-col overflow-hidden min-h-0">
          <StudentDetailPanel
            studentId={selectedStudentId}
            moduleId={selectedModuleId}
            onBackToList={() => setSelectedStudentId(null)}
          />
        </div>
      </div>
    </div>
  );
}
