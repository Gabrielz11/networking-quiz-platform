import { Difficulty } from "@prisma/client";

export interface AdaptiveResult {
    nextLevel: Difficulty;
    nextErrors: number;
}

export class QuizService {
    /**
     * Calcula a progressão adaptativa do quiz baseado nas regras do PDR v3.0.
     * - Acerto: Sobe de nível imediatamente (EASY → MEDIUM → HARD).
     * - 1º erro no nível: Mantém o nível atual, incrementa contador.
     * - 2º erro consecutivo no nível: Desce de nível (HARD → MEDIUM → EASY).
     */
    static calculateAdaptiveProgression(
        currentLevel: Difficulty,
        errorsInCurrentLevel: number,
        isCorrect: boolean
    ): AdaptiveResult {
        if (isCorrect) {
            // Regra 1: Acerto — sobe de nível linearmente
            let nextLevel: Difficulty = currentLevel;
            if (currentLevel === Difficulty.EASY) {
                nextLevel = Difficulty.MEDIUM;
            } else if (currentLevel === Difficulty.MEDIUM) {
                nextLevel = Difficulty.HARD;
            }
            return { nextLevel, nextErrors: 0 };
        }

        // Regra 2: Erro
        const currentErrors = errorsInCurrentLevel + 1;

        if (currentErrors >= 2) {
            // Regra 2.2: 2 erros consecutivos — desce de nível
            let nextLevel: Difficulty = currentLevel;
            if (currentLevel === Difficulty.HARD) nextLevel = Difficulty.MEDIUM;
            else if (currentLevel === Difficulty.MEDIUM) nextLevel = Difficulty.EASY;
            return { nextLevel, nextErrors: 0 };
        }

        // Regra 2.1: 1º erro — mantém nível, incrementa contador
        return { nextLevel: currentLevel, nextErrors: currentErrors };
    }
}
