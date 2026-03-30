import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const user = auth?.user as any;
      const role = user?.role;
      
      const isAuthPage = nextUrl.pathname.startsWith("/auth");
      const isDashboardPage = nextUrl.pathname.startsWith("/dashboard");
      const isStudentPage = nextUrl.pathname.startsWith("/student");
      const isApiRoute = nextUrl.pathname.startsWith("/api");

      // Se estiver logado e tentar acessar a página de login/registro, redireciona para o local correto
      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL(role === "TEACHER" ? "/dashboard" : "/student", nextUrl));
        }
        return true;
      }

      // Proteger rotas que exigem login
      if (!isLoggedIn && !isApiRoute && nextUrl.pathname !== "/") {
        return false; // Redireciona para login
      }

      // Verificação de Roles (RBAC)
      if (isLoggedIn) {
        // Aluno tentando acessar dashboard de professor
        if (isDashboardPage && role !== "TEACHER") {
          return Response.redirect(new URL("/student", nextUrl));
        }
        // Professor tentando acessar área de aluno (opcional - depende se professor pode ver conteúdo)
        // if (isStudentPage && role !== "STUDENT") {
        //   return Response.redirect(new URL("/dashboard", nextUrl));
        // }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // Configurado no auth.ts
} satisfies NextAuthConfig;
// tipar user
// tipar session
// criar util de authorization - requireTeacher() por exemplo.