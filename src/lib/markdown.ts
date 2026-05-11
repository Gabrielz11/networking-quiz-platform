import { marked, Renderer, type Tokens } from "marked";

const SECTION_EMOJIS: Record<string, string> = {
    "introdução": "📌",
    "problema, contexto ou motivação": "🔍",
    "conceito principal ou solução": "💡",
    "funcionamento, estrutura ou componentes": "🛠️",
    "exemplos práticos": "🚀",
    "principais características": "📋",
    "aplicações reais": "🌍",
    "comparação": "📊",
    "conclusão": "🏁",
};

function getSectionEmoji(title: string): string {
    const key = title.toLowerCase().trim();
    return SECTION_EMOJIS[key] ?? "📖";
}

function createModuleRenderer(): Renderer {
    const renderer = new Renderer();

    renderer.heading = ({ text, depth }) => {
        if (depth === 1) {
            const cleanTitle = text.replace(/\(.*?\)/g, "").trim();
            const emoji = getSectionEmoji(cleanTitle);

            return `
                <h1 style="
                    font-size: 1.875rem;
                    font-weight: 800;
                    color: #1e3a8a;
                    margin-top: 3.5rem;
                    margin-bottom: 1.25rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 3px solid #dbeafe;
                    line-height: 1.2;
                    letter-spacing: -0.02em;
                ">${emoji} ${cleanTitle}</h1>
            `;
        }

        if (depth === 2) {
            return `
                <h2 style="
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #1e40af;
                    margin-top: 2rem;
                    margin-bottom: 0.75rem;
                ">${text}</h2>
            `;
        }

        return `<h3 style="font-size: 1.1rem; font-weight: 600; color: #374151; margin-top: 1.5rem; margin-bottom: 0.5rem;">${text}</h3>`;
    };

    renderer.table = ({ header, rows }) => {
        const headerCells = header
            .map(
                (cell) =>
                    `<th style="
                        padding: 0.875rem 1.25rem;
                        text-align: left;
                        font-size: 0.75rem;
                        font-weight: 700;
                        color: #6b7280;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        background-color: #f9fafb;
                        border-bottom: 2px solid #e5e7eb;
                    ">${marked.parseInline(cell.text)}</th>`
            )
            .join("");

        const bodyRows = rows
            .map((row, rowIndex) => {
                const cells = row
                    .map(
                        (cell) =>
                            `<td style="
                                padding: 0.875rem 1.25rem;
                                font-size: 0.9rem;
                                color: #374151;
                                border-bottom: 1px solid #f3f4f6;
                                background-color: ${rowIndex % 2 === 1 ? "#f9fafb" : "#ffffff"};
                            ">${marked.parseInline(cell.text)}</td>`
                    )
                    .join("");
                return `<tr>${cells}</tr>`;
            })
            .join("");

        return `
            <div style="overflow-x: auto; margin: 2rem 0; border-radius: 1rem; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                <table style="width: 100%; border-collapse: collapse; font-family: inherit;">
                    <thead><tr>${headerCells}</tr></thead>
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>
        `;
    };

    renderer.paragraph = ({ text }) => {
        return `<p style="margin-bottom: 1.25rem; line-height: 1.8; color: #374151;">${text}</p>`;
    };

    renderer.codespan = ({ text }) => {
        return `<code style="
            font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
            font-size: 0.85em;
            background-color: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
            border-radius: 0.375rem;
            padding: 0.15em 0.45em;
            white-space: nowrap;
        ">${text}</code>`;
    };

    return renderer;
}

function styleHtml(html: string): string {
    return html
        // Estilizar tags <strong> e <b> já geradas pelo marked
        .replace(/<(strong|b)\b([^>]*)>/gi, '<strong style="font-weight: 700; color: #111827;"$2>')
        .replace(/<\/(strong|b)>/gi, "</strong>")
        // Estilizar tags <em> e <i> já geradas pelo marked
        .replace(/<(em|i)\b([^>]*)>/gi, '<em style="font-style: italic; font-weight: 600; color: #1e40af;"$2>')
        .replace(/<\/(em|i)>/gi, "</em>")
        // Fallback: converter **texto** que o marked não processou como <strong>
        .replace(/\*\*([^*\n<>]+?)\*\*/g, '<strong style="font-weight: 700; color: #111827;">$1</strong>')
        // Fallback: converter *texto* que o marked não processou como <em>
        .replace(/(?<!\*)\*(?!\*)([^*\n<>]+?)(?<!\*)\*(?!\*)/g, '<em style="font-style: italic; font-weight: 600; color: #1e40af;">$1</em>')
        // Estilizar links
        .replace(/<a\b([^>]*)>/gi, '<a style="color: #2563eb; text-decoration: underline;"$1>');
}


export function renderModuleMarkdown(markdown: string): string {
    const renderer = createModuleRenderer();

    const rawHtml = marked.parse(markdown, {
        renderer,
        gfm: true,
        breaks: true,
    }) as string;

    return styleHtml(rawHtml);
}