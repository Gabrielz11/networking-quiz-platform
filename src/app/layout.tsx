import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lumina LMS | AI-Powered Learning",
  description: "Plataforma interativa com correção pedagógica via IA local",
};

import { AuthProvider } from "@/components/providers/SessionProvider";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className={`${inter.className} h-screen bg-gray-50/50 flex flex-col overflow-hidden antialiased`}>
        <AuthProvider>
          <Navbar />
          <main className="flex-1 flex flex-col overflow-y-auto">
            {children}
          </main>
          <Footer />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
