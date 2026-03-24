import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { marked } from "marked";
import { Button } from "@/components/ui/button";
import {
    ChevronLeft,
    Share2,
    Facebook,
    Twitter,
    Linkedin as LinkedinIcon,
    Calendar,
    ArrowRight,
    Printer,
    Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0;

export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const moduleData = await prisma.module.findUnique({
        where: { id },
        include: {
            author: true, // Inclui o autor do módulo
        }
    });

    if (!moduleData) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center p-8 bg-white rounded-2xl shadow-sm border">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Módulo não encontrado</h2>
                    <Link href="/student">
                        <Button>Voltar para a Lista</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const htmlContent = marked(moduleData.content || "");
    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(moduleData.createdAt);

    // URL para compartilhamento no LinkedIn baseada no título do módulo
    const shareUrl = `https://lumina-lms.vercel.app/module/${moduleData.id}`; // URL base do projeto (ajuste se necessário)
    const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

    return (
        <div className="min-h-screen bg-[#f3f6f9] pb-20">
            {/* Top Navigation Bar (Institucional) */}
            <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
                <div className="container mx-auto px-6 md:px-12 max-w-[1440px] h-20 flex items-center justify-between">
                    <Link href="/student" className="flex items-center text-gray-600 hover:text-blue-700 font-bold transition-colors">
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        <span className="hidden sm:inline">Portal do Aluno</span>
                        <span className="sm:hidden text-xs">Voltar</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50 font-black">LUMINA LMS</Badge>
                    </div>
                </div>
            </div>

            <main className="container mx-auto mt-10 px-4 md:px-10 max-w-[1440px] pb-24">
                <div className="bg-white shadow-xl shadow-gray-200/50 border border-gray-100 rounded-3xl overflow-hidden min-h-[90vh]">

                    <div className="p-8 md:p-16 lg:p-24 border-b bg-gray-50/30">
                        {/* Breadcrumb sutil */}
                        <nav className="flex text-[12px] uppercase font-black tracking-[0.2em] text-gray-400 mb-8 gap-2 items-center">
                            <Link href="/student" className="hover:text-blue-700">Portal do Aluno</Link>
                            <span className="text-gray-300">/</span>
                            <span>Módulos Ativos</span>
                            <span className="text-gray-300">/</span>
                            <span className="text-blue-600">Panorama Técnico</span>
                        </nav>

                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-[#003366] leading-[1.1] mb-10 tracking-tighter">
                            {moduleData.title}
                        </h1>

                        <div className="flex flex-wrap items-center justify-between gap-8 border-y-2 py-8 border-gray-100/50">
                            <div className="flex items-center gap-6 text-xs text-gray-500 font-medium">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                    <span>Publicado em {formattedDate}</span>
                                </div>
                                <div className="hidden md:flex items-center gap-2">
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <span>Professor: {moduleData.author?.name || "Corpo Acadêmico"}</span>
                                </div>
                            </div>
                            
                            {/* Social Share (LinkedIn Focado no Aluno) */}
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Compartilhe seu estudo:</span>
                                <a 
                                    href={linkedinShareUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-[#0077b5] hover:bg-[#005a8a] text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-md active:scale-95"
                                >
                                    <LinkedinIcon className="w-4 h-4" />
                                    LinkedIn
                                </a>
                                <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-gray-400 hover:bg-gray-50 border">
                                    <Printer className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 md:p-16 lg:p-24">
                        <div className="max-w-none w-full">
                            {/* Conteúdo Principal */}
                            <div className="w-full">

                                {/* Resumo/Lead do Artigo */}
                                <div className="text-xl md:text-2xl text-gray-700 font-medium mb-16 leading-[1.8] border-l-8 border-blue-600 pl-10 italic max-w-6xl">
                                    {moduleData.description || "Este estudo sistematiza os principais pontos técnicos sobre o tema, oferecendo uma base sólida para a compreensão das novas infraestruturas digitais de alta escala."}
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
                                            src={moduleData.imageUrl || "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1600&auto=format&fit=crop"} 
                                            alt={moduleData.title}
                                            className="w-full h-auto object-cover max-h-[700px]"
                                        />
                                    </div>
                                    <figcaption className="text-xs text-gray-400 mt-8 flex justify-between items-center px-6 font-black tracking-[0.3em] uppercase">
                                        <span>Ilustração Técnica: {moduleData.title}</span>
                                        <span className="text-blue-700">Lumina LMS Framework</span>
                                    </figcaption>
                                </figure>

                                {/* Rodapé do Artigo */}
                                <div className="mt-24 pt-12 border-t border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-gray-400 text-sm font-medium">
                                        <Share2 className="w-5 h-5" />
                                        <span>Conteúdo livre para fins educacionais. Licença Digital Anatel/Inatel.</span>
                                    </div>
                                    <Link href={`/quiz/${moduleData.id}`}>
                                        <Button className="bg-[#003366] hover:bg-[#004a80] text-white font-black h-20 px-16 rounded-md shadow-2xl flex gap-4 text-xl group transition-all">
                                            INICIAR QUIZ DE AVALIAÇÃO
                                            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Injeção de CSS para o estilo "Gov.br" */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .article-body article {
                    font-family: "Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
                }
                .article-body article p {
                    text-indent: 0;
                    margin-bottom: 24px;
                }
                .article-body article h2 {
                    letter-spacing: -0.02em;
                }
                /* Ajuste de justificação via browser */
                .article-body article p {
                    text-align: justify;
                    text-justify: inter-word;
                }
            ` }} />
        </div>
    );
}
