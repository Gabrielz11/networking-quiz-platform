// src/lib/rag/document-parser.ts

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import type { ParsedDocument } from "./rag-types";

// No Node.js com Next.js, desabilitar o worker costuma ser mais estável
// para evitar que o Turbopack tente resolver caminhos dinâmicos incorretamente.
// O PDFParse suporta passar disableWorker nas opções do construtor.

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
    const buffer = await fs.readFile(input.filePath);
    const parser = new PDFParse({ 
        data: buffer,
        disableWorker: true,
        useSystemFonts: true
    });
    const result = await parser.getText();
    await parser.destroy();

    if (!result.text || result.text.trim().length === 0) {
        throw new Error("Não foi possível extrair texto deste PDF.");
    }

    return {
        text: result.text.trim(),
        metadata: {
            fileName: input.fileName,
            mimeType: input.mimeType,
            pageCount: result.total,
        },
    };
}
