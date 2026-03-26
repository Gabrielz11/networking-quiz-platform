import { Button } from "@/components/ui/button";
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
        <div className="flex flex-col gap-4">
            {/* Enunciado */}
            <div className={`
                py-4 px-1 border-b-2 transition-colors duration-300
                ${showingFeedback ? (isCorrect ? "border-green-400" : "border-red-400") : "border-blue-100"}
            `}>
                <div className="flex justify-between items-start gap-3">
                    <h2 className="text-lg font-bold text-slate-800 leading-snug">
                        {currentQuestion.prompt}
                    </h2>
                    {showingFeedback && (
                        <div className={`
                            shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                            ${isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"}
                        `}>
                            {isCorrect ? "✓" : "✗"}
                        </div>
                    )}
                </div>
            </div>

            {/* Opções */}
            <div className="grid gap-2">
                {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    const isCorrectOption = idx === correctIdx;

                    let btnStyle = "border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700";
                    if (isSelected) btnStyle = "border-blue-500 bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-500/20";

                    if (showingFeedback) {
                        if (isCorrectOption) btnStyle = "border-green-500 bg-green-50 text-green-700 font-bold";
                        else if (isSelected) btnStyle = "border-red-500 bg-red-50 text-red-700 font-bold opacity-80";
                        else btnStyle = "border-gray-100 text-slate-400 opacity-40";
                    }

                    return (
                        <button
                            key={idx}
                            disabled={showingFeedback}
                            onClick={() => onSelectOption(idx)}
                            className={`
                                w-full text-left px-4 py-3 rounded-xl border transition-all duration-200
                                text-sm flex items-center justify-between
                                ${btnStyle}
                            `}
                        >
                            <span className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                                    {String.fromCharCode(65 + idx)}
                                </span>
                                {opt}
                            </span>
                            {isSelected && !showingFeedback && (
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Feedback da IA */}
            {showingFeedback && aiFeedback && (
                <div className={`
                    p-4 rounded-xl border animate-in slide-in-from-bottom-2 fade-in duration-500
                    ${isCorrect ? "bg-green-50/70 border-green-200" : "bg-blue-50/70 border-blue-200"}
                `}>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{isCorrect ? "🏅" : "🎓"}</span>
                        <h3 className={`font-bold text-sm ${isCorrect ? "text-green-700" : "text-blue-700"}`}>
                            {isCorrect ? "Excelente!" : "Tutor IA"}
                        </h3>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">
                        {aiFeedback.explanationAi}
                    </p>
                </div>
            )}

            {/* Botão de ação */}
            <div className="flex justify-end pt-2">
                {!showingFeedback ? (
                    <Button
                        disabled={selectedOption === null || fetchingAi}
                        onClick={onAnswer}
                        className="px-8 py-5 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95"
                    >
                        {fetchingAi ? "Analisando..." : "Enviar Resposta"}
                    </Button>
                ) : (
                    <Button
                        onClick={onProceed}
                        className={`
                            px-8 py-5 text-sm font-bold rounded-xl shadow-md transition-all active:scale-95
                            ${isCorrect ? "bg-green-600 hover:bg-green-700" : "bg-slate-800 hover:bg-slate-900 text-white"}
                        `}
                    >
                        {isLastQuestion ? "Finalizar Questionário" : (isCorrect ? "Continuar" : "Próxima Questão")}
                    </Button>
                )}
            </div>
        </div>
    );
}
