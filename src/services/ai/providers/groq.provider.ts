import { env } from "@/lib/env";
import { AiProvider, AiGenerateOptions } from "../types";
import { Logger } from "@/lib/logger";
import { cleanMarkdownCodeFences } from "@/lib/utils";

const logger = new Logger("GroqProvider");

export class GroqProvider implements AiProvider {
    readonly name = "groq";

    async generateJson<T = unknown>(prompt: string, options: AiGenerateOptions = {}): Promise<T> {
        const groqKey = env.GROQ_API_KEY;

        const systemPrompt = `Você é um Especialista Sênior em Engenharia de Redes (IPv6) e Designer Instrucional de elite.
        Responda EXCLUSIVAMENTE com um objeto JSON válido.
        Mantenha profundidade máxima e densidade técnica.`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: options.modelName || "meta-llama/llama-4-scout-17b-16e-instruct",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                temperature: options.temperature ?? 0.6,
                max_tokens: 8192,
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API failed: ${err}`);
        }

        const data = await response.json();
        const cleaned = cleanMarkdownCodeFences(data.choices[0].message.content || "{}");
        return JSON.parse(cleaned);
    }

    async generateText(prompt: string, options: AiGenerateOptions = {}): Promise<string> {
        const groqKey = env.GROQ_API_KEY;

        const textSystemPrompt = options.systemInstruction
            ? `${options.systemInstruction}\n\nFOQUE em gerar conteúdo profundo e detalhado.`
            : "Você é um especialista em educação tecnológica. Gere respostas detalhadas e ricas.";

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: options.modelName || "meta-llama/llama-4-scout-17b-16e-instruct",
                messages: [
                    { role: "system", content: textSystemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: options.temperature ?? 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API failed: ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content || "";
    }
}
