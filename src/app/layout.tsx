import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MenuPrincipal } from "@/componentes/menu-principal";
import { UsuarioNoTopo } from "@/lib/autenticacao/usuario-no-topo";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CRM Estratégico — ES em Ação",
    template: "%s · CRM Estratégico — ES em Ação",
  },
  description:
    "Sistema de gestão estratégica de relacionamentos institucionais do ES em Ação (em desenvolvimento).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-borda bg-superficie print:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              CRM Estratégico <span className="text-texto-secundario">— ES em Ação</span>
            </Link>
            <Suspense fallback={null}>
              <MenuPrincipal />
            </Suspense>
            <Suspense fallback={null}>
              <UsuarioNoTopo />
            </Suspense>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-borda px-4 py-4 text-center text-xs text-texto-secundario">
          Ambiente de desenvolvimento · dados exclusivamente fictícios
        </footer>
      </body>
    </html>
  );
}
