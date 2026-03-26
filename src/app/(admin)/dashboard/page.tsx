"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookMarked, Layers } from "lucide-react";

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
        <div className="container mx-auto py-12 px-4 max-w-5xl">
            <header className="mb-10 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Painel do Professor</h1>
                    <p className="text-gray-500 mt-2">Bem-vindo, {session?.user?.name || "Professor"}. Gerencie seus módulos de ensino e base de questões.</p>
                </div>
            </header>

            <div className="max-w-md mx-auto sm:mx-0">
                <Card className="hover:shadow-lg transition-shadow duration-300 border-t-4 border-t-blue-500">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                        <div className="bg-blue-100 p-3 rounded-xl">
                            <Layers className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Módulos</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-4">
                        <p className="text-gray-600 leading-relaxed">
                            Crie, edite e organize os conteúdos que seus alunos irão estudar. A IA poderá gerar questões automaticamente!
                        </p>
                        <Link href="/dashboard/modules" className="block w-full">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-md outline-none">
                                <BookMarked className="w-4 h-4 mr-2" />
                                Gerenciar Módulos
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
