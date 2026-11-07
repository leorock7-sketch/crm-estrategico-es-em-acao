"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS_MENU = [
  { href: "/comites", rotulo: "Comitês" },
  { href: "/projetos-temas", rotulo: "Projetos e temas" },
  { href: "/pessoas", rotulo: "Pessoas" },
  { href: "/instituicoes", rotulo: "Instituições" },
  { href: "/iniciativas", rotulo: "Iniciativas" },
  { href: "/interacoes", rotulo: "Interações" },
  { href: "/compromissos", rotulo: "Compromissos" },
  { href: "/planos", rotulo: "Planos de ação" },
  { href: "/riscos", rotulo: "Riscos" },
] as const;

const ROTAS_SEM_MENU = ["/login", "/sem-acesso"];

/** Menu principal; não aparece nas telas de quem ainda não entrou ou está sem acesso. */
export function MenuPrincipal() {
  const caminho = usePathname();
  if (ROTAS_SEM_MENU.includes(caminho)) return null;
  return (
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
  );
}
