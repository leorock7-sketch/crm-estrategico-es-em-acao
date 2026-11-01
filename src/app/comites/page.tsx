import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import {
  classeCelula,
  classeCelulaCabecalho,
  classeLink,
  classeTabela,
} from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { listarComites } from "@/modulos/projetos-temas/consultas";
import { ROTULOS_TIPO_COMITE } from "@/modulos/projetos-temas/rotulos";

export const metadata: Metadata = { title: "Comitês" };

export default function PaginaComites() {
  return (
    <>
      <CabecalhoPagina
        titulo="Comitês"
        descricao="Estrutura de governança do ES em Ação (somente consulta nesta etapa)."
      />
      <Suspense fallback={<Carregando />}>
        <ListaComites />
      </Suspense>
    </>
  );
}

async function ListaComites() {
  const banco = await bancoDaRequisicao();
  const comites = await listarComites(banco);
  // Comitês sem superior primeiro; os temáticos aparecem abaixo do respectivo superior.
  const raizes = comites.filter((c) => c.comiteSuperiorId === null);
  const ordenados = raizes.flatMap((raiz) => [
    { ...raiz, nivel: 0 },
    ...comites.filter((c) => c.comiteSuperiorId === raiz.id).map((c) => ({ ...c, nivel: 1 })),
  ]);

  return (
    <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
      <table className={classeTabela}>
        <thead>
          <tr>
            <th scope="col" className={classeCelulaCabecalho}>
              Comitê
            </th>
            <th scope="col" className={`${classeCelulaCabecalho} hidden sm:table-cell`}>
              Tipo
            </th>
            <th scope="col" className={`${classeCelulaCabecalho} text-right`}>
              Principal em
            </th>
            <th scope="col" className={`${classeCelulaCabecalho} text-right`}>
              Participante em
            </th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((c) => (
            <tr key={c.id}>
              <td className={classeCelula}>
                <span className={c.nivel === 1 ? "pl-5" : undefined}>
                  {c.nivel === 1 && (
                    <span aria-hidden="true" className="mr-1 text-texto-secundario">
                      └
                    </span>
                  )}
                  <Link href={`/comites/${c.id}`} className={classeLink}>
                    {c.nome}
                  </Link>
                </span>
              </td>
              <td className={`${classeCelula} hidden sm:table-cell`}>{ROTULOS_TIPO_COMITE[c.tipo]}</td>
              <td className={`${classeCelula} text-right tabular-nums`}>{c.comoPrincipal}</td>
              <td className={`${classeCelula} text-right tabular-nums`}>{c.comoParticipante}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-texto-secundario">
        Totais de projetos e temas não arquivados; participações vigentes.
      </p>
    </div>
  );
}
