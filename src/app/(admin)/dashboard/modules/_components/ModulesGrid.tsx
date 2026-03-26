import { BookOpen } from "lucide-react";
import { ModuleCard } from "./ModuleCard";

interface ModulesGridProps {
    modules: any[];
    loading: boolean;
    onEdit: (mod: any) => void;
    onDelete: (id: string) => void;
}

export function ModulesGrid({
    modules,
    loading,
    onEdit,
    onDelete,
}: ModulesGridProps) {
    return (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                {modules.map((mod, idx) => (
                    <ModuleCard
                        key={mod.id}
                        mod={mod}
                        index={idx}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}
            </div>

            {modules.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-100 animate-in zoom-in-50 duration-500">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <BookOpen className="w-8 h-8 text-gray-200" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-400">Nenhum módulo encontrado</h3>
                    <p className="text-gray-400 mt-1 text-sm">Comece criando um novo conteúdo educacional hoje.</p>
                </div>
            )}
        </>
    );
}
