import { get_encoding } from "tiktoken";
import type { DocumentChunk } from "../../types";

export interface ChunkingOptions {
    maxTokens: number;
    overlapTokens: number;
}

export class RecursiveChunker {
    private encoding = get_encoding("cl100k_base");
    private options: ChunkingOptions;

    // Preferred separator order
    private separators = [
        "\n\n",
        "\n",
        "## ",
        "### ",
        ". ",
        "? ",
        "! ",
        " ",
        "",
    ];

    constructor(options: Partial<ChunkingOptions> = {}) {
        this.options = {
            maxTokens: options.maxTokens ?? 500,
            overlapTokens: options.overlapTokens ?? 80,
        };
    }

    createChunks(text: string, metadata: Partial<DocumentChunk> = {}): DocumentChunk[] {
        const textChunks = this.splitText(text);
        
        return textChunks.map((content, index) => ({
            ...metadata,
            content,
            chunkIndex: index,
            tokenCount: this.getTokenCount(content),
            id: crypto.randomUUID(),
        }));
    }

    splitText(text: string): string[] {
        const chunks = this.splitRecursive(text, this.separators);
        return this.mergeWithOverlap(chunks);
    }

    private splitRecursive(text: string, separators: string[]): string[] {
        if (!text.trim()) return [];
        
        const tokenCount = this.getTokenCount(text);
        if (tokenCount <= this.options.maxTokens) {
            return [text];
        }

        const separator = separators[0] ?? "";
        const nextSeparators = separators.slice(1);

        let splits: string[] = [];
        if (separator) {
            splits = text.split(separator);
        } else {
            splits = text.split("");
        }

        const chunks: string[] = [];
        
        for (const split of splits) {
            const splitTokens = this.getTokenCount(split);
            if (splitTokens > this.options.maxTokens && nextSeparators.length > 0) {
                const subChunks = this.splitRecursive(split, nextSeparators);
                chunks.push(...subChunks);
            } else if (split.trim()) {
                chunks.push(split);
            }
        }

        return chunks;
    }

    private mergeWithOverlap(splits: string[]): string[] {
        const chunks: string[] = [];
        let currentChunk: string[] = [];
        let currentTokens = 0;

        for (let i = 0; i < splits.length; i++) {
            const split = splits[i];
            const splitTokens = this.getTokenCount(split);

            if (currentTokens + splitTokens > this.options.maxTokens && currentChunk.length > 0) {
                chunks.push(currentChunk.join(" ").trim());
                
                // Overlap
                let overlapTokens = 0;
                let j = currentChunk.length - 1;
                const newChunk: string[] = [];
                
                while (j >= 0) {
                    const prevSplit = currentChunk[j];
                    const prevTokens = this.getTokenCount(prevSplit);
                    if (overlapTokens + prevTokens > this.options.overlapTokens) {
                        break;
                    }
                    newChunk.unshift(prevSplit);
                    overlapTokens += prevTokens;
                    j--;
                }
                
                currentChunk = newChunk;
                currentTokens = overlapTokens;
            }

            currentChunk.push(split);
            currentTokens += splitTokens;
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(" ").trim());
        }

        return chunks.filter(c => c.length > 0);
    }

    private getTokenCount(text: string): number {
        return this.encoding.encode(text).length;
    }
}
