import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";


export const authConfig = {
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role as Role | undefined;

      const isAuthPage = nextUrl.pathname.startsWith("/auth");
      const isDashboardPage = nextUrl.pathname.startsWith("/dashboard");
      const isApiRoute = nextUrl.pathname.startsWith("/api");

      // Usuário logado tentando acessar página de login → redireciona para área correta
      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL(role === "TEACHER" ? "/dashboard" : "/student", nextUrl));
        }
        return true;
      }

      // Rotas protegidas exigem login
      if (!isLoggedIn && !isApiRoute && nextUrl.pathname !== "/") {
        return false;
      }

      // RBAC: aluno tentando acessar dashboard de professor
      if (isLoggedIn && isDashboardPage && role !== "TEACHER") {
        return Response.redirect(new URL("/student", nextUrl));
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
  providers: [], // Configurado em auth.ts
} satisfies NextAuthConfig;