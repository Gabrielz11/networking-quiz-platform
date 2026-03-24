import Link from "next/link";
import { Github, Linkedin, BookOpen } from "lucide-react";

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-white border-t mt-auto">
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-md">
                            <BookOpen className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold tracking-tight text-gray-900">
                            Lumina<span className="text-blue-600">LMS</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link
                            href="https://github.com/Gabrielz11/networking-quiz-platform"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            <Github className="w-5 h-5" />
                            <span className="sr-only">GitHub</span>
                        </Link>
                        <Link
                            href="https://www.linkedin.com/in/gabrielvazaires/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                            <Linkedin className="w-5 h-5" />
                            <span className="sr-only">LinkedIn</span>
                        </Link>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500">
                        &copy; {currentYear} Gabriel Aires. Todos os direitos reservados.
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                        Feito com <span className="text-blue-500">&hearts;</span> para a comunidade educacional
                    </p>
                </div>
            </div>
        </footer>
    );
}
