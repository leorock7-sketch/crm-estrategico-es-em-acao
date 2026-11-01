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
import { BuscaCadastro } from "@/modulos/stakeholders/componentes/busca-cadastro";
import { listarInstituicoes } from "@/modulos/stakeholders/consultas";
import { nomePais } from "@/modulos/stakeholders/paises";
import { ROTULOS_NATUREZA } from "@/modulos/stakeholders/rotulos";

export const metadata: Metadata = { title: "Instituições" };

export default function PaginaInstituicoes({ searchParams }: PageProps<"/instituicoes">) {
  return (
    <>
      <CabecalhoPagina
        titulo="Instituições"
        descricao="Cadastro Mestre: cada instituição é registrada uma única vez."
        acoes={
          <Link href="/instituicoes/nova" className={classeBotaoPrimario}>
            Nova instituição
          </Link>
        }
      />
      <Suspense fallback={<Carregando />}>
        <ListaInstituicoes searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ListaInstituicoes({
  searchParams,
}: Pick<PageProps<"/instituicoes">, "searchParams">) {
  const parametros = await searchParams;
  const busca = typeof parametros.busca === "string" ? parametros.busca : "";
  const incluirArquivados = parametros.arquivados === "sim";
  const banco = await bancoDaRequisicao();
  const instituicoes = await listarInstituicoes(banco, {
    busca,
    incluirArquivadas: incluirArquivados,
  });

  return (
    <>
      <BuscaCadastro
        rotulo="Buscar por nome ou sigla"
        busca={busca}
        incluirArquivados={incluirArquivados}
        rotuloArquivados="Incluir arquivadas"
      />

      <p className="mb-2 text-sm text-texto-secundario" role="status">
        {instituicoes.length === 1
          ? "1 instituição encontrada"
          : `${instituicoes.length} instituições encontradas`}
      </p>

      {instituicoes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda p-8 text-center text-texto-secundario">
          Nenhuma instituição encontrada.
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
                  Natureza
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>
                  Local
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} text-right`}>
                  Pessoas
                </th>
              </tr>
            </thead>
            <tbody>
              {instituicoes.map((i) => (
                <tr key={i.id}>
                  <td className={classeCelula}>
                    <Link href={`/instituicoes/${i.id}`} className={classeLink}>
                      {i.nome}
                    </Link>
                    {i.sigla && <span className="text-texto-secundario"> ({i.sigla})</span>}
                    {i.arquivadoEm && (
                      <span className="ml-2 align-middle">
                        <SeloSituacao tom="neutro">Arquivada</SeloSituacao>
                      </span>
                    )}
                    {i.superiorNome && (
                      <span className="block text-xs text-texto-secundario">
                        Vinculada a {i.superiorNome}
                      </span>
                    )}
                  </td>
                  <td className={classeCelula}>{ROTULOS_NATUREZA[i.natureza]}</td>
                  <td className={`${classeCelula} hidden md:table-cell`}>
                    {i.pais === "BR"
                      ? [i.municipio, i.uf].filter(Boolean).join(" – ") || "—"
                      : [i.municipio, nomePais(i.pais)].filter(Boolean).join(" – ")}
                  </td>
                  <td className={`${classeCelula} text-right tabular-nums`}>
                    {i.pessoasVinculadas}
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
