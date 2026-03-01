"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function AuthPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMSG, setErrorMSG] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMSG("");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMSG(error.message);
        } else {
            router.push("/dashboard");
        }
        setLoading(false);
    };

    const handleSignUp = async () => {
        setLoading(true);
        setErrorMSG("");

        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            setErrorMSG(error.message);
        } else {
            alert("Verifique seu email para confirmar o cadastro.");
        }
        setLoading(false);
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <form onSubmit={handleLogin}>
                    <CardHeader>
                        <CardTitle className="text-2xl text-center">Login | Cadastro</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {errorMSG && <p className="text-red-500 font-medium text-sm">{errorMSG}</p>}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? "Entrando..." : "Entrar"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                            onClick={handleSignUp}
                            className="w-full"
                        >
                            Criar Conta
                        </Button>
                        <Button variant="link" className="w-full mt-4" onClick={() => router.push("/")}>
                            Voltar ao Início
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
