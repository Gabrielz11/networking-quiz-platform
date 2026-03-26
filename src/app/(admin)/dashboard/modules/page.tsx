"use client";

import { useEffect, useState } from "react";
import { getModules, createModule, updateModule, deleteModule } from "./actions";
import { ModulesLoadingSpinner } from "./_components/ModulesLoadingSpinner";
import { ModulesPageHeader } from "./_components/ModulesPageHeader";
import { ModulesGrid } from "./_components/ModulesGrid";

export default function ModulesManager() {
    const [modules, setModules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

    if (loading && modules.length === 0) return <ModulesLoadingSpinner />;

    return (
        <div className="container mx-auto py-6 px-6 max-w-7xl">
            <ModulesPageHeader
                isDialogOpen={isDialogOpen}
                setIsDialogOpen={setIsDialogOpen}
                editingId={editingId}
                title={title}
                setTitle={setTitle}
                description={description}
                setDescription={setDescription}
                content={content}
                setContent={setContent}
                imageUrl={imageUrl}
                setImageUrl={setImageUrl}
                isGenerating={isGenerating}
                handleGenerateContent={handleGenerateContent}
                handleSave={handleSave}
                openCreateDialog={openCreateDialog}
            />

            <ModulesGrid
                modules={modules}
                loading={loading}
                onEdit={openEditDialog}
                onDelete={handleDelete}
            />
        </div>
    );
}
