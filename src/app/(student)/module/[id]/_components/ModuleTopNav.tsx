import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";

interface ModuleTopNavProps {
    backHref: string;
}

export function ModuleTopNav({ backHref }: ModuleTopNavProps) {
    return (
        <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
            <div className="container mx-auto px-6 md:px-12 max-w-[1440px] h-20 flex items-center justify-between">
                <Link href={backHref} className="flex items-center text-gray-600 hover:text-blue-700 font-bold transition-colors">
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    <span className="hidden sm:inline">Portal do Aluno</span>
                    <span className="sm:hidden text-xs">Voltar</span>
                </Link>
                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50 font-black">LUMINA LMS</Badge>
                </div>
            </div>
        </div>
    );
}
