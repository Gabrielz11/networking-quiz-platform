"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  FileText,
  Tag,
  Users,
  Award,
  MousePointer,
  Activity,
  LineChart,
  UserCog,
  User,
  Settings,
  ArrowLeft,
  LogOut,
  FolderOpen,
  BarChart,
  BrainCircuit
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const menuSections = [
    {
      title: "Geral",
      items: [
        {
          name: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
          active: pathname === "/dashboard",
          disabled: false,
        },
      ],
    },
    {
      title: "Conteúdo",
      items: [
        {
          name: "Módulos",
          href: "/dashboard/modules",
          icon: BookOpen,
          active: pathname.startsWith("/dashboard/modules"),
          disabled: false,
        },
        {
          name: "Quizzes",
          href: "#",
          icon: HelpCircle,
          active: false,
          disabled: true,
        },
        {
          name: "Questões",
          href: "#",
          icon: FileText,
          active: false,
          disabled: true,
        },
        {
          name: "Categorias",
          href: "#",
          icon: Tag,
          active: false,
          disabled: true,
        },
      ],
    },
    {
      title: "Alunos",
      items: [
        {
          name: "Alunos",
          href: "#",
          icon: Users,
          active: false,
          disabled: true,
        },
        {
          name: "Turmas",
          href: "#",
          icon: FolderOpen,
          active: false,
          disabled: true,
          badge: "Breve",
        },
        {
          name: "Notas & Desempenho",
          href: "/dashboard/scores",
          icon: Award,
          active: pathname.startsWith("/dashboard/scores"),
          disabled: false,
        },
      ],
    },
    {
      title: "Métricas e Analytics",
      items: [
        {
          name: "Analytics Educacional",
          href: "/dashboard/analytics",
          icon: BarChart,
          active: pathname.startsWith("/dashboard/analytics"),
          disabled: false,
        },
        {
          name: "Métricas da IA",
          href: "/dashboard/ai-metrics",
          icon: BrainCircuit,
          active: pathname.startsWith("/dashboard/ai-metrics"),
          disabled: false,
        },
      ],
    },
    {
      title: "Relatórios",
      items: [
        {
          name: "Acessos",
          href: "#",
          icon: MousePointer,
          active: false,
          disabled: true,
        },
        {
          name: "Atividades",
          href: "#",
          icon: Activity,
          active: false,
          disabled: true,
        },
        {
          name: "Desempenho Geral",
          href: "#",
          icon: LineChart,
          active: false,
          disabled: true,
        },
      ],
    },

    {
      title: "Configurações",
      items: [
        {
          name: "Usuários",
          href: "#",
          icon: UserCog,
          active: false,
          disabled: true,
        },
        {
          name: "Perfil",
          href: "#",
          icon: User,
          active: false,
          disabled: true,
        },
        {
          name: "Configurações",
          href: "#",
          icon: Settings,
          active: false,
          disabled: true,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-100 bg-white flex flex-col h-screen sticky top-0 shrink-0 z-30 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.03)]">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-50 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-xl shadow-md shadow-blue-500/10">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900 leading-none">
              Lumina<span className="text-blue-600">LMS</span>
            </h1>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-1">
              Painel do Professor
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="group w-full justify-start gap-2.5 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl py-2.5 px-3 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-600 transition-colors" />
          Sair do Painel
        </Button>
      </div>

      {/* Navigation Scroll */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7 scrollbar-thin scrollbar-thumb-slate-200">
        {menuSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h3 className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                if (item.disabled) {
                  return (
                    <li key={item.name}>
                      <div
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed select-none transition-colors group/item"
                        title="Esta funcionalidade estará disponível em breve"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-slate-350 transition-transform group-hover/item:scale-105" />
                          <span className="text-sm font-medium">{item.name}</span>
                        </div>
                        <span className="text-[9px] font-semibold bg-slate-50 text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded-full shadow-sm">
                          Breve
                        </span>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group/item ${item.active
                          ? "bg-blue-50 text-blue-600 font-semibold shadow-sm shadow-blue-500/5"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                    >
                      <Icon
                        className={`w-4 h-4 transition-transform group-hover/item:scale-110 duration-200 ${item.active ? "text-blue-600" : "text-slate-400 group-hover/item:text-slate-600"
                          }`}
                      />
                      <span className="text-sm font-medium">{item.name}</span>
                      {item.active && (
                        <div className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* User Session & Footer */}
      <div className="p-4 border-t border-slate-50 bg-slate-50/50 space-y-2">
        {session?.user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center border border-white shadow-inner shrink-0">
              {session.user.name ? session.user.name.charAt(0).toUpperCase() : "P"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                {session.user.name || "Professor"}
              </p>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                {session.user.email}
              </p>
            </div>
          </div>
        )}

        <div className="pt-1">
          <Link href="/student" className="w-full">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5 text-xs font-semibold border-slate-200 text-slate-600 hover:bg-white hover:text-blue-600 hover:border-blue-200 rounded-xl py-2 px-3 shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Área do Estudante
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  );
}
