"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function Navbar() {
    const pathname = usePathname();
    const [session, setSession] = useState<unknown>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
    };

    return (
        <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-gray-900">
                        Lumina<span className="text-blue-600">LMS</span>
                    </span>
                </Link>

                <div className="flex items-center gap-4">
                    {session ? (
                        <>
                            {pathname !== "/dashboard" && pathname !== "/dashboard/modules" && pathname !== "/dashboard/questions" && (
                                <Link href="/dashboard">
                                    <Button variant="ghost" className="hidden sm:flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Dashboard
                                    </Button>
                                </Link>
                            )}
                            <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
                                <LogOut className="w-4 h-4" />
                                Sair
                            </Button>
                        </>
                    ) : (
                        <>
                            {pathname !== "/auth" && (
                                <Link href="/auth">
                                    <Button className="font-semibold bg-blue-600 hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg">
                                        Entrar
                                    </Button>
                                </Link>
                            )}
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
