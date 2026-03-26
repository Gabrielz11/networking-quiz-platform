"use client";

import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
// esse componente é um wrapper que envolve toda a aplicação e fornece o contexto de sessão para os componentes
// ele é usado em _app.tsx - Disponibilizar a sessão do usuário (login) para toda a aplicação no frontend
