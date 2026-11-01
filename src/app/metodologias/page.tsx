import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeCelula, classeCelulaCabecalho, classeLink, classeTabela } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData } from "@/lib/formatacao";
import { AvisoNaoHomologado } from "@/modulos/avaliacoes/componentes/avisos";
import { listarMetodologias } from "@/modulos/avaliacoes/consultas";
import { ROTULOS_SITUACAO_METODOLOGIA } from "@/modulos/avaliacoes/rotulos";

export const metadata: Metadata = { title: "Metodologias de avaliação" };

export default function PaginaMetodologias() {
  return (
    <>
      <CabecalhoPagina
        titulo="Metodologias de avaliação"
        descricao="Versões da metodologia de poder e interesse (somente consulta nesta etapa)."
      />
      <Suspense fallback={<Carregando />}>
        <ListaMetodologias />
      </Suspense>
    </>
  );
}

async function ListaMetodologias() {
  const banco = await bancoDaRequisicao();
  const metodologias = await listarMetodologias(banco);
  return (
    <div className="flex flex-col gap-4">
      <AvisoNaoHomologado />
      {metodologias.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda p-8 text-center text-texto-secundario">
          Nenhuma metodologia cadastrada. Os critérios institucionais aguardam revisão e homologação.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
          <table className={classeTabela}>
            <thead>
              <tr>
                <th scope="col" className={classeCelulaCabecalho}>Nome</th>
                <th scope="col" className={classeCelulaCabecalho}>Situação</th>
                <th scope="col" className={classeCelulaCabecalho}>Vigência</th>
                <th scope="col" className={`${classeCelulaCabecalho} text-right`}>Critérios</th>
              </tr>
            </thead>
            <tbody>
              {metodologias.map((m) => (
                <tr key={m.id}>
                  <td className={classeCelula}>
                    <Link href={`/metodologias/${m.id}`} className={classeLink}>
                      {m.nome}
                    </Link>
                    {!m.homologada && <span className="block text-xs text-texto-secundario">Não homologada</span>}
                  </td>
                  <td className={classeCelula}>
                    <SeloSituacao tom={m.situacao === "vigente" ? "sucesso" : "neutro"}>
                      {ROTULOS_SITUACAO_METODOLOGIA[m.situacao]}
                    </SeloSituacao>
                  </td>
                  <td className={classeCelula}>
                    {m.vigenteDesde ? `${formatarData(m.vigenteDesde)} a ${m.vigenteAte ? formatarData(m.vigenteAte) : "hoje"}` : "—"}
                  </td>
                  <td className={`${classeCelula} text-right tabular-nums`}>{m.criterios}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
