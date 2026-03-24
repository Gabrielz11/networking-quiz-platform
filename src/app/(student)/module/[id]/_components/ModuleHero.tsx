import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Linkedin as LinkedinIcon, Calendar, Printer } from "lucide-react";

interface ModuleHeroProps {
    title: string;
    formattedDate: string;
    authorName: string;
    linkedinShareUrl: string;
}

export function ModuleHero({ title, formattedDate, authorName, linkedinShareUrl }: ModuleHeroProps) {
    return (
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
                {title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-8 border-y-2 py-8 border-gray-100/50">
                <div className="flex items-center gap-6 text-xs text-gray-500 font-medium">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span>Publicado em {formattedDate}</span>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span>Professor: {authorName}</span>
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
    );
}
