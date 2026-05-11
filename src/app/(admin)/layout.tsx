import { auth } from "@/auth";
import { redirect } from "next/navigation";

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

  return <>{children}</>;
}
