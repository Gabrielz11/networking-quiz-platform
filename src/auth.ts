import NextAuth from "next-auth"; // inicializa o sistema de autenticacao
import Credentials from "next-auth/providers/credentials"; // provider de autenticacao
import bcrypt from "bcryptjs"; // biblioteca para criptografar senhas
import { prisma } from "@/lib/prisma"; // cliente do banco de dados
import { authConfig } from "@/auth.config"; // configuração do sistema de autenticacao

export const { handlers, signIn, signOut, auth } = NextAuth({ //handlers - api routes de autenticacao, signIn - funcao para fazer login, signOut - funcao para fazer logout, auth - funcao para verificar se o usuario esta logado
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null; // se nao tiver email ou senha, retorna null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        }); // busca o usuario no banco de dados

        if (!user || !user.password) return null; // se nao tiver usuario ou senha, retorna null

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        ); // compara a senha digitada com a senha criptografada no banco de dados

        if (passwordsMatch) { // se a senha estiver correta, retorna o usuario
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        }

        return null; // se a senha estiver incorreta, retorna null
      },
    }),
  ],
});
