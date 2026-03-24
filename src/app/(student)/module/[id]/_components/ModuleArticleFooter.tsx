import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Share2, ArrowRight } from "lucide-react";

interface ModuleArticleFooterProps {
    moduleId: string;
}

export function ModuleArticleFooter({ moduleId }: ModuleArticleFooterProps) {
    return (
        <div className="mt-24 pt-12 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3 text-gray-400 text-sm font-medium">
                <Share2 className="w-5 h-5" />
                <span>Conteúdo livre para fins educacionais. Licença Digital Anatel/Inatel.</span>
            </div>
            <Link href={`/quiz/${moduleId}`}>
                <Button className="bg-[#003366] hover:bg-[#004a80] text-white font-black h-20 px-16 rounded-md shadow-2xl flex gap-4 text-xl group transition-all">
                    INICIAR QUIZ DE AVALIAÇÃO
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </Button>
            </Link>
        </div>
    );
}
