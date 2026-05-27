/**
 * SemanticChunker — Chunking hierárquico guiado por estrutura Markdown.
 *
 * Estratégia em 3 fases:
 *   1. Divide o texto pelos cabeçalhos Markdown (#, ##, ###, ####)
 *      → fronteiras semânticas naturais do documento
 *   2. Cada seção vira um PARENT chunk (~1500 tokens)
 *      → armazenado sem embedding; serve como contexto expandido
 *   3. Cada PARENT é subdividido em CHILDs (~300 tokens, overlap ~30t)
 *      → recebem embedding para busca vetorial
 *
 * Na recuperação (searchSimilar), o sistema busca pelo CHILD mas
 * entrega o conteúdo do PARENT correspondente para a IA, garantindo
 * contexto muito mais rico e coerente.
 */

import { get_encoding } from "tiktoken";
import type { DocumentChunk } from "../../types";

export interface SemanticChunkingOptions {
    /** Tamanho máximo do chunk PARENT em tokens (padrão: 1500) */
    parentMaxTokens: number;
    /** Tamanho máximo do chunk CHILD em tokens (padrão: 300) */
    childMaxTokens: number;
    /** Overlap entre CHILDs adjacentes em tokens (padrão: 30) */
    childOverlapTokens: number;
}

interface Section {
    title: string;      // cabeçalho extraído (ex: "## 3.2 Neighbor Discovery")
    level: number;      // profundidade: 1=h1, 2=h2, 3=h3, 4=h4
    content: string;    // texto completo da seção (sem o cabeçalho)
}

export class SemanticChunker {
    private encoding = get_encoding("cl100k_base");
    private options: SemanticChunkingOptions;

