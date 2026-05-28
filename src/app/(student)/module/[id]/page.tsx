import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { renderModuleMarkdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { ModuleHero } from "./_components/ModuleHero";
import { ModuleArticleBody } from "./_components/ModuleArticleBody";
import { ModuleArticleFooter } from "./_components/ModuleArticleFooter";
import { auth } from "@/auth";
import { ActivityService } from "@/services/activity.service";
import { ChevronLeft } from "lucide-react";
import { ScrollToTopButton } from "./_components/ScrollToTopButton";

export const revalidate = 0;

export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [session, moduleData] = await Promise.all([
        auth(),
        prisma.module.findUnique({
            where: { id },
            include: { author: true },
        }),
    ]);

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

    const htmlContent = renderModuleMarkdown(moduleData.content || "");

    // Registra o acesso ao módulo — não-bloqueante
    if (session?.user?.id) {
        ActivityService.logModuleAccess(session.user.id, moduleData.id, moduleData.title);
    }
    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(moduleData.createdAt);

    // URL para compartilhamento no LinkedIn baseada no título do módulo
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const shareUrl = `${appUrl}/module/${moduleData.id}`;
    const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

    return (
        <div className="min-h-screen bg-[#f3f6f9] pb-20">
            <main className="container mx-auto mt-10 px-4 lg:px-20 max-w-[1280px] pb-24 flex gap-6 items-start">
                {/* Botão de voltar flutuante e sticky lateral (Estilo Stripe Docs) */}
                <div className="hidden lg:block sticky top-28 h-fit shrink-0 -ml-16 mr-6 z-20">
                    <Link href="/student">
                        <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 hover:bg-gray-50 text-gray-400 hover:text-blue-600 active:scale-95 transition-all group">
                            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                        </Button>
                    </Link>
                </div>

                <div className="flex-1 bg-white shadow-xl shadow-gray-200/50 border border-gray-100 rounded-3xl overflow-hidden min-h-[90vh]">
                    <ModuleHero
                        title={moduleData.title}
                        formattedDate={formattedDate}
                        authorName={moduleData.author?.name || "Corpo Acadêmico"}
                        linkedinShareUrl={linkedinShareUrl}
                        moduleId={moduleData.id}
                    />

                    <ModuleArticleBody
                        htmlContent={htmlContent}
                        description={moduleData.description || ""}
                        title={moduleData.title}
                    />

                    <div className="px-8 md:px-16 lg:px-24 pb-16">
                        <ModuleArticleFooter moduleId={moduleData.id} />
                    </div>
                </div>

                <ScrollToTopButton />
            </main>
        </div>
    );
}
