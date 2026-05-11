import DOMPurify from "isomorphic-dompurify";

interface ModuleArticleBodyProps {
    htmlContent: string;
    description: string;
    title: string;
}

export function ModuleArticleBody({ htmlContent, description, title }: ModuleArticleBodyProps) {
    // Sanitização de segurança contra XSS
    const sanitizedHtml = DOMPurify.sanitize(htmlContent);

    return (
        <div className="p-8 md:p-10 lg:p-15">
            <div className="max-w-none w-full">
                <div className="w-full">
                    {/* Resumo/Lead do Artigo */}
                    <div className="text-lg md:text-xl text-gray-700 font-medium mb-12 leading-[1.7] border-l-8 border-blue-600 pl-10 italic max-w-6xl">
                        {description || "Este estudo sistematiza os principais pontos técnicos sobre o tema, oferecendo uma base sólida para a compreensão das novas infraestruturas digitais de alta escala."}
                    </div>

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
}
