import Link from "next/link";
import { classeCartao } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";

const MODULOS = [
  {
    href: "/comites",
    titulo: "Comitês",
    descricao: "Estrutura de governança e os projetos e temas de cada comitê.",
  },
  {
    href: "/projetos-temas",
    titulo: "Projetos e temas",
    descricao: "Contextos de atuação, com comitês participantes e stakeholders associados.",
  },
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
  {
    href: "/iniciativas",
    titulo: "Iniciativas",
    descricao: "Matriz de Iniciativas: demandas, reuniões relevantes e frentes de atuação, com projetos e stakeholders.",
  },
  {
    href: "/interacoes",
    titulo: "Interações",
    descricao: "Reuniões e contatos, registrados uma única vez e ligados às iniciativas e aos projetos.",
  },
  {
    href: "/compromissos",
    titulo: "Compromissos",
    descricao: "Encaminhamentos com responsável e prazo: pendentes, concluídos e vencidos.",
  },
  {
    href: "/planos",
    titulo: "Planos de ação",
    descricao: "Um plano por projeto ou tema, por pilares ou eixos, com versões aprovadas, ações, marcos e acompanhamento.",
  },
  {
    href: "/riscos",
    titulo: "Matriz de Riscos",
    descricao: "Matriz 5 × 5 do Comitê de Infraestrutura, com riscos inerentes e residuais, gatilhos e respostas.",
  },
  {
    href: "/metodologias",
    titulo: "Metodologias de avaliação",
    descricao: "Versões da metodologia de poder e interesse e a situação de cada uma.",
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
          Ambiente de testes do piloto, somente com dados fictícios. O uso com dados institucionais reais depende de
          autorização.
        </p>
      </section>

      <section aria-labelledby="titulo-modulos">
        <h2 id="titulo-modulos" className="mb-3 text-lg font-semibold">
          Módulos
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
