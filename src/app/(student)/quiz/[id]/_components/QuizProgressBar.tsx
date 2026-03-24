import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface QuizProgressBarProps {
    questionsAnswered: number;
    totalQuestions: number;
    currentDifficulty: "easy" | "medium" | "hard";
}

export function QuizProgressBar({ questionsAnswered, totalQuestions, currentDifficulty }: QuizProgressBarProps) {
    const progressPerc = (questionsAnswered / totalQuestions) * 100;

    return (
        <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
                <label className="text-sm rounded text-gray-500 font-medium block">
                    Questão {questionsAnswered + 1} de {totalQuestions}
                </label>
                <Badge variant="outline" className={`
                    ${currentDifficulty === "easy" ? "bg-green-100 text-green-700 border-green-200" : ""}
                    ${currentDifficulty === "medium" ? "bg-yellow-100 text-yellow-700 border-yellow-200" : ""}
                    ${currentDifficulty === "hard" ? "bg-red-100 text-red-700 border-red-200" : ""}
                `}>
                    {currentDifficulty.toUpperCase()}
                </Badge>
            </div>
            <Progress value={progressPerc} className="h-2" />
        </div>
    );
}
