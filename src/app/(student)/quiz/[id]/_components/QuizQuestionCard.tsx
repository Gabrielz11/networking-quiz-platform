import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Question } from "./_types";

interface AiFeedback {
    explanationAi: string | null;
    correctIndex: number | null;
}

interface QuizQuestionCardProps {
    currentQuestion: Question;
    selectedOption: number | null;
    showingFeedback: boolean;
    fetchingAi: boolean;
    aiFeedback: AiFeedback | null;
    onSelectOption: (idx: number) => void;
    onAnswer: () => void;
    onProceed: () => void;
    correctOptionIndexFromServer?: number;
    isLastQuestion?: boolean;
}

export function QuizQuestionCard({
    currentQuestion,
    selectedOption,
    showingFeedback,
    fetchingAi,
    aiFeedback,
    onSelectOption,
    onAnswer,
    onProceed,
    correctOptionIndexFromServer,
    isLastQuestion,
}: QuizQuestionCardProps) {
    const correctIdx = correctOptionIndexFromServer ?? (currentQuestion as any).correctOptionIndex;
    const isCorrect = showingFeedback && selectedOption === correctIdx;

    return (
        <Card className={`
            shadow-2xl transition-all duration-500 border-none overflow-hidden
            ${showingFeedback ? (isCorrect ? "ring-4 ring-green-500/50" : "ring-4 ring-red-500/50") : "ring-1 ring-slate-200"}
        `}>
            <CardHeader className={`
                transition-colors duration-500
                ${showingFeedback ? (isCorrect ? "bg-green-50" : "bg-red-50") : "bg-slate-50"}
                border-b border-slate-100 p-8
            `}>
                <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-xl md:text-2xl font-bold text-slate-800 leading-snug">
                        {currentQuestion.prompt}
                    </CardTitle>
                    {showingFeedback && (
                        <div className={`
                            shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl
                            ${isCorrect ? "bg-green-500 text-white animate-bounce" : "bg-red-500 text-white animate-shake"}
                        `}>
                            {isCorrect ? "✓" : "✗"}
                        </div>
                    )}
                </div>
            </CardHeader>
            
            <CardContent className="p-8">
                <div className="grid gap-4">
                    {currentQuestion.options.map((opt, idx) => {
                        const isSelected = selectedOption === idx;
                        const isCorrectOption = idx === correctIdx;
                        
                        let btnStyle = "border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 text-slate-700";
                        if (isSelected) btnStyle = "border-blue-500 bg-blue-50 text-blue-700 font-semibold ring-2 ring-blue-500/20";
                        
                        if (showingFeedback) {
                            if (isCorrectOption) btnStyle = "border-green-600 bg-green-50 text-green-700 font-bold ring-2 ring-green-500/20";
                            else if (isSelected) btnStyle = "border-red-600 bg-red-50 text-red-700 font-bold opacity-90";
                            else btnStyle = "border-slate-200 text-slate-400 grayscale opacity-50";
                        }

                        return (
                            <button
                                key={idx}
                                disabled={showingFeedback}
                                onClick={() => onSelectOption(idx)}
                                className={`
                                    w-full text-left p-5 rounded-2xl border-2 transition-all duration-200
                                    text-base md:text-lg flex items-center justify-between group
                                    ${btnStyle}
                                `}
                            >
                                <span className="pr-4">{opt}</span>
                                {isSelected && !showingFeedback && (
                                    <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {showingFeedback && aiFeedback && (
                    <div className={`
                        mt-10 p-8 rounded-3xl border-2 animate-in slide-in-from-bottom-4 fade-in duration-700
                        ${isCorrect ? "bg-green-50/50 border-green-100" : "bg-blue-50/50 border-blue-100 shadow-inner"}
                    `}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`
                                w-10 h-10 rounded-xl flex items-center justify-center text-xl
                                ${isCorrect ? "bg-green-500/20 text-green-600" : "bg-blue-500/20 text-blue-600"}
                            `}>
                                {isCorrect ? "🏅" : "🎓"}
                            </div>
                            <h3 className={`font-black text-lg ${isCorrect ? "text-green-800" : "text-blue-800"}`}>
                                {isCorrect ? "EXCELENTE!" : "TUTOR IA PEDAGÓGICO"}
                            </h3>
                        </div>
                        <p className="text-slate-700 leading-relaxed text-lg italic bg-white/40 p-4 rounded-2xl border border-white/60">
                            {aiFeedback.explanationAi}
                        </p>
                    </div>
                )}
            </CardContent>

            <CardFooter className="bg-slate-50/50 border-t border-slate-100 p-8 flex justify-center sm:justify-end">
                {!showingFeedback ? (
                    <Button
                        size="lg"
                        disabled={selectedOption === null || fetchingAi}
                        onClick={onAnswer}
                        className="w-full sm:w-auto px-12 py-8 text-xl font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                    >
                        {fetchingAi ? "Analisando..." : "ENVIAR RESPOSTA"}
                    </Button>
                ) : (
                    <Button
                        size="lg"
                        onClick={onProceed}
                        className={`
                            w-full sm:w-auto px-12 py-8 text-xl font-black rounded-2xl shadow-xl transition-all active:scale-95
                            ${isCorrect ? "bg-green-600 hover:bg-green-700 shadow-green-500/20" : "bg-slate-800 hover:bg-slate-900 shadow-slate-500/20 text-white"}
                        `}
                    >
                        {isLastQuestion ? "FINALIZAR QUESTIONÁRIO" : (isCorrect ? "CONTINUAR" : "PRÓXIMA QUESTÃO")}
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
