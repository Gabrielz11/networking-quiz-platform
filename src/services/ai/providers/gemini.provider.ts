import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";
import { AiProvider, AiGenerateOptions } from "../types";
import { Logger } from "@/lib/logger";
import { cleanMarkdownCodeFences } from "@/lib/utils";

const logger = new Logger("GeminiProvider");

export class GeminiProvider implements AiProvider {
    readonly name = "gemini";
    private client: GoogleGenAI;

    constructor() {
        this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }

    async generateJson<T = unknown>(prompt: string, options: AiGenerateOptions = {}): Promise<T> {
        const result = await this.client.models.generateContent({
            model: options.modelName || env.GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                temperature: options.temperature,
                maxOutputTokens: 8192,
                responseSchema: options.responseSchema
            }
        });

        const cleaned = cleanMarkdownCodeFences(result.text || "{}");
        return JSON.parse(cleaned);
    }

    async generateText(prompt: string, options: AiGenerateOptions = {}): Promise<string> {
        const result = await this.client.models.generateContent({
            model: options.modelName || env.GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                systemInstruction: options.systemInstruction,
                temperature: options.temperature
            }
        });

        return result.text || "";
    }
}
