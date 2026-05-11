import { Button } from "@/components/ui/button";

interface QuizEmptyStateProps {
    onBack: () => void;
}

export function QuizEmptyState({ onBack }: QuizEmptyStateProps) {
    return (
        <div className="p-8 text-center">
            Nenhuma questão encontrada para este módulo. Retorne e gere questões com IA.
            <br />
            <Button className="mt-4" onClick={onBack}>Voltar</Button>
        </div>
    );
}
