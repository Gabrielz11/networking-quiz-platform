"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getQuestions, getModules, createQuestion, updateQuestion, deleteQuestion } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function QuestionsManager() {
    const [questions, setQuestions] = useState<any[]>([]);
    const [modules, setModules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [moduleId, setModuleId] = useState("");
    const [prompt, setPrompt] = useState("");
    const [options, setOptions] = useState<string[]>(["", "", "", ""]);
    const [correctIndex, setCorrectIndex] = useState(0);
    const [explanationBase, setExplanationBase] = useState("");

    const fetchData = async () => {
        setLoading(true);
        const [qRes, mRes] = await Promise.all([
            getQuestions(),
            getModules()
        ]);
        setQuestions(qRes);
        setModules(mRes);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreateDialog = () => {
        setEditingId(null);
        setModuleId((modules[0]?.id as string) || "");
        setPrompt("");
        setOptions(["", "", "", ""]);
        setCorrectIndex(0);
        setExplanationBase("");
        setIsDialogOpen(true);
    };

    const openEditDialog = (q: any) => {
        setEditingId(q.id);
        setModuleId(q.moduleId);
        setPrompt(q.prompt);
        setOptions((q.options as string[]) || ["", "", "", ""]);
        setCorrectIndex(typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0);
        setExplanationBase((q.explanationBase as string) || "");
        setIsDialogOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const qData = {
            moduleId,
            prompt,
            options,
            correctOptionIndex: Number(correctIndex),
            explanationBase,
        };

        if (editingId) {
            await updateQuestion(editingId, qData);
        } else {
            await createQuestion(qData);
        }
        setIsDialogOpen(false);
        fetchData();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Excluir esta questão?")) {
            await deleteQuestion(id);
            fetchData();
        }
    };

    const handleOptionChange = (index: number, val: string) => {
        const newOptions = [...options];
        newOptions[index] = val;
        setOptions(newOptions);
    };

    if (loading) return <div>Carregando questões...</div>;

    return (
        <div className="container mx-auto py-8">
            <Link href="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Voltar para Dashboard
            </Link>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Gerenciar Questões</h2>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreateDialog} disabled={modules.length === 0}>Nova Questão</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                        <form onSubmit={handleSave}>
                            <DialogHeader>
                                <DialogTitle>{editingId ? "Editar Questão" : "Criar Questão"}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 my-4">
                                <div className="space-y-2">
                                    <Label>Módulo da Questão</Label>
                                    <select
                                        className="w-full border p-2 rounded"
                                        value={moduleId}
                                        onChange={(e) => setModuleId(e.target.value)}
                                    >
                                        <option value="" disabled>Selecione um módulo</option>
                                        {modules.map(m => (
                                            <option key={m.id as string} value={m.id as string}>{m.title as string}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Enunciado (Pergunta)</Label>
                                    <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Alternativas</Label>
                                    {options.map((opt, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <input
                                                type="radio"
                                                name="correct"
                                                title="Alternativa Correta"
                                                checked={correctIndex === i}
                                                onChange={() => setCorrectIndex(i)}
                                            />
                                            <Input value={opt} onChange={(e) => handleOptionChange(i, e.target.value)} placeholder={`Alternativa ${i + 1}`} required />
                                        </div>
                                    ))}
                                    <p className="text-sm text-gray-500">Selecione o botão de rádio para a alternativa correta.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Estrutura Base (Explicação Pedagógica - Markdown / Texto)</Label>
                                    <Textarea
                                        rows={4}
                                        value={explanationBase}
                                        onChange={(e) => setExplanationBase(e.target.value)}
                                        placeholder="Exponha as razões objetivas para a alternativa correta: Ex. IPv6 possui 128 bits e não 64. A abreviação correta omite zeros à esquerda."
                                        required
                                    />
                                    <p className="text-xs text-gray-500">Isso servirá de base contextual correta que a IA vai utilizar para personalizar o feedback ao aluno caso ele erre a questão.</p>
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

            <div className="space-y-4">
                {questions.map((q) => (
                    <Card key={q.id as string}>
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-2 w-full">
                                    <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded">Módulo: {q.module?.title}</span>
                                    <h3 className="text-lg font-medium">{q.prompt as string}</h3>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        {(q.options as string[])?.map((opt: string, i: number) => (
                                            <div key={i} className={i === q.correctOptionIndex ? "font-bold text-green-600" : ""}>
                                                - {opt}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 min-w-[80px]">
                                    <Button variant="outline" size="sm" onClick={() => openEditDialog(q)}>Editar</Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(q.id as string)}>Excluir</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {questions.length === 0 && <p className="text-gray-500">Nenhuma questão cadastrada. Crie um Módulo primeiro para adicionar questões.</p>}
            </div>
        </div>
    );
}