    /** Regex que captura cabeçalhos Markdown (# até ####) */
    private static readonly HEADING_RE = /^(#{1,4})\s+(.+)$/m;

    constructor(options: Partial<SemanticChunkingOptions> = {}) {
        this.options = {
            parentMaxTokens: options.parentMaxTokens ?? 1500,
            childMaxTokens: options.childMaxTokens ?? 300,
            childOverlapTokens: options.childOverlapTokens ?? 30,
        };
    }

    // ─── API Pública ──────────────────────────────────────────────────────────

    /**
     * Gera a hierarquia completa de chunks (PARETs + CHILDs) a partir do texto.
     * PARETs têm `chunkType: "parent"` e `parentChunkId: undefined`.
     * CHILDs têm `chunkType: "child"` e `parentChunkId` referenciando seu PARENT.
     */
    createChunks(text: string, metadata: Partial<DocumentChunk> = {}): DocumentChunk[] {
        const sections = this.splitBySections(text);
        const allChunks: DocumentChunk[] = [];
        let globalIndex = 0;

        for (const section of sections) {
            // Seções com menos de 20 chars são ignoradas (cabeçalhos vazios, etc.)
            if (section.content.trim().length < 20) continue;

            // ── PARENT ──────────────────────────────────────────────────────
            const parentId = crypto.randomUUID();
            const parentContent = section.title
                ? `${section.title}\n\n${section.content.trim()}`
                : section.content.trim();

            const parentTokens = this.countTokens(parentContent);

            const parentChunk: DocumentChunk = {
                ...metadata,
                id: parentId,
                content: parentContent,
                chunkIndex: globalIndex++,
                tokenCount: parentTokens,
                sectionTitle: section.title || undefined,
                chunkType: "parent",
                parentChunkId: undefined,
            };
            allChunks.push(parentChunk);

            // ── CHILDs ──────────────────────────────────────────────────────
            const childTexts = this.splitIntoChildren(section.content.trim());
            for (const childText of childTexts) {
                if (!childText.trim()) continue;

                // Prefixo de seção para manter contexto no child
                const childContent = section.title
                    ? `[Seção: ${section.title}]\n${childText}`
                    : childText;

                allChunks.push({
                    ...metadata,
                    id: crypto.randomUUID(),
                    content: childContent,
                    chunkIndex: globalIndex++,
                    tokenCount: this.countTokens(childContent),
                    sectionTitle: section.title || undefined,
                    chunkType: "child",
                    parentChunkId: parentId,
                });
            }
        }

        return allChunks;
    }

    // ─── Internos ─────────────────────────────────────────────────────────────

    /**
     * Divide o texto em seções delimitadas pelos cabeçalhos Markdown.
     * Texto antes do primeiro cabeçalho vira uma seção "introdução".
     */
    private splitBySections(text: string): Section[] {
        const lines = text.split("\n");
        const sections: Section[] = [];
        let currentTitle = "";
        let currentLevel = 0;
        let currentLines: string[] = [];

        const flushSection = () => {
            const content = currentLines.join("\n").trim();
            if (content.length > 0) {
                sections.push({ title: currentTitle, level: currentLevel, content });
            }
        };

        for (const line of lines) {
            const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
            if (headingMatch) {
                flushSection();
                currentTitle = line.trim(); // ex: "## 3.2 NDP"
                currentLevel = headingMatch[1].length;
                currentLines = [];
            } else {
                currentLines.push(line);
            }
        }
        flushSection(); // última seção

        return sections;
    }

    /**
     * Subdivide o conteúdo de uma seção em CHILDs de até `childMaxTokens` tokens
     * com overlap de `childOverlapTokens` tokens entre segmentos adjacentes.
     * Preserva parágrafos intactos quando possível.
     */
    private splitIntoChildren(text: string): string[] {
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
        const children: string[] = [];
        let currentParts: string[] = [];
        let currentTokens = 0;

        const flush = () => {
            if (currentParts.length > 0) {
                children.push(currentParts.join("\n\n").trim());
            }
        };

        for (const para of paragraphs) {
            const paraTokens = this.countTokens(para);

            // Parágrafo individual maior que o limite — subdivide por sentença
            if (paraTokens > this.options.childMaxTokens) {
                flush();
                currentParts = [];
                currentTokens = 0;
                const sentences = this.splitBySentence(para);
                children.push(...this.mergeWithOverlap(sentences));
                continue;
            }

            // Adicionar parágrafo ao chunk atual se couber
            if (currentTokens + paraTokens > this.options.childMaxTokens && currentParts.length > 0) {
                flush();
                // Overlap: mantém o último parágrafo no novo chunk
                const lastPart = currentParts[currentParts.length - 1];
                const lastTokens = this.countTokens(lastPart);
                if (lastTokens <= this.options.childOverlapTokens) {
                    currentParts = [lastPart];
                    currentTokens = lastTokens;
                } else {
                    currentParts = [];
                    currentTokens = 0;
                }
            }

            currentParts.push(para);
            currentTokens += paraTokens;
        }
        flush();

        return children.filter(c => c.trim().length > 0);
    }

    /** Divide texto em sentenças por pontuação final (.!?). */
    private splitBySentence(text: string): string[] {
        return text
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    /**
     * Mescla sentenças em CHILDs respeitando `childMaxTokens`
     * com overlap de `childOverlapTokens` tokens.
     */
    private mergeWithOverlap(sentences: string[]): string[] {
        const chunks: string[] = [];
        let current: string[] = [];
        let currentTokens = 0;

        for (const sentence of sentences) {
            const sentTokens = this.countTokens(sentence);

            if (currentTokens + sentTokens > this.options.childMaxTokens && current.length > 0) {
                chunks.push(current.join(" ").trim());

                // Overlap: mantém sentenças finais do chunk anterior
                let overlapTokens = 0;
                const overlapParts: string[] = [];
                for (let i = current.length - 1; i >= 0; i--) {
                    const t = this.countTokens(current[i]);
                    if (overlapTokens + t > this.options.childOverlapTokens) break;
                    overlapParts.unshift(current[i]);
                    overlapTokens += t;
                }
                current = overlapParts;
                currentTokens = overlapTokens;
            }

            current.push(sentence);
            currentTokens += sentTokens;
        }

        if (current.length > 0) chunks.push(current.join(" ").trim());
        return chunks;
    }

    private countTokens(text: string): number {
        return this.encoding.encode(text).length;
    }
}
