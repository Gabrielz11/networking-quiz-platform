import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { renderModuleMarkdown } from "@/lib/markdown";
import DOMPurify from "isomorphic-dompurify";
import { X } from "lucide-react";

interface ModulePreviewDialogProps {
    title: string;
    description: string;
    content: string;
    children: React.ReactNode;
}

export function ModulePreviewDialog({
    title,
    description,
    content,
    children,
}: ModulePreviewDialogProps) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    const htmlContent = renderModuleMarkdown(content || "");
    const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
        ALLOWED_ATTR: ["style", "class", "href", "src", "alt", "target", "rel", "colspan", "rowspan"],
        ALLOWED_TAGS: [
            "h1", "h2", "h3", "h4", "h5", "h6",
            "p", "strong", "em", "b", "i", "u", "s",
            "ul", "ol", "li",
            "table", "thead", "tbody", "tr", "th", "td",
            "blockquote", "code", "pre",
            "hr", "br", "div", "span",
            "a",
        ],
    });

    const previewContent = (
        <div className="fixed inset-0 z-[9999] bg-white overflow-y-auto animate-in fade-in duration-200">
            {/* Topo Independente */}
            <div className="h-20 bg-white border-b flex items-center justify-between px-8 sticky top-0 z-[10000]">
                <div className="flex items-center gap-4">
                    <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded">PREVIEW</span>
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-widest italic">Visualização do Aluno</span>
                </div>
                <button 
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 px-5 py-2 rounded-xl transition-all font-bold"
                >
                    <X className="w-5 h-5" />
                    <span>Sair do Preview</span>
                </button>
            </div>

            <div className="min-h-screen bg-white pb-32">
                {/* HERO SECTION INDEPENDENTE */}
                <div className="bg-gray-50/50 border-b p-8 md:p-12 lg:p-16">
                    <div className="max-w-5xl mx-auto">
                        <nav className="flex text-[12px] uppercase font-black tracking-[0.2em] text-gray-400 mb-6 gap-2">
                            <span>Portal do Aluno</span>
                            <span>/</span>
                            <span className="text-blue-600">Visualização Real</span>
                        </nav>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#003366] leading-[1.1] mb-8 tracking-tighter">
                            {title}
                        </h1>
                        <div className="border-l-4 border-blue-600 pl-6 italic text-xl text-gray-600 max-w-4xl">
                            {description || "Conteúdo didático estruturado."}
                        </div>
                    </div>
                </div>

                {/* CONTEÚDO INDEPENDENTE */}
                <div className="max-w-5xl mx-auto px-8 md:px-12 py-20">
                    <div className="article-body">
                        <article
                            className="prose prose-slate max-w-none 
                                prose-p:text-[18px] prose-p:text-gray-800 prose-p:leading-[1.8] prose-p:text-justify 
                                prose-headings:text-[#004a80] prose-headings:font-black prose-headings:mb-8
                                prose-h2:text-3xl prose-h2:mt-16 prose-h2:pb-6 prose-h2:border-b-2
                                prose-ul:bg-blue-50/40 prose-ul:p-10 prose-ul:rounded-[2rem] prose-ul:my-10
                                prose-li:text-gray-800 prose-li:mb-4
                                prose-strong:text-black font-serif"
                            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <div onClick={() => setIsOpen(true)} className="flex-1 cursor-pointer">
                {children}
            </div>
            {isOpen && typeof document !== "undefined" && createPortal(previewContent, document.body)}
        </>
    );
}
