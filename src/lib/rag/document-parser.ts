// src/lib/rag/document-parser.ts

import fs from "node:fs/promises";
import type { ParsedDocument } from "./rag-types";

export async function parseDocument(input: {
    filePath: string;
    fileName: string;
    mimeType: string;
}): Promise<ParsedDocument> {
    if (input.mimeType === "application/pdf") {
        return parsePdf(input);
    }

    if (input.mimeType === "text/plain") {
        return parseTxt(input);
    }

    throw new Error(`Tipo de arquivo não suportado: ${input.mimeType}`);
}

async function parseTxt(input: {
    filePath: string;
    fileName: string;
    mimeType: string;
}): Promise<ParsedDocument> {
    const text = await fs.readFile(input.filePath, "utf-8");

    return {
        text: text.trim(),
        metadata: {
            fileName: input.fileName,
            mimeType: input.mimeType,
        },
    };
}

async function parsePdf(input: {
    filePath: string;
    fileName: string;
    mimeType: string;
}): Promise<ParsedDocument> {
    // Dynamic import para evitar problemas de SSR com pdf-parse
    const pdf = (await import("pdf-parse")).default;
    const buffer = await fs.readFile(input.filePath);
    const data = await pdf(buffer);

    if (!data.text || data.text.trim().length === 0) {
        throw new Error("Não foi possível extrair texto deste PDF.");
    }

    return {
        text: data.text.trim(),
        metadata: {
            fileName: input.fileName,
            mimeType: input.mimeType,
            pageCount: data.numpages,
        },
    };
}
