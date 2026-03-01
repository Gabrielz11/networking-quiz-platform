"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ModulesManager() {
    const [modules, setModules] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);

    // Create / Edit State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [content, setContent] = useState("");

    const fetchModules = async () => {
        setLoading(true);
        const { data } = await supabase.from("modules").select("*").order("created_at", { ascending: false });
        if (data) setModules(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchModules();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openEditDialog = (mod: Record<string, unknown>) => {
        setEditingId(mod.id as string);
        setTitle(mod.title as string);
        setDescription(mod.description as string);
        setContent(mod.content as string);
        setIsDialogOpen(true);
    };

    const openCreateDialog = () => {
        setEditingId(null);
        setTitle("");
        setDescription("");
        setContent("");
        setIsDialogOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            await supabase.from("modules").update({ title, description, content }).eq("id", editingId);
        } else {
            await supabase.from("modules").insert([{ title, description, content }]);
        }
        setIsDialogOpen(false);
        fetchModules();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir?")) {
            await supabase.from("modules").delete().eq("id", id);
            fetchModules();
        }
    };

    if (loading) return <div>Carregando módulos...</div>;

    return (
        <div className="container mx-auto py-8">
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
                                    <Label>Descrição Curta</Label>
                                    <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Conteúdo (Markdown)</Label>
                                    <Textarea
                                        rows={8}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="# Titulo\nConteudo em markdown..."
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
                    <Card key={mod.id as string}>
                        <CardHeader>
                            <CardTitle>{mod.title as string}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-500 mb-2 truncate">{mod.description as string}</p>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(mod)}>Editar</Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(mod.id as string)}>Excluir</Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
            {modules.length === 0 && <p>Nenhum módulo cadastrado.</p>}
        </div>
    );
}
