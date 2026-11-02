import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeCartao, classeCelula, classeCelulaCabecalho, classeTabela } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { AvisoNaoHomologado } from "@/modulos/avaliacoes/componentes/avisos";
import { obterMetodologia } from "@/modulos/avaliacoes/consultas";
import { DIMENSOES, ROTULOS_DIMENSAO, ROTULOS_SITUACAO_METODOLOGIA } from "@/modulos/avaliacoes/rotulos";

export const metadata: Metadata = { title: "Metodologia de avaliação" };

export default function PaginaMetodologia({ params }: PageProps<"/metodologias/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheMetodologia params={params} />
    </Suspense>
  );
}

async function DetalheMetodologia({ params }: Pick<PageProps<"/metodologias/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const metodologia = await obterMetodologia(banco, id);
  if (!metodologia) notFound();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={metodologia.nome}
        voltar={{ href: "/metodologias", rotulo: "Metodologias" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <SeloSituacao tom={metodologia.situacao === "vigente" ? "sucesso" : "neutro"}>
              {ROTULOS_SITUACAO_METODOLOGIA[metodologia.situacao]}
            </SeloSituacao>
            {metodologia.vigenteDesde && (
              <span>
                Vigência: {formatarData(metodologia.vigenteDesde)} a{" "}
                {metodologia.vigenteAte ? formatarData(metodologia.vigenteAte) : "hoje"}
              </span>
            )}
          </span>
        }
      />
      {!metodologia.homologada && <AvisoNaoHomologado />}
      {metodologia.descricao && (
        <p className="whitespace-pre-line text-sm text-texto-secundario">{metodologia.descricao}</p>
      )}
      <section className={classeCartao} aria-labelledby="titulo-calculo">
        <h2 id="titulo-calculo" className="mb-1 text-lg font-semibold">
          Cálculo
        </h2>
        <p className="text-sm text-texto-secundario">
          Cálculo de demonstração: cada nota é convertida para a escala de 0 a 100 e é feita a média ponderada pelos
          pesos (peso vazio conta como 1). Se faltar a nota de algum critério, a dimensão fica sem pontuação. A fórmula
          institucional depende da revisão dos seis critérios originais.
        </p>
      </section>
      {DIMENSOES.map((dimensao) => {
        const criterios = metodologia.criterios.filter((c) => c.dimensao === dimensao);
        return (
          <section key={dimensao} className={classeCartao} aria-labelledby={`titulo-${dimensao}`}>
            <h2 id={`titulo-${dimensao}`} className="mb-4 text-lg font-semibold">
              Critérios de {ROTULOS_DIMENSAO[dimensao].toLowerCase()} ({criterios.length})
            </h2>
            {criterios.length === 0 ? (
              <p className="text-sm text-texto-secundario">Nenhum critério.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={classeTabela}>
                  <thead>
                    <tr>
                      <th scope="col" className={classeCelulaCabecalho}>Critério</th>
                      <th scope="col" className={classeCelulaCabecalho}>Escala</th>
                      <th scope="col" className={`${classeCelulaCabecalho} text-right`}>Peso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criterios.map((c) => (
                      <tr key={c.id}>
                        <td className={classeCelula}>
                          <span className="font-medium">{c.nome}</span>
                          {c.descricao && <span className="block text-xs text-texto-secundario">{c.descricao}</span>}
                        </td>
                        <td className={classeCelula}>
                          {c.escalaMinima} a {c.escalaMaxima}
                        </td>
                        <td className={`${classeCelula} text-right tabular-nums`}>{c.peso ?? "1 (padrão)"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
