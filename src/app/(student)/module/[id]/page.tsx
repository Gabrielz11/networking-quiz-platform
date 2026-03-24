import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { marked } from "marked";
import { Button } from "@/components/ui/button";
import { ModuleTopNav } from "./_components/ModuleTopNav";
import { ModuleHero } from "./_components/ModuleHero";
import { ModuleArticleBody } from "./_components/ModuleArticleBody";
import { ModuleArticleFooter } from "./_components/ModuleArticleFooter";

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

    const htmlContent = marked(moduleData.content || "") as string;
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
            <ModuleTopNav backHref="/student" />

            <main className="container mx-auto mt-10 px-4 md:px-10 max-w-[1440px] pb-24">
                <div className="bg-white shadow-xl shadow-gray-200/50 border border-gray-100 rounded-3xl overflow-hidden min-h-[90vh]">
                    <ModuleHero
                        title={moduleData.title}
                        formattedDate={formattedDate}
                        authorName={moduleData.author?.name || "Corpo Acadêmico"}
                        linkedinShareUrl={linkedinShareUrl}
                    />

                    <ModuleArticleBody
                        htmlContent={htmlContent}
                        description={moduleData.description || ""}
                        imageUrl={moduleData.imageUrl || ""}
                        title={moduleData.title}
                    />

                    <div className="px-8 md:px-16 lg:px-24 pb-16">
                        <ModuleArticleFooter moduleId={moduleData.id} />
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
