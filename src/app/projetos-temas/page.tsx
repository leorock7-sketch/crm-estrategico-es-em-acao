import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import {
  classeBotaoPrimario,
  classeCelula,
  classeCelulaCabecalho,
  classeLink,
  classeTabela,
} from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { FiltrosProjetosTemas } from "@/modulos/projetos-temas/componentes/filtros-projetos-temas";
import { listarProjetosTemas, opcoesComites } from "@/modulos/projetos-temas/consultas";
import {
  ROTULOS_SITUACAO_PROJETO_TEMA,
  ROTULOS_TIPO_PROJETO_TEMA,
  SITUACOES_PROJETO_TEMA,
  TIPOS_PROJETO_TEMA,
} from "@/modulos/projetos-temas/rotulos";

export const metadata: Metadata = { title: "Projetos e temas" };

export default function PaginaProjetosTemas({ searchParams }: PageProps<"/projetos-temas">) {
  return (
    <>
      <CabecalhoPagina
        titulo="Projetos e temas"
        descricao="Contextos de atuação dos comitês, com comitês participantes e stakeholders associados."
        acoes={
          <Link href="/projetos-temas/novo" className={classeBotaoPrimario}>
            Novo projeto ou tema
          </Link>
        }
      />
      <Suspense fallback={<Carregando />}>
        <ListaProjetosTemas searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Valor do parâmetro, se pertencer à lista permitida. */
function valorDaLista<T extends string>(valor: unknown, lista: readonly T[]): T | undefined {
  return typeof valor === "string" && (lista as readonly string[]).includes(valor) ? (valor as T) : undefined;
}

async function ListaProjetosTemas({
  searchParams,
}: Pick<PageProps<"/projetos-temas">, "searchParams">) {
  const parametros = await searchParams;
  const busca = typeof parametros.busca === "string" ? parametros.busca : "";
  const tipo = valorDaLista(parametros.tipo, TIPOS_PROJETO_TEMA);
  const situacao = valorDaLista(parametros.situacao, SITUACOES_PROJETO_TEMA);
  const comite = esquemaIdentificador.safeParse(parametros.comite).data;
  const incluirArquivados = parametros.arquivados === "sim";

  const banco = await bancoDaRequisicao();
  const [projetos, comites] = await Promise.all([
    listarProjetosTemas(banco, { busca, tipo, situacao, comiteId: comite, incluirArquivados }),
    opcoesComites(banco),
  ]);

  return (
    <>
      <FiltrosProjetosTemas
        valores={{
          busca,
          tipo: tipo ?? "",
          situacao: situacao ?? "",
          comite: comite ?? "",
          incluirArquivados,
        }}
        comites={comites}
      />

      <p className="mb-2 text-sm text-texto-secundario" role="status">
        {projetos.length === 1 ? "1 registro encontrado" : `${projetos.length} registros encontrados`}
      </p>

      {projetos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda p-8 text-center text-texto-secundario">
          Nenhum projeto ou tema encontrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
          <table className={classeTabela}>
            <thead>
              <tr>
                <th scope="col" className={classeCelulaCabecalho}>
                  Nome
                </th>
                <th scope="col" className={classeCelulaCabecalho}>
                  Comitê principal
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden lg:table-cell`}>
                  Comitês participantes
                </th>
                <th scope="col" className={classeCelulaCabecalho}>
                  Situação
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden text-right md:table-cell`}>
                  Stakeholders
                </th>
              </tr>
            </thead>
            <tbody>
              {projetos.map((p) => (
                <tr key={p.id}>
                  <td className={classeCelula}>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                      {ROTULOS_TIPO_PROJETO_TEMA[p.tipo]}
                    </span>
                    <Link href={`/projetos-temas/${p.id}`} className={classeLink}>
                      {p.nome}
                    </Link>
                    {p.arquivadoEm && (
                      <span className="ml-2 align-middle">
                        <SeloSituacao tom="neutro">Arquivado</SeloSituacao>
                      </span>
                    )}
                  </td>
                  <td className={classeCelula}>{p.comiteNome}</td>
                  <td className={`${classeCelula} hidden lg:table-cell`}>
                    {p.participantes ?? <span className="text-texto-secundario">—</span>}
                  </td>
                  <td className={classeCelula}>{ROTULOS_SITUACAO_PROJETO_TEMA[p.situacao]}</td>
                  <td className={`${classeCelula} hidden text-right tabular-nums md:table-cell`}>
                    {p.stakeholders}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
