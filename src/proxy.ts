import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
// parte importante do código onde ele faz o roteamento e a verificação de sessão
// é como se fosse um guarda que verifica se o usuário está logado e se ele tem permissão para acessar a página
// o firewall do nextjs
