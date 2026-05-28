import { env } from "@/lib/env";
import { AiProvider, AiGenerateOptions } from "../types";
import { Logger } from "@/lib/logger";
import { cleanMarkdownCodeFences } from "@/lib/utils";

const logger = new Logger("GroqProvider");

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_TIMEOUT_MS = 45_000;

export class GroqProvider implements AiProvider {
    readonly name = "groq";

    async generateJson<T = unknown>(prompt: string, options: AiGenerateOptions = {}): Promise<T> {
        const { temperature = 0.6, timeoutMs = DEFAULT_TIMEOUT_MS, modelName = DEFAULT_MODEL, systemInstruction } = options;

        const systemPrompt = systemInstruction
            ?? "Responda EXCLUSIVAMENTE com um objeto JSON válido e bem formado. Não adicione texto antes ou depois do JSON.";

        const response = await this.fetchWithTimeout(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt },
                    ],
                    response_format: { type: "json_object" },
                    temperature,
                    max_tokens: 8192,
                }),
            },
            timeoutMs
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API failed (${response.status}): ${err}`);
        }

        const data = await response.json();
        const raw = data.choices[0]?.message?.content ?? "{}";
        const cleaned = cleanMarkdownCodeFences(raw);
        return JSON.parse(cleaned) as T;
    }

    async generateText(prompt: string, options: AiGenerateOptions = {}): Promise<string> {
        const { temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS, modelName = DEFAULT_MODEL, systemInstruction } = options;

        const systemPrompt = systemInstruction
            ?? "Você é um professor especialista em Redes de Computadores (IPv6). Gere respostas claras e didáticas.";

        const response = await this.fetchWithTimeout(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt },
                    ],
                    temperature,
                }),
            },
            timeoutMs
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API failed (${response.status}): ${err}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content ?? "";
    }

    async generateTextStream(prompt: string, options: AiGenerateOptions = {}): Promise<ReadableStream<Uint8Array>> {
        const { temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS, modelName = DEFAULT_MODEL, systemInstruction } = options;

        const systemPrompt = systemInstruction
            ?? "Você é um professor especialista em Redes de Computadores (IPv6). Gere respostas claras e didáticas.";

        const response = await this.fetchWithTimeout(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt },
                    ],
                    temperature,
                    stream: true,
                }),
            },
            timeoutMs
        );

        if (!response.ok || !response.body) {
            const err = await response.text().catch(() => response.statusText);
            throw new Error(`Groq streaming failed (${response.status}): ${err}`);
        }

        logger.info("generateTextStream", "Groq SSE stream iniciado", { model: modelName });

        const encoder = new TextEncoder();

        // Converte SSE do Groq (data: {...}\n\n) em texto puro
        return new ReadableStream<Uint8Array>({
            async start(controller) {
                const reader = response.body!.getReader();
                const decoder = new TextDecoder("utf-8");
                let buffer = "";

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split("\n");
                        buffer = lines.pop() ?? "";

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed.startsWith("data:")) continue;

                            const jsonStr = trimmed.slice(5).trim();
                            if (jsonStr === "[DONE]") continue;

                            try {
                                const parsed = JSON.parse(jsonStr);
                                const delta = parsed?.choices?.[0]?.delta?.content;
                                if (delta) controller.enqueue(encoder.encode(delta));
                            } catch {
                                // Chunk SSE inválido — ignorar silenciosamente
                            }
                        }
                    }

                    // Processa resto do buffer
                    if (buffer.trim().startsWith("data:")) {
                        const jsonStr = buffer.trim().slice(5).trim();
                        if (jsonStr && jsonStr !== "[DONE]") {
                            try {
                                const parsed = JSON.parse(jsonStr);
                                const delta = parsed?.choices?.[0]?.delta?.content;
                                if (delta) controller.enqueue(encoder.encode(delta));
                            } catch { /* ignorar */ }
                        }
                    }

                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            },
        });
    }

    private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...init, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }
}
