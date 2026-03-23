"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
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

        try {
            const res = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (res?.error) {
                setErrorMSG("Email ou senha inválidos.");
            } else {
                router.push("/dashboard");
            }
        } catch (err: any) {
            setErrorMSG(err.message || "Erro inesperado ao realizar login.");
        }
        setLoading(false);
    };

    const handleSignUp = async () => {
        setLoading(true);
        setErrorMSG("");

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorMSG(data.error || "Erro ao realizar cadastro.");
            } else {
                alert("Cadastro realizado com sucesso! Agora você pode entrar.");
            }
        } catch (err: any) {
            setErrorMSG("Falha na conexão com o servidor ao cadastrar.");
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
                        {errorMSG && <p className="text-red-500 font-medium text-sm text-center">{errorMSG}</p>}
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
                        <Button variant="link" className="w-full mt-4" onClick={() => router.push("/")} type="button">
                            Voltar ao Início
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
