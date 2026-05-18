import { NextResponse } from "next/server";
import { ExplainService } from "@/services/explain.service";
import { Logger } from "@/lib/logger";

const logger = new Logger("ExplainRoute");

export async function POST(req: Request) {
    try {
        const { prompt, base_explanation, student_answer, correct_answer } = await req.json();

        // Gera explicação pedagógica via ExplainService (Gemini + fallback Groq)
        const explanationResponse = await ExplainService.generateExplanation(
            prompt,
            base_explanation,
            student_answer,
            correct_answer
        );

        return NextResponse.json({
            explanation: explanationResponse
        }, { status: 200 });

    } catch (error: any) {
        logger.error("POST", "Falha na geração da explicação personalizada", {
            message: error.message || error
        });

        return NextResponse.json({
            explanation: "Não foi possível gerar a resposta personalizada. Abaixo a explicação base:",
            fallback: true,
        }, { status: 500 });
    }
}
