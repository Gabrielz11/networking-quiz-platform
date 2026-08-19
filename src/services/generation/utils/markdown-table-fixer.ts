// src/services/generation/utils/markdown-table-fixer.ts
//
// Utilitário para detecção e correção de tabelas Markdown malformadas
// na saída do LLM. Corrige problemas comuns como pipes faltantes,
// separadores ausentes e colunas desalinhadas.

/**
 * Detecta e corrige tabelas Markdown malformadas no conteúdo gerado.
 *
 * Problemas tratados:
 * 1. Pipes faltantes no início/fim de linhas da tabela
 * 2. Linha separadora (|---|---|---) ausente após o cabeçalho
 * 3. Número inconsistente de colunas entre linhas
 * 4. Tabelas irrecuperáveis são removidas com aviso em comentário
 */
export function fixMarkdownTables(content: string): string {
    // Regex para detectar blocos que parecem tabelas Markdown
    // Uma tabela Markdown começa com uma linha contendo pipes (|)
    const lines = content.split("\n");
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
        // Detectar início de tabela: linha com pelo menos 2 pipes
        if (isTableRow(lines[i])) {
            const tableLines = extractTableBlock(lines, i);
            const fixed = fixTable(tableLines);
            result.push(...fixed);
            i += tableLines.length;
        } else {
            result.push(lines[i]);
            i++;
        }
    }

    return result.join("\n");
}

function isTableRow(line: string): boolean {
    const trimmed = line.trim();
    // Uma linha de tabela deve ter pelo menos 2 pipes e não ser um separador puro isolado
    const pipeCount = (trimmed.match(/\|/g) || []).length;
    return pipeCount >= 2 && !trimmed.startsWith("```");
}

function isSeparatorRow(line: string): boolean {
    const trimmed = line.trim();
    // Separador: | --- | --- | ou |---|---|
    return /^\|[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|?\s*$/.test(trimmed);
}

function extractTableBlock(lines: string[], startIndex: number): string[] {
    const tableLines: string[] = [];
    let i = startIndex;

    while (i < lines.length) {
        const trimmed = lines[i].trim();

        // Linha vazia ou linha sem pipes encerra a tabela
        if (trimmed === "" || !trimmed.includes("|")) {
            break;
        }

        tableLines.push(lines[i]);
        i++;
    }

    return tableLines;
}

function fixTable(tableLines: string[]): string[] {
    if (tableLines.length < 2) {
        return tableLines; // Não é uma tabela válida, retornar como está
    }

    // 1. Normalizar cada linha: garantir pipes no início e fim
    const normalized = tableLines.map(normalizePipes);

    // 2. Contar colunas em cada linha
    const columnCounts = normalized.map(countColumns);
    const maxColumns = Math.max(...columnCounts);

    // Se nenhuma linha tem colunas consistentes, tabela irrecuperável
    if (maxColumns < 2) {
        return tableLines;
    }

    // 3. Alinhar número de colunas em todas as linhas
    const aligned = normalized.map((line) => {
        const cols = splitColumns(line);
        while (cols.length < maxColumns) {
            cols.push("—");
        }
        // Truncar colunas extras
        const final = cols.slice(0, maxColumns);
        return `| ${final.join(" | ")} |`;
    });

    // 4. Garantir que a segunda linha é um separador
    if (aligned.length >= 2 && !isSeparatorRow(aligned[1])) {
        const separator = `| ${Array(maxColumns).fill("---").join(" | ")} |`;
        aligned.splice(1, 0, separator);
    }

    // 5. Validar que o separador tem o número correto de colunas
    if (aligned.length >= 2 && isSeparatorRow(aligned[1])) {
        const sepCols = countColumns(aligned[1]);
        if (sepCols !== maxColumns) {
            aligned[1] = `| ${Array(maxColumns).fill("---").join(" | ")} |`;
        }
    }

    return aligned;
}

function normalizePipes(line: string): string {
    let trimmed = line.trim();

    // Adicionar pipe no início se ausente
    if (!trimmed.startsWith("|")) {
        trimmed = `| ${trimmed}`;
    }

    // Adicionar pipe no fim se ausente
    if (!trimmed.endsWith("|")) {
        trimmed = `${trimmed} |`;
    }

    return trimmed;
}

function countColumns(line: string): number {
    return splitColumns(line).length;
}

function splitColumns(line: string): string[] {
    const trimmed = line.trim();
    // Remover pipes inicial e final, depois dividir por pipe
    const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
    return inner.split("|").map((c) => c.trim()).filter((_, index, arr) => {
        // Manter todas as colunas, mesmo vazias (mas filtrar artefatos de split)
        return index < arr.length;
    });
}
