import { marked, Renderer } from "marked";

/**
 * Mapeamento de emojis por nome de seção.
 * A IA gera os títulos sem emojis; o renderizador os injeta aqui.
 */
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

    // H1 → Seção principal premium com emoji mapeado pelo renderizador
    renderer.heading = ({ text, depth }) => {
        if (depth === 1) {
            // Remove notas entre parênteses que a IA possa incluir ex: "Comparação (omita se...)"
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

    // Tabelas → Design moderno com bordas e cabeçalho destacado
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
                    ">${cell.text}</th>`
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
                            ">${cell.text}</td>`
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

    // Parágrafo → Espaçamento confortável
    renderer.paragraph = ({ text }) => {
        return `<p style="margin-bottom: 1.25rem; line-height: 1.8; color: #374151;">${text}</p>`;
    };

    // Negrito e itálico NÃO são sobrescritos pelo renderer —
    // o marked v17 lida com isso no pipeline de inline tokens.
    // O pós-processamento abaixo injeta os estilos diretamente no HTML final.

    return renderer;
}

/**
 * Pós-processamento: injeta estilos inline nas tags de formatação.
 * Usamos regexes flexíveis para capturar variações (strong, b, em, i)
 * e garantir que o estilo seja aplicado mesmo se houver atributos extras.
 */
function postProcess(html: string): string {
    return html
        // Negrito: Transforma <strong> ou <b> em nosso estilo premium
        .replace(/<(strong|b)\b([^>]*)>/gi, '<strong style="font-weight: 700; color: #111827;" $2>')
        .replace(/<\/(strong|b)>/gi, '</strong>')

        // Itálico: Transforma <em> ou <i>
        .replace(/<(em|i)\b([^>]*)>/gi, '<em style="font-style: italic; color: #374151;" $2>')
        .replace(/<\/(em|i)>/gi, '</em>')

        // Garante que links tenham cor de destaque
        .replace(/<a\b([^>]*)>/gi, '<a style="color: #2563eb; text-decoration: underline;" $1>');
}

/**
 * Converte Markdown gerado pela IA em HTML estilizado para exibição no módulo.
 * Use esta função no lugar do `marked()` direto.
 */
export function renderModuleMarkdown(markdown: string): string {
    const renderer = createModuleRenderer();

    // Configurações extras para o marked v17 garantir parsing robusto
    const rawHtml = marked.parse(markdown, {
        renderer,
        gfm: true,
        breaks: true
    }) as string;

    return postProcess(rawHtml);
}


