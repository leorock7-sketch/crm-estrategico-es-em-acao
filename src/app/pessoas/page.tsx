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
import { listarPessoas } from "@/modulos/stakeholders/consultas";

export const metadata: Metadata = { title: "Pessoas" };

export default function PaginaPessoas({ searchParams }: PageProps<"/pessoas">) {
  return (
    <>
      <CabecalhoPagina
        titulo="Pessoas"
        descricao="Cadastro Mestre: cada pessoa é registrada uma única vez."
        acoes={
          <Link href="/pessoas/nova" className={classeBotaoPrimario}>
            Nova pessoa
          </Link>
        }
      />
      <Suspense fallback={<Carregando />}>
        <ListaPessoas searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ListaPessoas({ searchParams }: Pick<PageProps<"/pessoas">, "searchParams">) {
  const parametros = await searchParams;
  const busca = typeof parametros.busca === "string" ? parametros.busca : "";
  const incluirArquivados = parametros.arquivados === "sim";
  const banco = await bancoDaRequisicao();
  const pessoas = await listarPessoas(banco, { busca, incluirArquivadas: incluirArquivados });

  return (
    <>
      <BuscaCadastro
        rotulo="Buscar por nome, e-mail ou instituição"
        busca={busca}
        incluirArquivados={incluirArquivados}
        rotuloArquivados="Incluir arquivadas"
      />

      <p className="mb-2 text-sm text-texto-secundario" role="status">
        {pessoas.length === 1 ? "1 pessoa encontrada" : `${pessoas.length} pessoas encontradas`}
      </p>

      {pessoas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda p-8 text-center text-texto-secundario">
          Nenhuma pessoa encontrada.
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
                  Vínculo principal
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>
                  E-mail
                </th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => (
                <tr key={p.id}>
                  <td className={classeCelula}>
                    <Link href={`/pessoas/${p.id}`} className={classeLink}>
                      {p.nomeCompleto}
                    </Link>
                    {p.arquivadoEm && (
                      <span className="ml-2 align-middle">
                        <SeloSituacao tom="neutro">Arquivada</SeloSituacao>
                      </span>
                    )}
                  </td>
                  <td className={classeCelula}>
                    {p.instituicaoNome ? (
                      <>
                        {p.cargo && <span className="block">{p.cargo}</span>}
                        <span className="text-texto-secundario">
                          {p.instituicaoSigla ?? p.instituicaoNome}
                        </span>
                      </>
                    ) : (
                      <span className="text-texto-secundario">—</span>
                    )}
                  </td>
                  <td className={`${classeCelula} hidden break-all md:table-cell`}>
                    {p.email ?? "—"}
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
