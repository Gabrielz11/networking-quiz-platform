import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth");
  }

  if ((session.user as any).role !== "TEACHER") {
    redirect("/student");
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <AdminSidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
        {children}
      </main>
    </div>
  );
}
