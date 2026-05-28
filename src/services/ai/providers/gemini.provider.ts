import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";
import { AiProvider, AiGenerateOptions } from "../types";
import { Logger } from "@/lib/logger";
import { cleanMarkdownCodeFences } from "@/lib/utils";

const logger = new Logger("GeminiProvider");

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 45_000;

export class GeminiProvider implements AiProvider {
    readonly name = "gemini";
    private client: GoogleGenAI;

    constructor() {
        this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }

    async generateJson<T = unknown>(prompt: string, options: AiGenerateOptions = {}): Promise<T> {
        const { temperature = 0.6, timeoutMs = DEFAULT_TIMEOUT_MS, modelName = DEFAULT_MODEL, responseSchema } = options;

        const result = await this.withTimeout(
            this.client.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: "application/json",
                    temperature,
                    maxOutputTokens: 8192,
                    responseSchema,
                },
            }),
            timeoutMs
        );

        const cleaned = cleanMarkdownCodeFences(result.text ?? "{}");
        return JSON.parse(cleaned) as T;
    }

    async generateText(prompt: string, options: AiGenerateOptions = {}): Promise<string> {
        const { temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS, modelName = DEFAULT_MODEL, systemInstruction } = options;

        const result = await this.withTimeout(
            this.client.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    systemInstruction,
                    temperature,
                },
            }),
            timeoutMs
        );

        return result.text ?? "";
    }

    async generateTextStream(prompt: string, options: AiGenerateOptions = {}): Promise<ReadableStream<Uint8Array>> {
        const { temperature = 0.7, modelName = DEFAULT_MODEL, systemInstruction } = options;
        const encoder = new TextEncoder();

        logger.info("generateTextStream", "Gemini stream iniciado", { model: modelName });

        const stream = await this.client.models.generateContentStream({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                systemInstruction,
                temperature,
            },
        });

        return new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        const text = chunk.text;
                        if (text) controller.enqueue(encoder.encode(text));
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
