import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { SeRegistra } from "@/modulos/acesso/componentes/conforme-perfil";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCelula, classeCelulaCabecalho, classeLink, classeTabela } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { ProgressoMarcos, SeloVersao } from "@/modulos/plano-acao/componentes/selos";
import { listarPlanos } from "@/modulos/plano-acao/consultas";
import type { SituacaoVersaoPlano } from "@/modulos/plano-acao/rotulos";

export const metadata: Metadata = { title: "Planos de ação" };

export default function PaginaPlanos() {
  return (
    <>
      <CabecalhoPagina
        titulo="Planos de ação"
        descricao="Um plano por projeto ou tema, organizado por pilares ou eixos, com versões aprovadas e acompanhamento das ações e marcos."
        acoes={
          <SeRegistra>
            <Link href="/planos/novo" className={classeBotaoPrimario}>
              Novo plano
            </Link>
          </SeRegistra>
        }
      />
      <Suspense fallback={<Carregando />}>
        <ListaPlanos />
      </Suspense>
    </>
  );
}

async function ListaPlanos() {
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const planos = await listarPlanos(banco, hojeEmBrasilia(), visiveis);

  if (planos.length === 0) {
    return <p className="rounded-lg border border-dashed border-borda p-8 text-center text-texto-secundario">Nenhum plano de ação cadastrado.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
      <table className={classeTabela}>
        <caption className="sr-only">Planos de ação</caption>
        <thead>
          <tr>
            <th scope="col" className={classeCelulaCabecalho}>
              Plano
            </th>
            <th scope="col" className={classeCelulaCabecalho}>
              Versão vigente
            </th>
            <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>
              Em elaboração
            </th>
            <th scope="col" className={`${classeCelulaCabecalho} hidden text-right sm:table-cell`}>
              Ações
            </th>
            <th scope="col" className={`${classeCelulaCabecalho} hidden text-right sm:table-cell`}>
              Atrasadas
            </th>
            <th scope="col" className={`${classeCelulaCabecalho} hidden lg:table-cell`}>
              Marcos
            </th>
          </tr>
        </thead>
        <tbody>
          {planos.map((p) => {
            const [numero, situacao] = p.versaoElaboracao?.split(":") ?? [];
            return (
              <tr key={p.id}>
                <td className={classeCelula}>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                    {p.projetoNome} · {p.comiteNome}
                  </span>
                  <Link href={`/planos/${p.id}`} className={classeLink}>
                    {p.titulo}
                  </Link>
                  {p.responsavelNome && <span className="block text-xs text-texto-secundario">Responsável: {p.responsavelNome}</span>}
                  <span className="block text-xs text-texto-secundario sm:hidden">
                    {p.acoes} ações · {p.atrasadas} atrasadas
                  </span>
                </td>
                <td className={`${classeCelula} whitespace-nowrap`}>{p.versaoVigente ? `Versão ${p.versaoVigente}` : "Nenhuma aprovada"}</td>
                <td className={`${classeCelula} hidden md:table-cell`}>
                  {situacao ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      Versão {numero} <SeloVersao situacao={situacao as SituacaoVersaoPlano} />
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`${classeCelula} hidden text-right tabular-nums sm:table-cell`}>{p.acoes}</td>
                <td className={`${classeCelula} hidden text-right tabular-nums sm:table-cell`}>
                  {p.atrasadas > 0 ? <span className="font-semibold text-red-800 dark:text-red-300">{p.atrasadas}</span> : 0}
                </td>
                <td className={`${classeCelula} hidden lg:table-cell`}>
                  <ProgressoMarcos alcancados={p.marcosAlcancados} previstos={p.marcosPrevistos} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
