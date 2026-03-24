interface ModuleArticleBodyProps {
    htmlContent: string;
    description: string;
    imageUrl: string;
    title: string;
}

export function ModuleArticleBody({ htmlContent, description, imageUrl, title }: ModuleArticleBodyProps) {
    return (
        <div className="p-8 md:p-16 lg:p-24">
            <div className="max-w-none w-full">
                <div className="w-full">
                    {/* Resumo/Lead do Artigo */}
                    <div className="text-xl md:text-2xl text-gray-700 font-medium mb-16 leading-[1.8] border-l-8 border-blue-600 pl-10 italic max-w-6xl">
                        {description || "Este estudo sistematiza os principais pontos técnicos sobre o tema, oferecendo uma base sólida para a compreensão das novas infraestruturas digitais de alta escala."}
                    </div>

                    <div className="article-body">
                        <article
                            className="prose prose-slate max-w-none 
                                prose-p:text-[20px] prose-p:text-gray-800 prose-p:leading-[2.2] prose-p:text-justify 
                                prose-headings:text-[#004a80] prose-headings:font-black prose-headings:mb-10
                                prose-h2:text-4xl prose-h2:mt-24 prose-h2:pb-8 prose-h2:border-b-4
                                prose-ul:bg-blue-50/40 prose-ul:p-14 prose-ul:rounded-[3rem] prose-ul:my-14
                                prose-li:text-gray-800 prose-li:mb-5
                                prose-strong:text-black font-serif"
                            dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />
                    </div>

                    <figure className="my-20 group">
                        <div className="rounded-[3rem] overflow-hidden border-8 border-white shadow-2xl transition-transform hover:scale-[1.01] duration-1000">
                            <img
                                src={imageUrl || "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1600&auto=format&fit=crop"}
                                alt={title}
                                className="w-full h-auto object-cover max-h-[700px]"
                            />
                        </div>
                        <figcaption className="text-xs text-gray-400 mt-8 flex justify-between items-center px-6 font-black tracking-[0.3em] uppercase">
                            <span>Ilustração Técnica: {title}</span>
                            <span className="text-blue-700">Lumina LMS Framework</span>
                        </figcaption>
                    </figure>
                </div>
            </div>
        </div>
    );
}
