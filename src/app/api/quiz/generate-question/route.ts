import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const sessionReq = await auth();
        if (!sessionReq?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
        }

        const { sessionId } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: "Parâmetro sessionId é obrigatório." }, { status: 400 });
        }

        // Fetch session with questions to check if we need to generate one
        const session = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            include: {
                module: true,
                questions: true
            }
        });

        if (!session) {
            return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
        }

        if (session.userId !== sessionReq.user.id) {
            return NextResponse.json({ error: "Acesso negado à sessão." }, { status: 403 });
        }

        if (session.status === "COMPLETED") {
            return NextResponse.json({ error: "O quiz já foi finalizado." }, { status: 400 });
        }

        // Check if there is already a question awaiting answer for current index
        const pendingQuestions = session.questions.filter(q => q.studentAnswer === null);
        if (pendingQuestions.length > 0) {
            const existingQuestion = pendingQuestions[pendingQuestions.length - 1];
            // Omit sensitive data like correct option before sending to frontend
            const { correctOptionIndex, explanation, ...safeQuestion } = existingQuestion;
            return NextResponse.json({ success: true, question: safeQuestion });
        }

        const moduleId = session.moduleId;
        const difficulty = session.currentLevel;
        const moduleContent = session.module.content;

        const previousPrompts = session.questions.map(q => q.prompt).join("\n- ");
        const previousRules = previousPrompts.length > 0 
            ? `Você DEVE evitar repetições. As seguintes questões já foram feitas NESTA SESSÃO e não devem ser repetidas nem abordadas de forma similar:\n- ${previousPrompts}\n`
            : "";

        const systemPrompt = `Você é um Tutor Acadêmico de Elite em Redes de Computadores especialista em IPv6.
Sua missão é gerar EXATAMENTE UMA questão de múltipla escolha baseada EXCLUSIVAMENTE no conteúdo fornecido abaixo.

O nível de dificuldade alvo para esta questão é: ${difficulty}.
- EASY: Conceitos básicos, definições diretas e fatos explícitos.
- MEDIUM: Análise técnica, relação entre conceitos ou processos descritos.
- HARD: Cenários complexos, exceções técnicas ou detalhes profundos que exigem alta dedução baseada no texto.

MISSÃO PEDAGÓGICA (CAMPO 'explanation'):
1. A 'explanation' deve ser um ensinamento curto mas denso (2 a 4 frases).
2. Não use frases genéricas como "Resposta correta" ou "Bom trabalho".
3. FOQUE no PORQUÊ técnico do fato, reforçando o conceito para que o aluno aprenda mesmo que tenha errado.
4. Use uma linguagem acadêmica, profissional e clara.

${previousRules}

Retorne EXATAMENTE UM JSON com a seguinte estrutura:
{
  "prompt": "Enunciado da questão técnico e claro",
  "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
  "correct_option_index": 0,
  "explanation": "Texto do Tutor IA ensinando o conceito técnico relacionado à questão."
}`;

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.8,
            }
        });

        const promptText = `${systemPrompt}\n\nConteúdo Módulo:\n${moduleContent}`;

        let rawContent = "";
        try {
            const result = await model.generateContent(promptText);
            rawContent = result.response.text();
        } catch (genError: any) {
            console.warn("Gemini API failed, falling back to Groq Llama 3.3:", genError.message);
            const groqKey = process.env.GROQ_API_KEY;
            
            if (!groqKey) {
                throw genError;
            }

            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${groqKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "Você é um assistente que responde APENAS e EXCLUSIVAMENTE com o objeto JSON válido solicitado." },
                        { role: "user", content: promptText }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.8
                })
            });

            if (!groqRes.ok) {
                const errText = await groqRes.text();
                throw new Error(`Groq API fallback failed: ${errText}`);
            }

            const groqData = await groqRes.json();
            rawContent = groqData.choices[0].message.content;
        }

        if (rawContent.startsWith("```json")) {
            rawContent = rawContent.replace(/^```json\n?/, "").replace(/\n?```$/, "");
        } else if (rawContent.startsWith("```")) {
            rawContent = rawContent.replace(/^```\n?/, "").replace(/\n?```$/, "");
        }

        const qData = JSON.parse(rawContent.trim());

        if (!qData.prompt || !Array.isArray(qData.options) || typeof qData.correct_option_index !== 'number') {
            throw new Error("Formato de resposta inválido da IA.");
        }

        // Save the QuestionInstance
        const newQuestion = await prisma.questionInstance.create({
            data: {
                sessionId: session.id,
                difficulty: session.currentLevel,
                prompt: qData.prompt,
                options: qData.options,
                correctOptionIndex: qData.correct_option_index,
                explanation: qData.explanation
            }
        });

        // Omit sensitive data to prevent cheating
        const { correctOptionIndex, explanation, ...safeQuestion } = newQuestion;

        return NextResponse.json({ success: true, question: safeQuestion });

    } catch (error: any) {
        console.error("Generate Question Error:", error);
        return NextResponse.json(
            { error: "Falha na geração da questão.", details: error.message },
            { status: 500 }
        );
    }
}
