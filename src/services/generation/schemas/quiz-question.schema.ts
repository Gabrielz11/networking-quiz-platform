import { z } from "zod";

export const QuestionSchema = z.object({
    prompt: z
        .string()
        .trim()
        .min(10, "O enunciado deve ter pelo menos 10 caracteres.")
        .max(1000, "O enunciado não pode ultrapassar 1000 caracteres."),
    options: z
        .array(z.string().trim().min(1).max(500))
        .length(4, "Devem ser exatamente 4 opções.")
        .refine(
            (opts) => new Set(opts.map((o) => o.trim().toLowerCase())).size === 4,
            { message: "As opções devem ser únicas." }
        ),
    correct_option_index: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(10).max(2000),
}).strict();

export type GeneratedQuestion = z.infer<typeof QuestionSchema>;
