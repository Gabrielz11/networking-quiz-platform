import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    ChevronLeft,
    Plus,
    Sparkles,
    BookOpen,
    Edit3,
    ArrowRight,
    Wand2,
    Paperclip,
} from "lucide-react";
import { useState } from "react";
import { ModuleSourceUploader } from "@/components/admin/modules/ModuleSourceUploader";
import { ModuleSourceFilesList } from "@/components/admin/modules/ModuleSourceFilesList";
import { GenerateContentWithRagButton } from "@/components/admin/modules/GenerateContentWithRagButton";

interface ModulesPageHeaderProps {
    isDialogOpen: boolean;
    setIsDialogOpen: (open: boolean) => void;
    editingId: string | null;
    title: string;
    setTitle: (v: string) => void;
    description: string;
    setDescription: (v: string) => void;
    content: string;
    setContent: (v: string) => void;
    canGenerate: boolean;
    isGenerating: boolean;
    handleGenerateContent: () => void;
    handleSave: (e: React.FormEvent) => void;
    openCreateDialog: () => void;
}

export function ModulesPageHeader({
    isDialogOpen,
    setIsDialogOpen,
    editingId,
    title,
    setTitle,
    description,
    setDescription,
    content,
    setContent,
    canGenerate,
    isGenerating,
    handleGenerateContent,
    handleSave,
    openCreateDialog,
}: ModulesPageHeaderProps) {
    const [fileRefreshKey, setFileRefreshKey] = useState(0);
    const [hasProcessedFiles, setHasProcessedFiles] = useState(false);

    const handleFilesChange = (files: { status: string }[]) => {
        setHasProcessedFiles(files.some((f) => f.status === "PROCESSED"));
    };

    return (
        <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
            <Link href="/dashboard" className="group inline-flex items-center text-sm font-semibold text-gray-400 hover:text-blue-600 transition-colors mb-4">
                <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
                Painel do Professor
            </Link>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                        Gestão de Módulos
                        <Badge variant="outline" className="text-blue-600 border-blue-100 bg-blue-50/50">Admin</Badge>
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg">Organize o conhecimento e automatize avaliações com IA.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreateDialog} size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 rounded-2xl h-14 px-8 group transition-all active:scale-95">
                            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                            <span className="text-base font-bold">Criar Novo Módulo</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-3xl rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl max-h-[92vh] flex flex-col">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white flex-shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-xl"></div>
                            <DialogTitle className="text-2xl font-black flex items-center gap-3 relative z-10">
                                {editingId ? <Edit3 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                                {editingId ? "Editar Módulo" : "Novo Módulo"}
                            </DialogTitle>
                            <p className="text-blue-100 text-sm mt-1 relative z-10">Configure o conteúdo técnico e o resumo acadêmico.</p>
                        </div>

                        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden bg-white">
                            <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                                <div className="space-y-6">
                                    {/* Título do Módulo */}
                                    <div className="space-y-3">
                                        <Label className="text-gray-900 font-black text-xs uppercase tracking-widest ml-1">Título do Módulo</Label>
                                        <Input
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Ex: Introdução ao IPv6"
                                            required
                                            className="h-14 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:ring-blue-500 transition-all border-2 text-lg font-medium"
                                        />
                                    </div>

                                    {/* Resumo Curto */}
                                    <div className="space-y-3">
                                        <Label className="text-gray-900 font-black text-xs uppercase tracking-widest ml-1">Resumo Curto (Descrição)</Label>
                                        <Input
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Descreve brevemente o objetivo do módulo..."
                                            className="h-14 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:ring-blue-500 transition-all border-2"
                                        />
                                    </div>

                                    {/* Material de Estudo */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start ml-1 gap-4 flex-wrap">
                                            <div>
                                                <Label className="text-gray-900 font-black text-xs uppercase tracking-widest">Material de Estudo</Label>
                                                <p className="text-gray-400 text-xs mt-1 font-medium">
                                                    {canGenerate
                                                        ? "Clique em \"Assistente IA\" para gerar o conteúdo com base no que foi preenchido."
                                                        : "Preencha o Título, o Resumo ou escreva algum tópico abaixo para ativar o Assistente IA."}
                                                </p>
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={handleGenerateContent}
                                                    disabled={isGenerating || !canGenerate}
                                                    title={!canGenerate ? "Preencha algum campo para usar o Assistente IA" : "Gerar conteúdo com IA"}
                                                    className={`border-none font-bold h-9 px-4 flex gap-2 active:scale-95 transition-all shadow-sm
                                                        ${canGenerate
                                                            ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                                                            : "bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
                                                        }`}
                                                >
                                                    {isGenerating
                                                        ? <Sparkles className="w-4 h-4 animate-spin" />
                                                        : <Wand2 className="w-4 h-4" />
                                                    }
                                                    {isGenerating ? "Gerando..." : "Assistente IA"}
                                                </Button>
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-black h-9 px-4 uppercase text-[10px]">Texto Livre</Badge>
                                            </div>
                                        </div>

                                        <div className={`relative group transition-all duration-300 ${isGenerating ? "opacity-70" : ""}`}>
                                            {isGenerating && (
                                                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500 rounded-3xl opacity-75 animate-pulse blur-sm pointer-events-none z-10" />
                                            )}
                                            <Textarea
                                                rows={15}
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                                placeholder={`Escreva tópicos ou conteúdo de base aqui...\n\nExemplo:\n- Conceitos de endereçamento IPv6\n- Diferenças em relação ao IPv4\n- Tipos de endereços: unicast, multicast, anycast\n\nA IA irá expandir e estruturar o conteúdo automaticamente.`}
                                                disabled={isGenerating}
                                                className={`relative rounded-3xl border-2 bg-gray-50 focus:bg-white resize-none font-sans text-base p-8 leading-relaxed min-h-[380px] shadow-inner transition-all z-0
                                                    ${isGenerating
                                                        ? "border-purple-200 cursor-wait"
                                                        : "border-gray-100 focus:ring-blue-600"
                                                    }`}
                                            />
                                            {!content && !isGenerating && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20 pointer-events-none">
                                                    <BookOpen className="w-14 h-14 mb-3 text-gray-400" />
                                                    <span className="text-sm font-bold text-gray-400">Conteúdo do Professor + IA = Módulo Completo</span>
                                                </div>
                                            )}
                                            {isGenerating && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                                                    <div className="flex items-center gap-3 bg-white/90 px-6 py-3 rounded-2xl shadow-lg">
                                                        <Sparkles className="w-5 h-5 text-purple-600 animate-spin" />
                                                        <span className="text-sm font-bold text-purple-700">A IA está gerando o conteúdo...</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ===== SEÇÃO RAG: Materiais de Apoio ===== */}
                                    {editingId && (
                                        <div className="space-y-4 pt-2 border-t border-gray-100">
                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-2 ml-1">
                                                    <Paperclip className="w-4 h-4 text-emerald-600" />
                                                    <Label className="text-gray-900 font-black text-xs uppercase tracking-widest">
                                                        Materiais de Apoio para Geração por IA
                                                    </Label>
                                                </div>
                                                <GenerateContentWithRagButton
                                                    moduleId={editingId}
                                                    hasProcessedFiles={hasProcessedFiles}
                                                    onContentGenerated={(newContent, newDescription) => {
                                                        setContent(newContent);
                                                        if (newDescription && !description) setDescription(newDescription);
                                                    }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-400 ml-1">
                                                Envie PDFs ou TXTs. Após processar, clique em <strong>Gerar com Materiais</strong> para criar conteúdo baseado nos seus arquivos.
                                            </p>

                                            <ModuleSourceUploader
                                                moduleId={editingId}
                                                onUploadSuccess={() => setFileRefreshKey((k) => k + 1)}
                                            />

                                            <ModuleSourceFilesList
                                                moduleId={editingId}
                                                refreshKey={fileRefreshKey}
                                                onFilesChange={handleFilesChange}
                                            />
                                        </div>
                                    )}

                                    {!editingId && (
                                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center">
                                            <p className="text-xs text-gray-400">
                                                💡 <strong>Dica:</strong> Salve o módulo primeiro e depois edite-o para adicionar materiais de apoio (PDFs/TXTs) para geração com IA.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 md:p-8 border-t bg-gray-50/50 flex justify-end gap-4 flex-shrink-0">
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-2xl h-14 px-8 font-bold text-gray-500 hover:bg-gray-100 transition-all">Cancelar</Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 rounded-2xl h-14 px-12 font-black text-white shadow-xl shadow-blue-100 transition-all active:scale-95 group">
                                    Gravar Alterações
                                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
