import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    GEMINI_API_KEY: z.string().min(1),
    GEMINI_MODEL: z.string().default("gemini-1.5-flash-latest"),
    OPENAI_API_KEY: z.string().min(1),
    GROQ_API_KEY: z.string().min(1),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    RAG_RETRIEVAL_LIMIT: z.string().transform(Number).default("6"),
    UPLOAD_DIR: z.string().default("./storage/uploads"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Erro de configuração nas variáveis de ambiente:", parsed.error.format());
    throw new Error("Variáveis de ambiente inválidas.");
}

export const env = parsed.data;
