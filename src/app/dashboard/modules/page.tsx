"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getModules, createModule, updateModule, deleteModule, getModuleQuestions } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
    const [content, setContent] = useState("");

    const fetchModules = async () => {
        setLoading(true);
        const data = await getModules();
        setModules(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchModules();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openEditDialog = (mod: any) => {
        setEditingId(mod.id);
        setTitle(mod.title);
        setContent(mod.content);
        setIsDialogOpen(true);
    };

    const openCreateDialog = () => {
        setEditingId(null);
        setTitle("");
        setContent("");
        setIsDialogOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            await updateModule(editingId, { title, content });
        } else {
            await createModule({ title, content });
        }
        setIsDialogOpen(false);
        fetchModules();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir?")) {
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
            alert(`Sucesso! ${data.count} questões geradas.`);
        } catch (error: any) {
            console.error(error);
            alert("Erro: " + error.message);
        } finally {
            setGeneratingId(null);
        }
    };

    const handleViewQuestions = async (mod: any) => {
        setLoading(true);
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
            setActiveModuleTitle(mod.title);
            setIsViewQuestionsOpen(true);
        }
        setLoading(false);
    };

    if (loading) return <div className="p-8 text-center">Carregando módulos...</div>;

    return (
        <div className="container mx-auto py-8 px-4">
            <Link href="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Voltar para Dashboard
            </Link>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Gerenciar Módulos</h2>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreateDialog}>Novo Módulo</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
                        <form onSubmit={handleSave}>
                            <DialogHeader>
                                <DialogTitle>{editingId ? "Editar Módulo" : "Criar Módulo"}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 my-4">
                                <div className="space-y-2">
                                    <Label>Título</Label>
                                    <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Conteúdo (Markdown)</Label>
                                    <Textarea
                                        rows={12}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="# Titulo\nConteudo em markdown..."
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit">Salvar</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modules.map((mod) => (
                    <Card key={mod.id}>
                        <CardHeader>
                            <CardTitle>{mod.title}</CardTitle>
                        </CardHeader>
                        <CardFooter className="flex flex-col gap-2 border-t pt-4">
                            <div className="flex w-full justify-between items-center bg-blue-50/50 p-2 rounded-md">
                                <span className="text-xs text-blue-600 font-medium">Tutor IA</span>
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={() => handleGenerateQuestions(mod)}
                                    disabled={generatingId === mod.id}
                                    className="bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    {generatingId === mod.id ? "Gerando..." : "Gerar (IA)"}
                                </Button>
                            </div>
                            <div className="flex flex-wrap justify-between w-full pt-2 gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleViewQuestions(mod)}>
                                    Ver Questões
                                </Button>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(mod)}>Editar</Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(mod.id)}>Excluir</Button>
                                </div>
                            </div>
                        </CardFooter>
                    </Card>
                ))}
            </div>
            {modules.length === 0 && <p className="text-gray-500">Nenhum módulo cadastrado ainda.</p>}

            {/* Modal para Visualizar Questões */}
            <Dialog open={isViewQuestionsOpen} onOpenChange={setIsViewQuestionsOpen}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Questões: {activeModuleTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 mt-4">
                        {viewingQuestions.length > 0 ? (
                            viewingQuestions.map((q, idx) => (
                                <div key={q.id} className="border p-4 rounded-lg bg-gray-50">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-lg">Q{idx + 1}</span>
                                        <span className={`text-xs px-2 py-1 rounded font-semibold uppercase ${
                                            q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                            q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {q.difficulty}
                                        </span>
                                    </div>
                                    <p className="mb-4 font-medium">{q.prompt}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                                        {q.options.map((opt: string, i: number) => (
                                            <div key={i} className={`p-2 text-sm rounded border ${i === q.correctOptionIndex ? 'bg-green-50 border-green-200 font-bold text-green-700' : 'bg-white'}`}>
                                                {i + 1}. {opt}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-xs text-gray-500 bg-white p-2 rounded border italic">
                                        <span className="font-semibold block mb-1 font-sans">Base IA:</span>
                                        {q.explanation_text}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center py-8 text-gray-500">Nenhuma questão encontrada.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
