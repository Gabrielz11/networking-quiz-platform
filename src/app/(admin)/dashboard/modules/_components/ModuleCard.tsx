import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
    BookOpen,
    Trash2,
    Edit3,
    Eye,
    BrainCircuit,
} from "lucide-react";

interface ModuleCardProps {
    mod: any;
    index: number;
    generatingId: string | null;
    onEdit: (mod: any) => void;
    onDelete: (id: string) => void;
    onGenerateQuestions: (mod: any) => void;
    onViewQuestions: (mod: any) => void;
}

export function ModuleCard({
    mod,
    index,
    generatingId,
    onEdit,
    onDelete,
    onGenerateQuestions,
    onViewQuestions,
}: ModuleCardProps) {
    return (
        <Card className="group relative border-none bg-white rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden outline outline-1 outline-gray-100 hover:outline-blue-200 flex flex-col">
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <BrainCircuit className="w-10 h-10 text-blue-500/10" />
            </div>
            <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-600 transition-colors duration-500">
                        <BookOpen className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">Módulo {index + 1}</span>
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
                        onClick={() => onGenerateQuestions(mod)}
                        disabled={generatingId === mod.id}
                        className="h-8 rounded-lg border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold text-[10px] uppercase transition-all"
                    >
                        {generatingId === mod.id ? "Gerando..." : "Gerar Simulado"}
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-1 p-2">
                    <Button variant="ghost" size="sm" onClick={() => onViewQuestions(mod)} className="h-10 rounded-xl hover:bg-blue-50 text-blue-600 font-bold text-xs gap-1.5 transition-colors">
                        <Eye className="w-4 h-4" /> Ver Questões
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(mod)} className="h-10 rounded-xl hover:bg-gray-100 text-gray-600 font-bold text-xs gap-1.5 transition-colors">
                        <Edit3 className="w-4 h-4" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(mod.id)} className="h-10 rounded-xl hover:bg-red-50 text-red-500 font-bold text-xs gap-1.5 transition-colors">
                        <Trash2 className="w-4 h-4" /> Deletar
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
