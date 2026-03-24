"use client";

import { useEffect, useState } from "react";
import { getModules, createModule, updateModule, deleteModule, getModuleQuestions } from "./actions";
import { ModulesLoadingSpinner } from "./_components/ModulesLoadingSpinner";
import { ModulesPageHeader } from "./_components/ModulesPageHeader";
import { ModulesGrid } from "./_components/ModulesGrid";
import { ViewQuestionsDialog } from "./_components/ViewQuestionsDialog";

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

    if (loading && modules.length === 0) return <ModulesLoadingSpinner />;

    return (
        <div className="container mx-auto py-10 px-6 max-w-7xl">
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
                generatingId={generatingId}
                onEdit={openEditDialog}
                onDelete={handleDelete}
                onGenerateQuestions={handleGenerateQuestions}
                onViewQuestions={handleViewQuestions}
            />

            <ViewQuestionsDialog
                isOpen={isViewQuestionsOpen}
                setIsOpen={setIsViewQuestionsOpen}
                activeModuleTitle={activeModuleTitle}
                viewingQuestions={viewingQuestions}
            />
        </div>
    );
}
