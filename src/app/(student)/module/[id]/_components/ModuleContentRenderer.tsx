"use client";

import { parseModuleContent, ModuleSection, ModuleTable } from "@/types/module-content";

// ─── Mapeamento de Emojis por Seção ─────────────────────────────────────────

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

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
    return (
        <div className="mt-14 mb-6">
            <div className="flex items-center gap-3 pb-4 border-b-2 border-blue-100">
                <h2 className="text-2xl md:text-3xl font-extrabold text-blue-900 tracking-tight leading-tight">
                    {title}
                </h2>
            </div>
        </div>
    );
}

function SectionParagraphs({ paragraphs }: { paragraphs: string[] }) {
    return (
        <div className="space-y-4">
            {paragraphs.map((p, i) => (
                <p key={i} className="text-[17px] text-gray-700 leading-[1.85] font-normal">
                    {p}
                </p>
            ))}
        </div>
    );
}

function SectionItems({ items }: { items: string[] }) {
    return (
        <ul className="mt-5 space-y-2 bg-blue-50/60 rounded-2xl p-6">
            {items.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[16px] text-gray-700">
                    <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
}

function SectionTable({ table }: { table: ModuleTable }) {
    return (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="min-w-full border-collapse">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                        {table.headers.map((h, i) => (
                            <th
                                key={i}
                                className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {table.rows.map((row, ri) => (
                        <tr key={ri} className={ri % 2 === 1 ? "bg-gray-50/70" : "bg-white"}>
                            {row.map((cell, ci) => (
                                <td
                                    key={ci}
                                    className="px-6 py-4 text-sm text-gray-600 border-b border-gray-100"
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SectionDivider() {
    return (
        <div className="mt-12 h-px bg-gradient-to-r from-blue-100 via-gray-200 to-transparent" />
    );
}

function StructuredRenderer({ sections }: { sections: ModuleSection[] }) {
    return (
        <div className="space-y-2">
            {sections.map((section, index) => (
                <section key={index}>
                    <SectionHeader title={section.title} />
                    <SectionParagraphs paragraphs={section.paragraphs} />
                    {section.items && section.items.length > 0 && (
                        <SectionItems items={section.items} />
                    )}
                    {section.table && (
                        <SectionTable table={section.table} />
                    )}
                    {index < sections.length - 1 && <SectionDivider />}
                </section>
            ))}
        </div>
    );
}

function LegacyTextRenderer({ content }: { content: string }) {
    // Conteúdo legado (Markdown puro ou texto simples) — exibe em bloco limpo
    return (
        <div className="text-[17px] text-gray-700 leading-[1.85] whitespace-pre-wrap font-sans">
            {content}
        </div>
    );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface ModuleContentRendererProps {
    /** String raw do banco: JSON estruturado ou texto legado */
    content: string;
}

export function ModuleContentRenderer({ content }: ModuleContentRendererProps) {
    const structured = parseModuleContent(content);

    if (structured) {
        return <StructuredRenderer sections={structured.sections} />;
    }

    // Fallback para conteúdo legado
    return <LegacyTextRenderer content={content} />;
}
