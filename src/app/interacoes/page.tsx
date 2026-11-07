import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { SeRegistra } from "@/modulos/acesso/componentes/conforme-perfil";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCelula, classeCelulaCabecalho, classeLink, classeTabela } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarDataHora, hojeEmBrasilia } from "@/lib/formatacao";
import { identificadorDoParametro, textoDoParametro, valorDaLista } from "@/lib/parametros";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { opcoesIniciativas, opcoesProjetosTemas } from "@/modulos/iniciativas/consultas";
import { FiltrosInteracoes } from "@/modulos/interacoes/componentes/filtros";
import { SeloInteracao } from "@/modulos/interacoes/componentes/selos";
import { listarInteracoes } from "@/modulos/interacoes/consultas";
import { PERIODOS_INTERACAO, ROTULOS_TIPO_INTERACAO, SITUACOES_INTERACAO, TIPOS_INTERACAO } from "@/modulos/interacoes/rotulos";
import { opcoesStakeholders } from "@/modulos/projetos-temas/consultas";

export const metadata: Metadata = { title: "Interações" };

export default function PaginaInteracoes({ searchParams }: PageProps<"/interacoes">) {
  return (
    <>
      <CabecalhoPagina
        titulo="Interações"
        descricao="Reuniões, contatos e encontros, cada um registrado uma única vez e ligado aos projetos, temas e iniciativas."
        acoes={
          <SeRegistra>
            <Link href="/interacoes/nova" className={classeBotaoPrimario}>
              Registrar interação
            </Link>
          </SeRegistra>
        }
      />
      <Suspense fallback={<Carregando />}>
        <ListaInteracoes searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ListaInteracoes({ searchParams }: Pick<PageProps<"/interacoes">, "searchParams">) {
  const parametros = await searchParams;
  const filtro = {
    busca: textoDoParametro(parametros, "busca"),
    tipo: valorDaLista(parametros, "tipo", TIPOS_INTERACAO),
    situacao: valorDaLista(parametros, "situacao", SITUACOES_INTERACAO),
    periodo: valorDaLista(parametros, "periodo", PERIODOS_INTERACAO),
    projetoTemaId: identificadorDoParametro(parametros, "projeto"),
    iniciativaId: identificadorDoParametro(parametros, "iniciativa"),
    stakeholderId: identificadorDoParametro(parametros, "stakeholder"),
    incluirArquivadas: parametros.arquivadas === "sim",
  };

  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const [interacoes, projetos, iniciativas, stakeholders] = await Promise.all([
    listarInteracoes(banco, filtro, visiveis, hojeEmBrasilia()),
    opcoesProjetosTemas(banco, visiveis),
    opcoesIniciativas(banco, visiveis),
    opcoesStakeholders(banco),
  ]);

  return (
    <>
      <FiltrosInteracoes
        valores={{
          busca: filtro.busca,
          tipo: filtro.tipo ?? "",
          situacao: filtro.situacao ?? "",
          periodo: filtro.periodo ?? "",
          projeto: filtro.projetoTemaId ?? "",
          iniciativa: filtro.iniciativaId ?? "",
          stakeholder: filtro.stakeholderId ?? "",
          incluirArquivadas: filtro.incluirArquivadas,
        }}
        projetos={projetos}
        iniciativas={iniciativas}
        pessoas={stakeholders.pessoas}
        instituicoes={stakeholders.instituicoes}
      />
      <p className="mb-2 text-sm text-texto-secundario" role="status">
        {interacoes.length === 1 ? "1 interação encontrada" : `${interacoes.length} interações encontradas`}
      </p>
      {interacoes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda p-8 text-center text-texto-secundario">
          Nenhuma interação encontrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
          <table className={classeTabela}>
            <caption className="sr-only">Interações</caption>
            <thead>
              <tr>
                <th scope="col" className={classeCelulaCabecalho}>
                  Interação
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>
                  Projetos e temas
                </th>
                <th scope="col" className={classeCelulaCabecalho}>
                  Situação
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden text-right sm:table-cell`}>
                  Iniciativas
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden text-right sm:table-cell`}>
                  Compromissos pendentes
                </th>
              </tr>
            </thead>
            <tbody>
              {interacoes.map((i) => (
                <tr key={i.id}>
                  <td className={classeCelula}>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                      {ROTULOS_TIPO_INTERACAO[i.tipo]} · {formatarDataHora(i.inicio)}
                    </span>
                    <Link href={`/interacoes/${i.id}`} className={classeLink}>
                      {i.assunto}
                    </Link>
                    {i.arquivadoEm && (
                      <span className="ml-2 align-middle">
                        <SeloSituacao tom="neutro">Arquivada</SeloSituacao>
                      </span>
                    )}
                    <span className="block text-xs text-texto-secundario">
                      {i.participantes} participante{i.participantes === 1 ? "" : "s"}
                      {i.local && ` · ${i.local}`}
                    </span>
                    <span className="block text-xs text-texto-secundario md:hidden">{i.projetos}</span>
                  </td>
                  <td className={`${classeCelula} hidden md:table-cell`}>{i.projetos ?? "—"}</td>
                  <td className={`${classeCelula} whitespace-nowrap`}>
                    <SeloInteracao situacao={i.situacao} />
                  </td>
                  <td className={`${classeCelula} hidden text-right tabular-nums sm:table-cell`}>{i.iniciativas}</td>
                  <td className={`${classeCelula} hidden text-right tabular-nums sm:table-cell`}>{i.compromissosPendentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
