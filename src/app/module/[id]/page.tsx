import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { marked } from "marked";
import { Button } from "@/components/ui/button";

export const revalidate = 0; // Disable cache for SSR

export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const { data: moduleData, error } = await supabase
        .from("modules")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !moduleData) {
        return (
            <div className="container mx-auto py-8 text-center text-red-500">
                Módulo não encontrado.
            </div>
        );
    }

    const htmlContent = marked(moduleData.content || "Sem conteúdo.");

    return (
        <div className="container mx-auto py-8 px-4 max-w-3xl">
            <Link href="/" className="text-blue-600 hover:underline mb-6 inline-block">
                &larr; Voltar para Módulos
            </Link>

            <div className="bg-white rounded-xl shadow-sm p-8 border">
                <h1 className="text-3xl font-bold mb-4">{moduleData.title}</h1>
                {moduleData.description && (
                    <p className="text-gray-600 mb-8 border-b pb-4">{moduleData.description}</p>
                )}

                <article
                    className="prose prose-blue max-w-none"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                />

                <div className="mt-12 flex justify-end">
                    <Link href={`/quiz/${moduleData.id}`}>
                        <Button size="lg" className="px-8 text-lg font-semibold bg-blue-600 hover:bg-blue-700">
                            Iniciar Quiz
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
