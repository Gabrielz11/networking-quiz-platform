import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { env } from "@/lib/env";
import { AiProvider, AiGenerateOptions, AiResponse } from "../types";
import { Logger } from "@/lib/logger";
import { cleanMarkdownCodeFences, safeJsonParse, validateSchemaRequirements } from "@/lib/utils";

const logger = new Logger("GeminiProvider");

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 45_000;

export class GeminiProvider implements AiProvider {
    readonly name = "gemini";
    private client: GoogleGenAI;

    constructor() {
        this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }

    async generateJson<T = unknown>(prompt: string, options: AiGenerateOptions = {}): Promise<AiResponse<T>> {
        const { temperature = 0.6, timeoutMs = DEFAULT_TIMEOUT_MS, modelName = DEFAULT_MODEL, responseSchema, maxTokens } = options;

        const result = await this.withTimeout(
            this.client.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: "application/json",
                    temperature,
                    maxOutputTokens: maxTokens ?? 2048,
                    responseSchema,
                    safetySettings: [
                        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                    ]
                },
            }),
            timeoutMs
        );

        const promptTokens = result.usageMetadata?.promptTokenCount ?? 0;
        const completionTokens = result.usageMetadata?.candidatesTokenCount ?? 0;

        const cleaned = cleanMarkdownCodeFences(result.text ?? "{}");
        const parsed = safeJsonParse<T>(cleaned);
        if (parsed.success) {
            if (responseSchema) {
                const schemaError = validateSchemaRequirements(parsed.data, responseSchema);
                if (schemaError) {
                    logger.error("generateJson", `Falha na validação de schema (Gemini): ${schemaError}`);
                    throw new Error(`Schema validation failed: ${schemaError}`);
                }
            }
            return {
                result: parsed.data!,
                usage: { promptTokens, completionTokens }
            };
        }

        logger.error("generateJson", "Falha crítica de parsing no JSON do Gemini (mesmo após reparo)", {
            error: parsed.error?.message,
            rawOutput: cleaned.slice(0, 1000)
        });
        throw parsed.error ?? new Error("JSON parsing failed");
    }

    async generateText(prompt: string, options: AiGenerateOptions = {}): Promise<AiResponse<string>> {
        const { temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS, modelName = DEFAULT_MODEL, systemInstruction, thinkingBudget, maxTokens } = options;

        const result = await this.withTimeout(
            this.client.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    systemInstruction,
                    temperature,
                    maxOutputTokens: maxTokens,
                    ...(thinkingBudget !== undefined && {
                        thinkingConfig: { thinkingBudget },
                    }),
                },
            }),
            timeoutMs
        );

        const promptTokens = result.usageMetadata?.promptTokenCount ?? 0;
        const completionTokens = result.usageMetadata?.candidatesTokenCount ?? 0;

        return {
            result: result.text ?? "",
            usage: { promptTokens, completionTokens }
        };
    }

    async generateTextStream(prompt: string, options: AiGenerateOptions = {}): Promise<ReadableStream<Uint8Array>> {
        const { temperature = 0.7, modelName = DEFAULT_MODEL, systemInstruction, maxTokens } = options;
        const encoder = new TextEncoder();

        logger.info("generateTextStream", "Gemini stream iniciado", { model: modelName });

        const stream = await this.client.models.generateContentStream({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                systemInstruction,
                temperature,
                maxOutputTokens: maxTokens,
            },
        });

        return new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    let lastChunk: any = null;
                    for await (const chunk of stream) {
                        lastChunk = chunk;
                        const text = chunk.text;
                        if (text) controller.enqueue(encoder.encode(text));
                    }

                    const metadata = lastChunk?.usageMetadata;
                    if (metadata) {
                        const promptTokens = metadata.promptTokenCount ?? 0;
                        const completionTokens = metadata.candidatesTokenCount ?? 0;
                        logger.info("generateTextStream", `Consumo de Tokens (Stream) — Modelo: ${modelName} | Input: ${promptTokens} | Output: ${completionTokens} | Total: ${promptTokens + completionTokens}`);
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
            const timer = setTimeout(() => reject(new Error(`Gemini timeout após ${ms}ms`)), ms);
            promise
                .then((v) => { clearTimeout(timer); resolve(v); })
                .catch((e) => { clearTimeout(timer); reject(e); });
        });
    }
}
