import Link from "next/link";
import { classeCartao } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";

const MODULOS = [
  {
    href: "/pessoas",
    titulo: "Pessoas",
    descricao: "Cadastro Mestre de pessoas, com vínculos institucionais e histórico.",
  },
  {
    href: "/instituicoes",
    titulo: "Instituições",
    descricao: "Órgãos, empresas, entidades e demais instituições, com sua hierarquia.",
  },
] as const;

export default function PaginaInicial() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <section className={`${classeCartao} sm:p-10`}>
        <SeloSituacao>Em desenvolvimento</SeloSituacao>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
          CRM Estratégico — ES em Ação
        </h1>

        <p className="mt-4 text-lg leading-relaxed text-texto-secundario">
          Sistema de gestão estratégica de relacionamentos institucionais do ES em Ação:
          stakeholders, projetos, iniciativas, interações, planos de ação e riscos.
        </p>

        <p className="mt-8 border-t border-borda pt-6 text-sm text-texto-secundario">
          Esta aplicação está em desenvolvimento (Etapa 1 — Cadastro Mestre). O ambiente de
          testes utiliza exclusivamente dados fictícios.
        </p>
      </section>

      <section aria-labelledby="titulo-modulos">
        <h2 id="titulo-modulos" className="mb-3 text-lg font-semibold">
          Cadastro Mestre
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {MODULOS.map((modulo) => (
            <li key={modulo.href}>
              <Link
                href={modulo.href}
                className={`${classeCartao} block h-full transition-colors hover:border-blue-700`}
              >
                <span className="text-base font-semibold">{modulo.titulo}</span>
                <span className="mt-1 block text-sm text-texto-secundario">{modulo.descricao}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
