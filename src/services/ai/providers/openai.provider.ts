import OpenAI from "openai";
import { env } from "@/lib/env";
import { AiProvider, AiGenerateOptions, AiResponse } from "../types";
import { Logger } from "@/lib/logger";
import { cleanMarkdownCodeFences, safeJsonParse, validateSchemaRequirements } from "@/lib/utils";

const logger = new Logger("OpenaiProvider");

const DEFAULT_MODEL = "gpt-5.6-terra";
const DEFAULT_TIMEOUT_MS = 45_000;

export class OpenaiProvider implements AiProvider {
    readonly name = "openai";
    private client: OpenAI;

    constructor() {
        if (!env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY não foi configurada no ambiente.");
        }
        this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }

    async generateJson<T = unknown>(prompt: string, options: AiGenerateOptions = {}): Promise<AiResponse<T>> {
        const {
            temperature = 0.6,
            timeoutMs = DEFAULT_TIMEOUT_MS,
            modelName = DEFAULT_MODEL,
            systemInstruction,
            maxTokens,
            responseSchema,
        } = options;

        const systemPrompt =
            systemInstruction ??
            "Responda EXCLUSIVAMENTE com um objeto JSON válido e bem formado. Não adicione texto antes ou depois do JSON.";

        const completion = await this.withTimeout(
            this.client.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt },
                ],
                response_format: { type: "json_object" },
                temperature,
                ...(maxTokens ? { max_tokens: maxTokens } : {}),
            }),
            timeoutMs
        );

        const raw = completion.choices[0]?.message?.content ?? "{}";
        const cleaned = cleanMarkdownCodeFences(raw);

        const promptTokens = completion.usage?.prompt_tokens ?? 0;
        const completionTokens = completion.usage?.completion_tokens ?? 0;

        const parsed = safeJsonParse<T>(cleaned);
        if (parsed.success) {
            if (responseSchema) {
                const schemaError = validateSchemaRequirements(parsed.data, responseSchema);
                if (schemaError) {
                    logger.error("generateJson", `Falha na validação de schema (OpenAI): ${schemaError}`);
                    throw new Error(`Schema validation failed: ${schemaError}`);
                }
            }
            return {
                result: parsed.data!,
                usage: { promptTokens, completionTokens },
            };
        }

        logger.error("generateJson", "Falha crítica de parsing no JSON da OpenAI (mesmo após reparo)", {
            error: parsed.error?.message,
            rawOutput: cleaned.slice(0, 1000),
        });
        throw parsed.error ?? new Error("JSON parsing failed");
    }

    async generateText(prompt: string, options: AiGenerateOptions = {}): Promise<AiResponse<string>> {
        const {
            temperature = 0.7,
            timeoutMs = DEFAULT_TIMEOUT_MS,
            modelName = DEFAULT_MODEL,
            systemInstruction,
            maxTokens,
        } = options;

        const systemPrompt =
            systemInstruction ??
            "Você é um professor especialista em Redes de Computadores (IPv6). Gere respostas claras e didáticas.";

        const completion = await this.withTimeout(
            this.client.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt },
                ],
                temperature,
                ...(maxTokens ? { max_tokens: maxTokens } : {}),
            }),
            timeoutMs
        );

        const promptTokens = completion.usage?.prompt_tokens ?? 0;
        const completionTokens = completion.usage?.completion_tokens ?? 0;

        return {
            result: completion.choices[0]?.message?.content ?? "",
            usage: { promptTokens, completionTokens },
        };
    }

    async generateTextStream(prompt: string, options: AiGenerateOptions = {}): Promise<ReadableStream<Uint8Array>> {
        const {
            temperature = 0.7,
            modelName = DEFAULT_MODEL,
            systemInstruction,
            maxTokens,
        } = options;

        const systemPrompt =
            systemInstruction ??
            "Você é um professor especialista em Redes de Computadores (IPv6). Gere respostas claras e didáticas.";

        logger.info("generateTextStream", "OpenAI stream iniciado", { model: modelName });

        const stream = await this.client.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            temperature,
            stream: true,
            stream_options: { include_usage: true },
            ...(maxTokens ? { max_tokens: maxTokens } : {}),
        });

        const encoder = new TextEncoder();

        return new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        if (chunk.usage) {
                            const pt = chunk.usage.prompt_tokens ?? 0;
                            const ct = chunk.usage.completion_tokens ?? 0;
                            logger.info(
                                "generateTextStream",
                                `Consumo de Tokens (Stream OpenAI) — Modelo: ${modelName} | Input: ${pt} | Output: ${ct} | Total: ${pt + ct}`
                            );
                        }
                        const delta = chunk.choices[0]?.delta?.content;
                        if (delta) {
                            controller.enqueue(encoder.encode(delta));
                        }
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            },
        });
    }

    private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`OpenAI timeout após ${ms}ms`)), ms);
            promise
                .then((v) => {
                    clearTimeout(timer);
                    resolve(v);
                })
                .catch((e) => {
                    clearTimeout(timer);
                    reject(e);
                });
        });
    }
}
