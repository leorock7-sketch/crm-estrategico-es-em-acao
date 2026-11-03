import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CRM Estratégico — ES em Ação",
    template: "%s · CRM Estratégico — ES em Ação",
  },
  description:
    "Sistema de gestão estratégica de relacionamentos institucionais do ES em Ação (em desenvolvimento).",
};

const LINKS_MENU = [
  { href: "/comites", rotulo: "Comitês" },
  { href: "/projetos-temas", rotulo: "Projetos e temas" },
  { href: "/pessoas", rotulo: "Pessoas" },
  { href: "/instituicoes", rotulo: "Instituições" },
  { href: "/iniciativas", rotulo: "Iniciativas" },
  { href: "/interacoes", rotulo: "Interações" },
  { href: "/compromissos", rotulo: "Compromissos" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-borda bg-superficie">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              CRM Estratégico <span className="text-texto-secundario">— ES em Ação</span>
            </Link>
            <nav aria-label="Menu principal">
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {LINKS_MENU.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:underline">
                      {link.rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
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
