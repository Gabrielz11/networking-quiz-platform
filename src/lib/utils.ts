import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { jsonrepair } from "jsonrepair"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Remove code fences de markdown (```json ... ```) do conteúdo retornado pela IA.
 */
export function cleanMarkdownCodeFences(rawContent: string): string {
  let cleaned = rawContent;
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}


export interface SafeJsonResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Wrapper seguro para JSON.parse com fallback jsonrepair.
 * Corrige JSON malformado gerado por LLMs (aspas não escapadas,
 * quebras de linha cruas dentro de strings, vírgulas pendentes, etc.).
 */
export function safeJsonParse<T = unknown>(raw: string): SafeJsonResult<T> {
  // Tentativa 1: JSON válido direto
  try {
    const data = JSON.parse(raw) as T;
    return { success: true, data };
  } catch {
    // Tentativa 2: corrigir com jsonrepair
    try {
      const repaired = jsonrepair(raw);
      const data = JSON.parse(repaired) as T;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

/**
 * Validação estrutural básica de schema para respostas JSON.
 * Usado nos provedores LLM para rejeitar JSONs que, embora sintaticamente válidos
 * (devido ao jsonrepair), estão incompletos estruturalmente (truncados).
 */
export function validateSchemaRequirements(data: any, schema: any): string | null {
  if (!schema) return null;
  
  if (schema.type === "object" && Array.isArray(schema.required)) {
    if (typeof data !== "object" || data === null) {
      return "Expected an object";
    }
    for (const req of schema.required) {
      if (!(req in data)) {
        return `Missing required property: ${req}`;
      }
    }
  }

  if (schema.type === "array") {
    if (!Array.isArray(data)) return "Expected an array";
    if (typeof schema.minItems === "number" && data.length < schema.minItems) {
      return `Array has less than ${schema.minItems} items`;
    }
  }

  return null;
}

