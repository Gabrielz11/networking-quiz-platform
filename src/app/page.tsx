import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const revalidate = 0; // Disable cache for dev

export default async function Home() {
  const { data: modules, error } = await supabase.from("modules").select("*").order("created_at", { ascending: true });

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">IPv6 Pedagogy Academy</h1>
          <p className="text-gray-600 mt-2">Aprenda protocolo IPv6 sem ruído cognitivo.</p>
        </div>
        <div className="space-x-4">
          <Link href="/auth">
            <Button variant="outline">Entrar</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Área do Professor</Button>
          </Link>
        </div>
      </header>

      <main>
        <h2 className="text-2xl font-semibold mb-6">Módulos de Estudo</h2>
        {error && <p className="text-red-500 mb-4">Erro ao carregar módulos: {error.message}</p>}
        {(!modules || modules.length === 0) && !error && (
          <p className="text-gray-500 bg-gray-100 p-8 rounded-lg text-center">
            Nenhum módulo cadastrado ainda. Professores podem criar novos módulos no Dashboard.
          </p>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          {modules?.map((mod) => (
            <Card key={mod.id}>
              <CardHeader>
                <CardTitle>{mod.title}</CardTitle>
                <CardDescription>{mod.description}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href={`/module/${mod.id}`} className="w-full">
                  <Button className="w-full">Estudar Módulo</Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
