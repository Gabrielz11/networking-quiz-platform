"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

    if (loading) return <div className="p-8">Carregando Dashboard...</div>;
    if (!session) return null;

    return (
        <div className="container mx-auto py-8 px-4 max-w-5xl">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Professor Dashboard</h1>
                <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => router.push("/"))}>
                    Sair
                </Button>
            </header>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Módulos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-gray-600">Gerenciar módulos de estudo de IPv6.</p>
                        <Link href="/dashboard/modules">
                            <Button className="w-full">Gerenciar Módulos</Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Questões</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-gray-600">Cadastrar quizzes e estruturas explicativas (IA).</p>
                        <Link href="/dashboard/questions">
                            <Button className="w-full">Gerenciar Questões</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
