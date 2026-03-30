"use client";

import { useEffect, useState } from "react";
import { getModules, createModule, updateModule, deleteModule } from "./actions";
import { ModulesLoadingSpinner } from "./_components/ModulesLoadingSpinner";
import { ModulesPageHeader } from "./_components/ModulesPageHeader";
import { ModulesGrid } from "./_components/ModulesGrid";
import { toast } from "sonner";

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

    const handleDelete = (id: string) => {
        toast("Deseja mesmo excluir?", {
            description: "Esta ação apagará permanentemente o módulo.",
            action: {
                label: "Excluir",
                onClick: async () => {
                    setLoading(true);
                    try {
                        await deleteModule(id);
                        toast.success("Módulo removido com sucesso!");
                        fetchModules();
                    } catch (error) {
                        toast.error("Erro ao remover o módulo.");
                    } finally {
                        setLoading(false);
                    }
                }
            },
            actionButtonStyle: {
                backgroundColor: '#dc2626',
                color: 'white'
            },
            cancel: {
                label: "Cancelar",
                onClick: () => toast.dismiss()
            }
        });
    };

    const handleGenerateContent = async () => {
        if (!title) return toast.warning("Por favor, defina um título primeiro.");
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
            toast.error("Erro ao gerar conteúdo: " + error.message);
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
