"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getModules, createModule, updateModule, deleteModule, getModuleQuestions } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
    CheckCircle2, 
    ChevronLeft, 
    Plus, 
    Sparkles, 
    BookOpen, 
    Trash2, 
    Edit3, 
    Eye, 
    BrainCircuit,
    Info,
    ArrowRight
} from "lucide-react";

export default function ModulesManager() {
    const [modules, setModules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    // View Questions State
    const [viewingQuestions, setViewingQuestions] = useState<any[]>([]);
    const [isViewQuestionsOpen, setIsViewQuestionsOpen] = useState(false);
    const [activeModuleTitle, setActiveModuleTitle] = useState("");

    // Create / Edit State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [content, setContent] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchModules = async () => {
        setLoading(true);
        try {
            const data = await getModules();
            setModules(data || []);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchModules();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openEditDialog = (mod: any) => {
        setEditingId(mod.id);
        setTitle(mod.title);
        setDescription(mod.description || "");
        setContent(mod.content);
        setImageUrl(mod.imageUrl || "");
        setIsDialogOpen(true);
    };

    const openCreateDialog = () => {
        setEditingId(null);
        setTitle("");
        setDescription("");
        setContent("");
        setImageUrl("");
        setIsDialogOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        if (editingId) {
            await updateModule(editingId, { title, description, content, imageUrl });
        } else {
            await createModule({ title, description, content, imageUrl });
        }
        setIsDialogOpen(false);
        fetchModules();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este módulo e todas as suas questões?")) {
            setLoading(true);
            await deleteModule(id);
            fetchModules();
        }
    };

    const handleGenerateQuestions = async (mod: any) => {
        if (!confirm(`Deseja recriar as questões deste módulo ("${mod.title}") via IA? Isso apagará as atuais.`)) return;
        
        setGeneratingId(mod.id);
        try {
            const res = await fetch("/api/generate-questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    moduleId: mod.id, 
                    title: mod.title, 
                    content: mod.content 
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro desconhecido");
            alert(`Sucesso! ${data.count} questões geradas pela IA.`);
        } catch (error: any) {
            console.error(error);
            alert("Erro: " + error.message);
        } finally {
            setGeneratingId(null);
        }
    };

    const handleGenerateContent = async () => {
        if (!title) return alert("Por favor, defina um título primeiro.");
        setIsGenerating(true);
        try {
            const res = await fetch("/api/generate-content", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description }),
            });
            const data = await res.json();
            if (res.ok) {
                setContent(data.content);
                if (!description && data.description) setDescription(data.description);
                if (data.imageUrl) setImageUrl(data.imageUrl);
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            alert("Erro ao gerar conteúdo: " + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleViewQuestions = async (mod: any) => {
        setIsViewQuestionsOpen(true); // Abrir logo para dar feedback de loading
        setViewingQuestions([]); 
        setActiveModuleTitle(mod.title);
        
        const data = await getModuleQuestions(mod.id);
        if (data) {
            setViewingQuestions(data.map(q => {
                let diff = "easy";
                let text = q.explanationBase;
                try {
                    const parsed = JSON.parse(q.explanationBase as string);
                    diff = parsed.difficulty || "easy";
                    text = parsed.text || q.explanationBase;
                } catch (e) { /* ignore */ }
                return { ...q, difficulty: diff, explanation_text: text };
            }));
        }
    };

    if (loading && modules.length === 0) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
            </div>
            <p className="text-gray-500 font-medium animate-pulse">Sincronizando Módulos...</p>
        </div>
    );

    return (
        <div className="container mx-auto py-10 px-6 max-w-7xl">
            {/* Header com breadcrumb sutil */}
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
                                        <div className="space-y-3">
                                            <Label className="text-gray-900 font-black text-xs uppercase tracking-widest ml-1">Resumo Curto (Descrição)</Label>
                                            <Input 
                                                value={description} 
                                                onChange={(e) => setDescription(e.target.value)} 
                                                placeholder="Descreve brevemente o objetivo do módulo..."
                                                className="h-14 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:ring-blue-500 transition-all border-2"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-gray-900 font-black text-xs uppercase tracking-widest ml-1">URL da Imagem Ilustrativa</Label>
                                            <Input 
                                                value={imageUrl} 
                                                onChange={(e) => setImageUrl(e.target.value)} 
                                                placeholder="https://images.unsplash.com/..."
                                                className="h-14 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:ring-blue-500 transition-all border-2"
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center ml-1">
                                                <Label className="text-gray-900 font-black text-xs uppercase tracking-widest">Material de Estudo</Label>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={handleGenerateContent}
                                                        disabled={isGenerating || !title}
                                                        className="bg-purple-100 text-purple-700 border-none font-bold hover:bg-purple-200 h-9 px-4 flex gap-2 active:scale-95 transition-all shadow-sm"
                                                    >
                                                        <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                                                        {isGenerating ? "Gerando..." : "Assistente IA"}
                                                    </Button>
                                                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-black h-9 px-4 uppercase text-[10px]">Texto Livre</Badge>
                                                </div>
                                            </div>
                                            <div className="relative group">
                                                <Textarea
                                                    rows={15}
                                                    value={content}
                                                    onChange={(e) => setContent(e.target.value)}
                                                    placeholder="Descreva o conteúdo técnico ou use o Assistente IA para gerar uma estrutura profissional automaticamente..."
                                                    required
                                                    className="rounded-3xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:ring-blue-600 resize-none font-sans text-lg p-8 leading-relaxed min-h-[450px] shadow-inner transition-all"
                                                />
                                                {!content && !isGenerating && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none">
                                                        <BookOpen className="w-16 h-16 mb-4 text-gray-400" />
                                                        <span className="text-sm font-bold text-gray-400">Título + Assistente IA = Módulo Completo</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
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

            {/* Grid de Módulos */}
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                {modules.map((mod, idx) => (
                    <Card key={mod.id} className="group relative border-none bg-white rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden outline outline-1 outline-gray-100 hover:outline-blue-200 flex flex-col">
                        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <BrainCircuit className="w-10 h-10 text-blue-500/10" />
                        </div>
                        <CardHeader className="p-8 pb-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-600 transition-colors duration-500">
                                    <BookOpen className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                                </div>
                                <span className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">Módulo {idx + 1}</span>
                            </div>
                            <CardTitle className="text-2xl font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                                {mod.title}
                            </CardTitle>
                        </CardHeader>
                        
                        <CardContent className="px-8 flex-1">
                            <p className="text-gray-800 font-medium text-sm mb-3">
                                {mod.description || "Sem descrição disponível."}
                            </p>
                            <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">
                                {mod.content.substring(0, 100).replace(/[#*`]/g, "") + "..."}
                            </p>
                        </CardContent>

                        <CardFooter className="p-2 pt-4 bg-gray-50/50 flex flex-col gap-2 mt-auto">
                            {/* Dashboard IA inside card */}
                            <div className="m-2 p-3 bg-white rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                    <span className="text-[10px] font-black uppercase text-gray-500">Status IA</span>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleGenerateQuestions(mod)}
                                    disabled={generatingId === mod.id}
                                    className="h-8 rounded-lg border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold text-[10px] uppercase transition-all"
                                >
                                    {generatingId === mod.id ? "Gerando..." : "Gerar Simulado"}
                                </Button>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-1 p-2">
                                <Button variant="ghost" size="sm" onClick={() => handleViewQuestions(mod)} className="h-10 rounded-xl hover:bg-blue-50 text-blue-600 font-bold text-xs gap-1.5 transition-colors">
                                    <Eye className="w-4 h-4" /> Ver
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(mod)} className="h-10 rounded-xl hover:bg-gray-100 text-gray-600 font-bold text-xs gap-1.5 transition-colors">
                                    <Edit3 className="w-4 h-4" /> Editar
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(mod.id)} className="h-10 rounded-xl hover:bg-red-50 text-red-500 font-bold text-xs gap-1.5 transition-colors">
                                    <Trash2 className="w-4 h-4" /> Sair
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {modules.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 animate-in zoom-in-50 duration-500">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                        <BookOpen className="w-10 h-10 text-gray-200" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-400">Nenhum módulo encontrado</h3>
                    <p className="text-gray-400 mt-2">Comece criando um novo conteúdo educacional hoje.</p>
                </div>
            )}

            {/* MODAL DE VISUALIZAÇÃO - AESTHETIC REVOLUTION */}
            <Dialog open={isViewQuestionsOpen} onOpenChange={setIsViewQuestionsOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-hidden rounded-[2.5rem] p-0 border-none shadow-2xl flex flex-col">
                    {/* Header do Modal */}
                    <div className="bg-gray-900 p-6 md:p-8 pt-10 text-white relative flex-shrink-0 overflow-hidden">
                        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                                        <Sparkles className="w-3.5 h-3.5 text-white fill-white" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Simulado Master IA</span>
                                </div>
                                <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight">{activeModuleTitle}</DialogTitle>
                                <DialogDescription className="sr-only">Visualização de questões do módulo {activeModuleTitle}</DialogDescription>
                            </div>
                            <Button variant="ghost" onClick={() => setIsViewQuestionsOpen(false)} className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full w-10 h-10 p-0 transition-all">
                                <Plus className="w-6 h-6 rotate-45" />
                            </Button>
                        </div>
                    </div>

                    {/* Conteúdo Dinâmico */}
                    <div className="flex-1 overflow-y-auto p-10 bg-[#fdfdfd] space-y-12 pb-20 custom-scrollbar">
                        {viewingQuestions.length > 0 ? (
                            viewingQuestions.map((q, idx) => (
                                <div key={q.id} className="animate-in fade-in slide-in-from-bottom-5 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="text-5xl font-black text-gray-100 select-none">
                                                {String(idx + 1).padStart(2, '0')}
                                            </div>
                                            <div className="h-8 w-px bg-gray-100"></div>
                                            <Badge className={`
                                                px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-none
                                                ${q.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-600' : ''}
                                                ${q.difficulty === 'medium' ? 'bg-amber-50 text-amber-600' : ''}
                                                ${q.difficulty === 'hard' ? 'bg-rose-50 text-rose-600' : ''}
                                            `}>
                                                {q.difficulty}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="pl-6 md:pl-10 relative">
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-100 rounded-full hidden md:block"></div>
                                        <h4 className="text-2xl font-bold text-gray-900 mb-10 leading-snug">
                                            {q.prompt}
                                        </h4>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            {q.options.map((opt: string, i: number) => {
                                                const isCorrect = i === q.correctOptionIndex;
                                                return (
                                                    <div 
                                                        key={i} 
                                                        className={`
                                                            group relative p-6 rounded-[1.5rem] transition-all duration-300 flex items-start gap-4 border-2
                                                            ${isCorrect 
                                                                ? 'bg-white border-emerald-400 shadow-xl shadow-emerald-100/30' 
                                                                : 'bg-white border-gray-50 hover:border-gray-200 shadow-sm'
                                                            }
                                                        `}
                                                    >
                                                        {isCorrect && (
                                                            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white rounded-full p-1 shadow-lg ring-4 ring-white">
                                                                <CheckCircle2 className="w-5 h-5" />
                                                            </div>
                                                        )}
                                                        <div className={`
                                                            w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-xs
                                                            ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors'}
                                                        `}>
                                                            {String.fromCharCode(65 + i)}
                                                        </div>
                                                        <p className={`text-base leading-relaxed ${isCorrect ? 'text-gray-900 font-bold' : 'text-gray-600'}`}>
                                                            {opt}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Bloco de Explicação Base */}
                                        <div className="mt-8 bg-blue-50/40 rounded-[2rem] p-7 border border-blue-100/50 group/box transition-all hover:bg-blue-50">
                                            <div className="flex items-start gap-5">
                                                <div className="bg-white p-3 rounded-2xl shadow-sm ring-1 ring-blue-100/50 group-hover/box:scale-110 transition-transform duration-300">
                                                    <Info className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-black uppercase text-blue-700 tracking-[0.2em]">Base de Explicação IA</span>
                                                        <ArrowRight className="w-3 h-3 text-blue-300" />
                                                    </div>
                                                    <p className="text-sm text-blue-900/80 leading-relaxed font-medium italic">
                                                        "{q.explanation_text}"
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                                <div className="p-4 bg-gray-50 rounded-3xl">
                                    <BrainCircuit className="w-12 h-12 text-gray-200" />
                                </div>
                                <p className="text-gray-400 font-bold max-w-xs">Aguarde a IA processar as questões para este módulo.</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Botão flutuante no final para fechar */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full flex justify-center px-6">
                        <Button 
                            onClick={() => setIsViewQuestionsOpen(false)} 
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-16 h-16 font-black shadow-[0_20px_50px_rgba(37,99,235,0.3)] transition-all active:scale-95 group border-4 border-white"
                        >
                            <Plus className="w-5 h-5 mr-3 rotate-45" />
                            FECHAR REVISÃO
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
