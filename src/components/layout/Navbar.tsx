"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "next-auth/react";

export function Navbar() {
    const pathname = usePathname();
    const { data: session } = useSession();

    const role = (session?.user as any)?.role;
    const dashboardLink = role === "TEACHER" ? "/dashboard" : "/student";

    const handleLogout = async () => {
        await signOut({ callbackUrl: "/" });
    };

    return (
        <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href={session ? dashboardLink : "/"} className="flex items-center gap-2 transition-transform hover:scale-105">
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
                            {pathname !== dashboardLink && !pathname.startsWith("/dashboard") && (
                                <Link href={dashboardLink}>
                                    <Button variant="ghost" className="hidden sm:flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
                                        <LayoutDashboard className="w-4 h-4" />
                                        Painel
                                    </Button>
                                </Link>
                            )}
                            <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all">
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">Sair</span>
                                <span className="sm:hidden">Sair</span>
                            </Button>
                        </>
                    ) : (
                        <>
                            {pathname !== "/auth" && (
                                <Link href="/auth">
                                    <Button className="font-semibold bg-blue-600 hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg rounded-full px-6">
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
