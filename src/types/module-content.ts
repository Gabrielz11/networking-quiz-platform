export interface ModuleTable {
    headers: string[];
    rows: string[][];
}

export interface ModuleSection {
    title: string;
    paragraphs: string[];
    items?: string[];
    table?: ModuleTable;
}

export interface StructuredModuleContent {
    sections: ModuleSection[];
}

/**
 * Analisa o conteúdo markdown estruturado gerado pela IA e divide em seções visuais
 * contendo títulos, parágrafos, listas de itens e tabelas de comparação.
 */
export function parseModuleContent(content: string): StructuredModuleContent | null {
    if (!content) return null;

    // Se o conteúdo não possuir os cabeçalhos clássicos estruturados, trata como texto simples legado
    if (!content.includes("# Introdução") && !content.includes("# Introducao")) {
        return null;
    }

    try {
        const sections: ModuleSection[] = [];
        
        // Divide o texto com base em títulos (# Título)
        const rawSections = content.split(/\n?#\s+/);
        
        for (const rawSec of rawSections) {
            const lines = rawSec.split("\n");
            const title = lines[0].trim();
            if (!title) continue;

            const remainingText = lines.slice(1).join("\n").trim();
            const paragraphs: string[] = [];
            const items: string[] = [];
            let table: ModuleTable | undefined = undefined;

            // Separa os blocos de conteúdo por quebras de linha duplas
            const rawBlocks = remainingText.split(/\n\s*\n/);
            
            for (const block of rawBlocks) {
                const trimmedBlock = block.trim();
                if (!trimmedBlock) continue;

                // Caso 1: Bloco de Tabela Markdown (| col | col |)
                if (trimmedBlock.startsWith("|")) {
                    const tableLines = trimmedBlock.split("\n").map(l => l.trim()).filter(Boolean);
                    if (tableLines.length >= 2) {
                        // Extrai cabeçalhos da primeira linha, pulando as bordas externas do pipe
                        const headers = tableLines[0]
                            .split("|")
                            .map(h => h.trim())
                            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
                        
                        // Extrai linhas de dados, ignorando linhas de separação (ex: |---|---|)
                        const rows: string[][] = [];
                        for (let i = 1; i < tableLines.length; i++) {
                            const line = tableLines[i];
                            if (line.includes("---") || line.includes("===")) continue;
                            const cells = line
                                .split("|")
                                .map(c => c.trim())
                                .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
                            if (cells.length > 0) {
                                rows.push(cells);
                            }
                        }

                        if (headers.length > 0 && rows.length > 0) {
                            table = { headers, rows };
                        }
                    }
                }
                // Caso 2: Bloco de Lista (- item ou * item)
                else if (trimmedBlock.startsWith("-") || trimmedBlock.startsWith("*")) {
                    const listLines = trimmedBlock.split("\n").map(l => l.trim()).filter(Boolean);
                    for (const line of listLines) {
                        const match = line.match(/^[-*]\s+(.*)$/);
                        if (match) {
                            items.push(match[1]);
                        } else {
                            paragraphs.push(line);
                        }
                    }
                }
                // Caso 3: Bloco de Parágrafo Regular ou código
                else {
                    paragraphs.push(trimmedBlock);
                }
            }

            sections.push({
                title,
                paragraphs,
                items: items.length > 0 ? items : undefined,
                table
            });
        }

        return sections.length > 0 ? { sections } : null;
    } catch (error) {
        console.error("Erro ao analisar conteúdo estruturado:", error);
        return null;
    }
}
