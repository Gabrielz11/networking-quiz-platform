"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookMarked, HelpCircle, Layers } from "lucide-react";

export default function Dashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<unknown>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session) {
                router.push("/auth");
            }
            setLoading(false);
        });
    }, [router]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
    );
    if (!session) return null;

    return (
        <div className="container mx-auto py-12 px-4 max-w-5xl">
            <header className="mb-10 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Painel do Professor</h1>
                    <p className="text-gray-500 mt-2">Gerencie seus módulos de ensino e base de questões para Inteligência Artificial.</p>
                </div>
            </header>

            <div className="grid gap-6 md:grid-cols-2">
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
                            Crie, edite e organize os conteúdos textuais em Markdown que seus alunos irão estudar. A IA irá gerar questões automaticamente!
                        </p>
                        <Link href="/dashboard/modules" className="block w-full">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-md">
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
