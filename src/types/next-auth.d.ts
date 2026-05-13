import { Role } from "@prisma/client";
import type { DefaultSession, DefaultJWT } from "next-auth";

/**
 * Extensão dos tipos do NextAuth para incluir `id` e `role`
 * em Session e JWT, eliminando o uso de `as any` no auth.config.ts.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: Role;
  }
}
