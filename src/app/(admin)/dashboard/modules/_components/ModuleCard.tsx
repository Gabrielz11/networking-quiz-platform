import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
    BookOpen,
    Trash2,
    Edit3,
} from "lucide-react";

interface ModuleCardProps {
    mod: any;
    index: number;
    onEdit: (mod: any) => void;
    onDelete: (id: string) => void;
}

export function ModuleCard({
    mod,
    index,
    onEdit,
    onDelete,
}: ModuleCardProps) {
    return (
        <Card className="group relative border-none bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden outline outline-1 outline-gray-100 hover:outline-blue-200 flex flex-col">
            <CardHeader className="p-5 pb-2">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-blue-50 rounded-xl group-hover:bg-blue-600 transition-colors duration-300">
                        <BookOpen className="w-4 h-4 text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">Módulo {index + 1}</span>
                </div>
                <CardTitle className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight">
                    {mod.title}
                </CardTitle>
            </CardHeader>

            <CardContent className="px-5 py-2 flex-1">
                <p className="text-gray-600 text-sm line-clamp-2">
                    {mod.description || "Sem descrição disponível."}
                </p>
            </CardContent>

            <CardFooter className="p-3 pt-2 flex gap-1 mt-auto border-t border-gray-50">
                <Button variant="ghost" size="sm" onClick={() => onEdit(mod)} className="h-8 rounded-lg hover:bg-gray-100 text-gray-600 font-semibold text-xs gap-1 transition-colors flex-1">
                    <Edit3 className="w-3.5 h-3.5" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(mod.id)} className="h-8 rounded-lg hover:bg-red-50 text-red-500 font-semibold text-xs gap-1 transition-colors flex-1">
                    <Trash2 className="w-3.5 h-3.5" /> Deletar
                </Button>
            </CardFooter>
        </Card>
    );
}
