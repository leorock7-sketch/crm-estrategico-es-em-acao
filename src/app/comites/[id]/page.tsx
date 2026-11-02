import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCartao, classeLink } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import {
  listarSubordinados,
  obterComite,
  projetosTemasDoComite,
} from "@/modulos/projetos-temas/consultas";
import {
  ROTULOS_SITUACAO_PROJETO_TEMA,
  ROTULOS_TIPO_COMITE,
  ROTULOS_TIPO_PROJETO_TEMA,
} from "@/modulos/projetos-temas/rotulos";

export const metadata: Metadata = { title: "Comitê" };

export default function PaginaComite({ params }: PageProps<"/comites/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheComite params={params} />
    </Suspense>
  );
}

async function DetalheComite({ params }: Pick<PageProps<"/comites/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();

  const banco = await bancoDaRequisicao();
  const comite = await obterComite(banco, id);
  if (!comite) notFound();

  const [subordinados, { principais, participacoes }] = await Promise.all([
    listarSubordinados(banco, id),
    projetosTemasDoComite(banco, id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={comite.nome}
        voltar={{ href: "/comites", rotulo: "Comitês" }}
        descricao={ROTULOS_TIPO_COMITE[comite.tipo]}
        acoes={
          <Link href={`/projetos-temas/novo?comite=${id}`} className={classeBotaoPrimario}>
            Novo projeto ou tema
          </Link>
        }
      />

      <section aria-labelledby="titulo-estrutura" className={classeCartao}>
        <h2 id="titulo-estrutura" className="mb-4 text-lg font-semibold">
          Estrutura
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-texto-secundario">Comitê superior</dt>
            <dd className="mt-0.5">
              {comite.comiteSuperiorId ? (
                <Link href={`/comites/${comite.comiteSuperiorId}`} className={classeLink}>
                  {comite.superiorNome}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Comitês temáticos</dt>
            <dd className="mt-0.5">
              {subordinados.length === 0
                ? "—"
                : subordinados.map((s, posicao) => (
                    <span key={s.id}>
                      {posicao > 0 && ", "}
                      <Link href={`/comites/${s.id}`} className={classeLink}>
                        {s.nome}
                      </Link>
                    </span>
                  ))}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="titulo-principal" className={classeCartao}>
        <h2 id="titulo-principal" className="mb-1 text-lg font-semibold">
          Projetos e temas como comitê principal
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Não inclui projetos e temas arquivados.{" "}
          <Link href={`/projetos-temas?comite=${id}`} className={classeLink}>
            Ver na lista com filtros
          </Link>
        </p>
        <ListaProjetos projetos={principais} vazio="Nenhum projeto ou tema tem este comitê como principal." />
      </section>

      <section aria-labelledby="titulo-participante" className={classeCartao}>
        <h2 id="titulo-participante" className="mb-1 text-lg font-semibold">
          Projetos e temas como comitê participante
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">Participações vigentes.</p>
        <ListaProjetos projetos={participacoes} vazio="Este comitê não participa de outros projetos ou temas." />
      </section>
    </div>
  );
}

type ProjetoDoComite = Awaited<ReturnType<typeof projetosTemasDoComite>>["participacoes"][number];

function ListaProjetos({
  projetos,
  vazio,
}: {
  projetos: (Omit<ProjetoDoComite, "principalNome"> & { principalNome?: string })[];
  vazio: string;
}) {
  if (projetos.length === 0) return <p className="text-sm text-texto-secundario">{vazio}</p>;
  return (
    <ul className="flex flex-col divide-y divide-borda text-sm">
      {projetos.map((p) => (
        <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
          <span>
            <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-texto-secundario">
              {ROTULOS_TIPO_PROJETO_TEMA[p.tipo]}
            </span>
            <Link href={`/projetos-temas/${p.id}`} className={classeLink}>
              {p.nome}
            </Link>
            {p.principalNome && <span className="text-texto-secundario"> · principal: {p.principalNome}</span>}
          </span>
          <span className="text-xs text-texto-secundario">{ROTULOS_SITUACAO_PROJETO_TEMA[p.situacao]}</span>
        </li>
      ))}
    </ul>
  );
}
