import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { SeRegistra } from "@/modulos/acesso/componentes/conforme-perfil";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCelula, classeCelulaCabecalho, classeLink, classeTabela } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData } from "@/lib/formatacao";
import { identificadorDoParametro, textoDoParametro, valorDaLista } from "@/lib/parametros";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { FiltrosIniciativas } from "@/modulos/iniciativas/componentes/filtros-iniciativas";
import { listarIniciativas, opcoesProjetosTemas } from "@/modulos/iniciativas/consultas";
import {
  PRIORIDADES_INICIATIVA,
  ROTULOS_PRIORIDADE_INICIATIVA,
  ROTULOS_TIPO_INICIATIVA,
  SITUACOES_INICIATIVA,
  TIPOS_INICIATIVA,
} from "@/modulos/iniciativas/rotulos";
import { SeloIniciativa } from "@/modulos/interacoes/componentes/selos";
import { opcoesComites } from "@/modulos/projetos-temas/consultas";

export const metadata: Metadata = { title: "Iniciativas" };

export default function PaginaIniciativas({ searchParams }: PageProps<"/iniciativas">) {
  return (
    <>
      <CabecalhoPagina
        titulo="Matriz de Iniciativas"
        descricao="Demandas, reuniões relevantes e frentes de atuação, com os projetos, temas e stakeholders envolvidos."
        acoes={
          <SeRegistra>
            <Link href="/iniciativas/nova" className={classeBotaoPrimario}>
              Nova iniciativa
            </Link>
          </SeRegistra>
        }
      />
      <Suspense fallback={<Carregando />}>
        <ListaIniciativas searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ListaIniciativas({ searchParams }: Pick<PageProps<"/iniciativas">, "searchParams">) {
  const parametros = await searchParams;
  const situacaoParametro = textoDoParametro(parametros, "situacao");
  const filtro = {
    busca: textoDoParametro(parametros, "busca"),
    tipo: valorDaLista(parametros, "tipo", TIPOS_INICIATIVA),
    situacao: situacaoParametro === "em_curso" ? ("em_curso" as const) : valorDaLista(parametros, "situacao", SITUACOES_INICIATIVA),
    prioridade: valorDaLista(parametros, "prioridade", PRIORIDADES_INICIATIVA),
    comiteId: identificadorDoParametro(parametros, "comite"),
    projetoTemaId: identificadorDoParametro(parametros, "projeto"),
    responsavelId: identificadorDoParametro(parametros, "responsavel"),
    incluirArquivadas: parametros.arquivadas === "sim",
  };

  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const [iniciativas, comites, projetos, usuarios] = await Promise.all([
    listarIniciativas(banco, filtro, visiveis),
    opcoesComites(banco),
    opcoesProjetosTemas(banco, visiveis),
    opcoesUsuarios(banco),
  ]);

  return (
    <>
      <FiltrosIniciativas
        valores={{
          busca: filtro.busca,
          tipo: filtro.tipo ?? "",
          situacao: filtro.situacao ?? "",
          prioridade: filtro.prioridade ?? "",
          comite: filtro.comiteId ?? "",
          projeto: filtro.projetoTemaId ?? "",
          responsavel: filtro.responsavelId ?? "",
          incluirArquivadas: filtro.incluirArquivadas,
        }}
        comites={comites}
        projetos={projetos}
        usuarios={usuarios}
      />
      <p className="mb-2 text-sm text-texto-secundario" role="status">
        {iniciativas.length === 1 ? "1 iniciativa encontrada" : `${iniciativas.length} iniciativas encontradas`}
      </p>
      {iniciativas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda p-8 text-center text-texto-secundario">
          Nenhuma iniciativa encontrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
          <table className={classeTabela}>
            <caption className="sr-only">Iniciativas</caption>
            <thead>
              <tr>
                <th scope="col" className={classeCelulaCabecalho}>
                  Iniciativa
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>
                  Projetos e temas
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden lg:table-cell`}>
                  Responsável
                </th>
                <th scope="col" className={classeCelulaCabecalho}>
                  Situação
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden text-right sm:table-cell`}>
                  Interações
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden text-right sm:table-cell`}>
                  Compromissos pendentes
                </th>
              </tr>
            </thead>
            <tbody>
              {iniciativas.map((i) => (
                <tr key={i.id}>
                  <td className={classeCelula}>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                      {ROTULOS_TIPO_INICIATIVA[i.tipo]}
                      {i.prioridade && ` · prioridade ${ROTULOS_PRIORIDADE_INICIATIVA[i.prioridade].toLowerCase()}`}
                    </span>
                    <Link href={`/iniciativas/${i.id}`} className={classeLink}>
                      {i.titulo}
                    </Link>
                    {i.arquivadoEm && (
                      <span className="ml-2 align-middle">
                        <SeloSituacao tom="neutro">Arquivada</SeloSituacao>
                      </span>
                    )}
                    <span className="block text-xs text-texto-secundario">
                      Aberta em {formatarData(i.dataAbertura)}
                      {i.dataPrevistaConclusao && ` · previsão ${formatarData(i.dataPrevistaConclusao)}`}
                      {i.stakeholders > 0 && ` · ${i.stakeholders} stakeholder${i.stakeholders > 1 ? "s" : ""}`}
                    </span>
                    <span className="block text-xs text-texto-secundario md:hidden">{i.projetos}</span>
                  </td>
                  <td className={`${classeCelula} hidden md:table-cell`}>
                    {i.projetos}
                    {i.comites && <span className="block text-xs text-texto-secundario">{i.comites}</span>}
                  </td>
                  <td className={`${classeCelula} hidden lg:table-cell`}>{i.responsavelNome ?? "—"}</td>
                  <td className={`${classeCelula} whitespace-nowrap`}>
                    <SeloIniciativa situacao={i.situacao} />
                  </td>
                  <td className={`${classeCelula} hidden text-right tabular-nums sm:table-cell`}>{i.interacoes}</td>
                  <td className={`${classeCelula} hidden text-right tabular-nums sm:table-cell`}>{i.compromissosPendentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-texto-secundario">
        Apresentação em lista filtrável: proposta provisória (Q-20), enquanto não se define o formato da matriz.
      </p>
    </>
  );
}
