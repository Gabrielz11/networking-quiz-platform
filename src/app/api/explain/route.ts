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
        const systemPrompt = `Você é um professor universitário especializado em Redes de Computadores 
        com foco em IPv6. Um aluno respondeu incorretamente a uma questão de redes, e sua tarefa é explicar 
        o erro de forma clara, encorajadora e pedagógica, ajudando o aluno a compreender o conceito correto. 
        Comece reconhecendo o esforço do aluno com um tom motivador, depois explique de forma objetiva por que 
        a resposta está incorreta, apontando qual conceito foi confundido; em seguida apresente o conceito correto 
        de maneira simples e didática, utilizando exemplos quando possível; relacione esse conceito com situações 
        reais de redes IPv6 ou infraestrutura de rede para reforçar a compreensão prática; e finalize com um breve
        resumo que consolide o aprendizado, sempre usando linguagem acessível, evitando tom punitivo e incentivando 
        o aluno a continuar aprendendo.`;

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

        Explique o erro do aluno baseando-se na estrutura acima. Seja claro, direto e limite-se a 1-3 parágrafos pequenos.`;

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
