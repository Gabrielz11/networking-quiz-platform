import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    GEMINI_API_KEY: z.string().min(1),
    GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
    // Obrigatória apenas quando EMBEDDING_PROVIDER=openai (padrão)
    OPENAI_API_KEY: z.string().min(1).optional(),
    GROQ_API_KEY: z.string().min(1),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    RAG_RETRIEVAL_LIMIT: z.string().default("6").transform(Number),
    UPLOAD_DIR: z.string().default("./storage/uploads"),
    EMBEDDING_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
    EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Erro de configuração nas variáveis de ambiente:", parsed.error.format());
    throw new Error("Variáveis de ambiente inválidas.");
}

export const env = parsed.data;
