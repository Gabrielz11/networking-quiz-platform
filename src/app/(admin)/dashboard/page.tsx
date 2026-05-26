"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookMarked, Layers, Award } from "lucide-react";

export default function Dashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();

    if (status === "loading") return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
    );

    if (status === "unauthenticated") {
        router.push("/auth");
        return null;
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto py-12 px-4 max-w-5xl">
                <header className="mb-10 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Painel do Professor</h1>
                        <p className="text-gray-500 mt-2">Bem-vindo, {session?.user?.name || "Professor"}. Gerencie seus módulos de ensino e base de questões.</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Link href="/dashboard/modules" className="block group">
                        <Card className="hover:shadow-xl hover:border-blue-200 transition-all duration-300 border-t-4 border-t-blue-500 flex flex-col justify-between h-full bg-white">
                            <div>
                                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                    <div className="bg-blue-100 p-3 rounded-xl group-hover:bg-blue-200 transition-colors">
                                        <Layers className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">Módulos</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <p className="text-gray-600 leading-relaxed">
                                        Crie, edite e organize os conteúdos que seus alunos irão estudar. A IA poderá gerar questões de quiz automaticamente a partir deles!
                                    </p>
                                </CardContent>
                            </div>
                            <CardContent className="pt-0">
                                <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-md pointer-events-none">
                                    <BookMarked className="w-4 h-4 mr-2" />
                                    Gerenciar Módulos
                                </Button>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/dashboard/scores" className="block group">
                        <Card className="hover:shadow-xl hover:border-indigo-200 transition-all duration-300 border-t-4 border-t-indigo-500 flex flex-col justify-between h-full bg-white">
                            <div>
                                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                    <div className="bg-indigo-100 p-3 rounded-xl group-hover:bg-indigo-200 transition-colors">
                                        <Award className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl group-hover:text-indigo-600 transition-colors">Notas & Desempenho</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <p className="text-gray-600 leading-relaxed">
                                        Acompanhe em tempo real as notas, tentativas, evolução de aprendizado e logs de atividade de cada estudante nos módulos.
                                    </p>
                                </CardContent>
                            </div>
                            <CardContent className="pt-0">
                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-md pointer-events-none">
                                    <Award className="w-4 h-4 mr-2" />
                                    Visualizar Desempenho
                                </Button>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </div>
        </div>
    );
}
