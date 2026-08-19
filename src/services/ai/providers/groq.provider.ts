import { env } from "@/lib/env";
import { AiProvider, AiGenerateOptions, AiResponse } from "../types";
import { Logger } from "@/lib/logger";
import { cleanMarkdownCodeFences, safeJsonParse, validateSchemaRequirements } from "@/lib/utils";

const logger = new Logger("GroqProvider");

const DEFAULT_MODEL = "openai/gpt-oss-20b";
const DEFAULT_TIMEOUT_MS = 45_000;

export class GroqProvider implements AiProvider {
    readonly name = "groq";

    async generateJson<T = unknown>(prompt: string, options: AiGenerateOptions = {}): Promise<AiResponse<T>> {
        const { temperature = 0.6, timeoutMs = DEFAULT_TIMEOUT_MS, modelName = DEFAULT_MODEL, systemInstruction, maxTokens, responseSchema } = options;

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
                    max_tokens: maxTokens ?? 2048,
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
        
        const promptTokens = data.usage?.prompt_tokens ?? 0;
        const completionTokens = data.usage?.completion_tokens ?? 0;

        const parsed = safeJsonParse<T>(cleaned);
        if (parsed.success) {
            if (responseSchema) {
                const schemaError = validateSchemaRequirements(parsed.data, responseSchema);
                if (schemaError) {
                    logger.error("generateJson", `Falha na validação de schema (Groq): ${schemaError}`);
                    throw new Error(`Schema validation failed: ${schemaError}`);
                }
            }
            return {
                result: parsed.data!,
                usage: { promptTokens, completionTokens }
            };
        }

        logger.error("generateJson", "Falha crítica de parsing no JSON do Groq (mesmo após reparo)", {
            error: parsed.error?.message,
            rawOutput: cleaned.slice(0, 1000)
        });
        throw parsed.error ?? new Error("JSON parsing failed");
    }

    async generateText(prompt: string, options: AiGenerateOptions = {}): Promise<AiResponse<string>> {
        const { temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS, modelName = DEFAULT_MODEL, systemInstruction, maxTokens } = options;

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
                    ...(maxTokens ? { max_tokens: maxTokens } : {}),
                }),
            },
            timeoutMs
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API failed (${response.status}): ${err}`);
        }

        const data = await response.json();
        
        const promptTokens = data.usage?.prompt_tokens ?? 0;
        const completionTokens = data.usage?.completion_tokens ?? 0;

        return {
            result: data.choices[0]?.message?.content ?? "",
            usage: { promptTokens, completionTokens }
        };
    }

    async generateTextStream(prompt: string, options: AiGenerateOptions = {}): Promise<ReadableStream<Uint8Array>> {
        const { temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS, modelName = DEFAULT_MODEL, systemInstruction, maxTokens } = options;

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
                    stream_options: { include_usage: true },
                    ...(maxTokens ? { max_tokens: maxTokens } : {}),
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
                let loggedUsage = false;

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
                                if (parsed?.usage && !loggedUsage) {
                                    loggedUsage = true;
                                    const pt = parsed.usage.prompt_tokens ?? 0;
                                    const ct = parsed.usage.completion_tokens ?? 0;
                                    logger.info("generateTextStream", `Consumo de Tokens (Stream) — Modelo: ${modelName} | Input: ${pt} | Output: ${ct} | Total: ${pt + ct}`);
                                }
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
                                if (parsed?.usage && !loggedUsage) {
                                    loggedUsage = true;
                                    const pt = parsed.usage.prompt_tokens ?? 0;
                                    const ct = parsed.usage.completion_tokens ?? 0;
                                    logger.info("generateTextStream", `Consumo de Tokens (Stream) — Modelo: ${modelName} | Input: ${pt} | Output: ${ct} | Total: ${pt + ct}`);
                                }
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
