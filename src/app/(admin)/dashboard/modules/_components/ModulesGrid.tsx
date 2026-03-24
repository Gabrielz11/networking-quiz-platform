import { BookOpen } from "lucide-react";
import { ModuleCard } from "./ModuleCard";

interface ModulesGridProps {
    modules: any[];
    loading: boolean;
    generatingId: string | null;
    onEdit: (mod: any) => void;
    onDelete: (id: string) => void;
    onGenerateQuestions: (mod: any) => void;
    onViewQuestions: (mod: any) => void;
}

export function ModulesGrid({
    modules,
    loading,
    generatingId,
    onEdit,
    onDelete,
    onGenerateQuestions,
    onViewQuestions,
}: ModulesGridProps) {
    return (
        <>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                {modules.map((mod, idx) => (
                    <ModuleCard
                        key={mod.id}
                        mod={mod}
                        index={idx}
                        generatingId={generatingId}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onGenerateQuestions={onGenerateQuestions}
                        onViewQuestions={onViewQuestions}
                    />
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
        </>
    );
}
