import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
 * Wrapper seguro para JSON.parse. Nunca lança exceção.
 */
export function safeJsonParse<T = unknown>(raw: string): SafeJsonResult<T> {
  try {
    const data = JSON.parse(raw) as T;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
