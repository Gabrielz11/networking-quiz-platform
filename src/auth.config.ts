import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/auth");

      if (isAuthPage) {
        if (isLoggedIn) {
          const role = (auth?.user as any)?.role;
          if (role === "TEACHER") {
            return Response.redirect(new URL("/dashboard", nextUrl));
          } else {
            return Response.redirect(new URL("/student", nextUrl));
          }
        }
        return true;
      }

      // Proteger rotas
      if (!isLoggedIn && !nextUrl.pathname.startsWith("/api") && nextUrl.pathname !== "/") {
        return false; // Redireciona para login
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
