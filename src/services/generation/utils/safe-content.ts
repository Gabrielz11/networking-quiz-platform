/**
 * Trunca o conteúdo para o limite seguro de caracteres especificado para evitar estourar o limite de tokens da IA.
 */
export function getSafeContent(content: string, maxChars = 15000): string {
    return content.trim().slice(0, maxChars);
}
