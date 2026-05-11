import { NextResponse } from 'next/server';
import { ExplainService } from '@/services/explain.service';

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

        // Gera imagem de diagrama via ExplainService (DALL-E)
        const imageUrl = await ExplainService.generateDiagramImage(correct_answer);

        return NextResponse.json({
            explanation: explanationResponse,
            imageUrl: imageUrl
        }, { status: 200 });

    } catch (error: any) {
        console.error("AI Generation Error:", error);

        return NextResponse.json({
            explanation: "Não foi possível gerar a resposta personalizada. Abaixo a explicação base:",
            fallback: true,
        }, { status: 500 });
    }
}
