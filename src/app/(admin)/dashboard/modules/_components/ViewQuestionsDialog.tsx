import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Sparkles,
    BrainCircuit,
    CheckCircle2,
    Info,
    ArrowRight,
} from "lucide-react";

interface ViewQuestionsDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    activeModuleTitle: string;
    viewingQuestions: any[];
}

export function ViewQuestionsDialog({
    isOpen,
    setIsOpen,
    activeModuleTitle,
    viewingQuestions,
}: ViewQuestionsDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-hidden rounded-[2.5rem] p-0 border-none shadow-2xl flex flex-col">
                {/* Header do Modal */}
                <div className="bg-gray-900 p-6 md:p-8 pt-10 text-white relative flex-shrink-0 overflow-hidden">
                    <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                                    <Sparkles className="w-3.5 h-3.5 text-white fill-white" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Simulado Master IA</span>
                            </div>
                            <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight">{activeModuleTitle}</DialogTitle>
                            <DialogDescription className="sr-only">Visualização de questões do módulo {activeModuleTitle}</DialogDescription>
                        </div>
                        <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full w-10 h-10 p-0 transition-all">
                            <Plus className="w-6 h-6 rotate-45" />
                        </Button>
                    </div>
                </div>

                {/* Conteúdo Dinâmico */}
                <div className="flex-1 overflow-y-auto p-10 bg-[#fdfdfd] space-y-12 pb-20 custom-scrollbar">
                    {viewingQuestions.length > 0 ? (
                        viewingQuestions.map((q, idx) => (
                            <div key={q.id} className="animate-in fade-in slide-in-from-bottom-5 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="text-5xl font-black text-gray-100 select-none">
                                            {String(idx + 1).padStart(2, '0')}
                                        </div>
                                        <div className="h-8 w-px bg-gray-100"></div>
                                        <Badge className={`
                                            px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-none
                                            ${q.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-600' : ''}
                                            ${q.difficulty === 'medium' ? 'bg-amber-50 text-amber-600' : ''}
                                            ${q.difficulty === 'hard' ? 'bg-rose-50 text-rose-600' : ''}
                                        `}>
                                            {q.difficulty}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="pl-6 md:pl-10 relative">
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-100 rounded-full hidden md:block"></div>
                                    <h4 className="text-2xl font-bold text-gray-900 mb-10 leading-snug">
                                        {q.prompt}
                                    </h4>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        {q.options.map((opt: string, i: number) => {
                                            const isCorrect = i === q.correctOptionIndex;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`
                                                        group relative p-6 rounded-[1.5rem] transition-all duration-300 flex items-start gap-4 border-2
                                                        ${isCorrect
                                                            ? 'bg-white border-emerald-400 shadow-xl shadow-emerald-100/30'
                                                            : 'bg-white border-gray-50 hover:border-gray-200 shadow-sm'
                                                        }
                                                    `}
                                                >
                                                    {isCorrect && (
                                                        <div className="absolute -top-3 -right-3 bg-emerald-500 text-white rounded-full p-1 shadow-lg ring-4 ring-white">
                                                            <CheckCircle2 className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                    <div className={`
                                                        w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-xs
                                                        ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors'}
                                                    `}>
                                                        {String.fromCharCode(65 + i)}
                                                    </div>
                                                    <p className={`text-base leading-relaxed ${isCorrect ? 'text-gray-900 font-bold' : 'text-gray-600'}`}>
                                                        {opt}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Bloco de Explicação Base */}
                                    <div className="mt-8 bg-blue-50/40 rounded-[2rem] p-7 border border-blue-100/50 group/box transition-all hover:bg-blue-50">
                                        <div className="flex items-start gap-5">
                                            <div className="bg-white p-3 rounded-2xl shadow-sm ring-1 ring-blue-100/50 group-hover/box:scale-110 transition-transform duration-300">
                                                <Info className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-black uppercase text-blue-700 tracking-[0.2em]">Base de Explicação IA</span>
                                                    <ArrowRight className="w-3 h-3 text-blue-300" />
                                                </div>
                                                <p className="text-sm text-blue-900/80 leading-relaxed font-medium italic">
                                                    "{q.explanation_text}"
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                            <div className="p-4 bg-gray-50 rounded-3xl">
                                <BrainCircuit className="w-12 h-12 text-gray-200" />
                            </div>
                            <p className="text-gray-400 font-bold max-w-xs">Aguarde a IA processar as questões para este módulo.</p>
                        </div>
                    )}
                </div>

                {/* Botão flutuante no final para fechar */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full flex justify-center px-6">
                    <Button
                        onClick={() => setIsOpen(false)}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-16 h-16 font-black shadow-[0_20px_50px_rgba(37,99,235,0.3)] transition-all active:scale-95 group border-4 border-white"
                    >
                        <Plus className="w-5 h-5 mr-3 rotate-45" />
                        FECHAR REVISÃO
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
