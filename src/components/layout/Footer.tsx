import Link from "next/link";
import { Github, Linkedin, BookOpen } from "lucide-react";

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-white border-t">
            <div className="container mx-auto px-4 py-3">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1 rounded-md">
                            <BookOpen className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-sm font-bold tracking-tight text-gray-900">
                            Lumina<span className="text-blue-600">LMS</span>
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                            &copy; {currentYear} Gabriel Aires
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                            Feito com <span className="text-blue-500">&hearts;</span> para a comunidade educacional
                        </p>
                        <Link
                            href="https://github.com/Gabrielz11/networking-quiz-platform"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            <Github className="w-4 h-4" />
                            <span className="sr-only">GitHub</span>
                        </Link>
                        <Link
                            href="https://www.linkedin.com/in/gabrielvazaires/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                            <Linkedin className="w-4 h-4" />
                            <span className="sr-only">LinkedIn</span>
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
