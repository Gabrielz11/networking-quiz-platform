import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Inicializa a IA do Google (Gemini 3 Flash in fast mode)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// Mantém a inicialização OpenAI para continuar utilizando o DALL-E se ele ainda estiver mapeado
const openai = new OpenAI({
    apiKey: (process.env.OPENAI_API_KEY || '').trim(),
});

export async function POST(req: Request) {
    try {
        const { prompt, base_explanation, student_answer, correct_answer } = await req.json();

        // System Instruction enviada diretamente ao Gemini configurado
        const systemPrompt = `Você é um professor de Redes de Computadores especializado em IPv6. 
Um aluno respondeu incorretamente a uma questão. 
Sua tarefa é explicar o porquê do erro de forma encorajadora e pedagógica, utilizando a estrutura base fornecida.`;

        // --- CÓDIGO COM GOOGLE GEMINI ---
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash", // Utilizando a versão estável e gratuita
            systemInstruction: systemPrompt,
            generationConfig: {
                temperature: 0.7,
            }
        });

        const promptText = `Questão: ${prompt}
Resposta correta: ${correct_answer}
Resposta do aluno: ${student_answer}

[ESTRUTURA BASE PARA A EXPLICAÇÃO - USE ISTO COMO GUIA]
${base_explanation}

Explique o erro do aluno baseando-se na estrutura acima. Seja claro, direto e limite-se a 3-4 parágrafos pequenos.`;

        const result = await model.generateContent(promptText);
        const explanationResponse = result.response.text() || "Não foi possível gerar a explicação.";

        // --- GERAÇÃO DE IMAGEM DA RESPOSTA CORRETA ---
        let imageUrl = null;
        try {
            if (!process.env.OPENAI_API_KEY) {
                console.warn("OpenAI API Key not found. Skipping image generation.");
            } else {
                const imagePrompt = `
                                    Educational computer networking diagram explaining the concept: ${correct_answer}.

                                    Requirements:
                                    - clear technical diagram
                                    - show network devices and connections
                                    - labels for protocols (IPv6, TCP if relevant)
                                    - flat design style
                                    - minimal icons
                                    - white background
                                    - readable labels
                                    - educational style used in textbooks
                                    - simple topology diagram
                                    `;
                const imageResponse = await openai.images.generate({
                    model: "dall-e-3",
                    prompt: imagePrompt,
                    n: 1,
                    size: "1024x1024",
                    quality: "standard",
                });
                imageUrl = imageResponse.data?.[0]?.url || null;
            }
        } catch (imageError: any) {
            console.error("DALL-E Image Generation error (Non-critical):", imageError.message || imageError);
            if (imageError.status === 401) {
                console.warn("TIP: Please verify your OPENAI_API_KEY in .env.local. It seems invalid or expired (401).");
            }
        }
        // ---------------------------------------------

        return NextResponse.json({
            explanation: explanationResponse,
            imageUrl: imageUrl
        }, { status: 200 });

    } catch (error: any) {
        console.error("AI Generation Error:", error);

        // Edge Case: IA falhar -> mostrar estrutura base pura
        return NextResponse.json({
            explanation: "Não foi possível gerar a resposta personalizada. Abaixo a explicação base:",
            fallback: true,
            error: error.message
        }, { status: 500 });
    }
}
