"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { User, GraduationCap } from "lucide-react";

export default function AuthPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
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
                // O redirecionamento será tratado pelo middleware baseado no role da session
                router.refresh();
                router.push("/");
            }
        } catch (err: any) {
            setErrorMSG(err.message || "Erro inesperado ao realizar login.");
        }
        setLoading(false);
    };

    const handleSignUp = async () => {
        if (!email || !password) {
            setErrorMSG("Preencha email e senha para cadastrar.");
            return;
        }
        setLoading(true);
        setErrorMSG("");

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, role }),
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
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-t-blue-600">
                <form onSubmit={handleLogin}>
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center font-bold">Lumina LMS</CardTitle>
                        <p className="text-center text-sm text-gray-500">Acesse sua conta ou crie uma nova</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {errorMSG && (
                            <div className="p-3 rounded-md bg-red-50 text-red-600 border border-red-100 text-sm font-medium text-center">
                                {errorMSG}
                            </div>
                        )}
                        
                        <div className="space-y-2">
                            <Label htmlFor="email text-gray-700">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="exemplo@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-11"
                                required
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="password text-gray-700">Senha</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-11"
                                required
                            />
                        </div>

                        <div className="space-y-3 pt-2">
                            <Label className="text-gray-700">Eu sou um:</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setRole("STUDENT")}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                        role === "STUDENT" 
                                        ? "border-blue-600 bg-blue-50 text-blue-700" 
                                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                                    }`}
                                >
                                    <GraduationCap className="w-5 h-5" />
                                    <span className="font-semibold text-sm">Aluno</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole("TEACHER")}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                        role === "TEACHER" 
                                        ? "border-blue-600 bg-blue-50 text-blue-700" 
                                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                                    }`}
                                >
                                    <User className="w-5 h-5" />
                                    <span className="font-semibold text-sm">Professor</span>
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 text-center uppercase tracking-wider">A escolha do papel só afeta novos cadastros</p>
                        </div>
                    </CardContent>
                    
                    <CardFooter className="flex flex-col gap-3 py-6 pt-2">
                        <Button type="submit" disabled={loading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-bold text-base shadow-md">
                            {loading ? "Processando..." : "Entrar na Conta"}
                        </Button>
                        <div className="relative w-full text-center my-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
                            <span className="relative bg-white px-2 text-[10px] text-gray-400 uppercase tracking-widest">ou</span>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                            onClick={handleSignUp}
                            className="w-full h-11 border-blue-100 text-blue-700 hover:bg-blue-50 font-semibold"
                        >
                            Cadastrar como {role === "TEACHER" ? "Professor" : "Aluno"}
                        </Button>
                        <Button variant="link" className="w-full text-xs text-gray-400 mt-2" onClick={() => router.push("/")} type="button">
                            Voltar ao Início
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
