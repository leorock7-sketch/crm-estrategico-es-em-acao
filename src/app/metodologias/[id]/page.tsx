import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeCartao, classeCelula, classeCelulaCabecalho, classeTabela } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import Link from "next/link";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { AvisoDaMetodologia } from "@/modulos/avaliacoes/componentes/avisos";
import { obterMetodologia } from "@/modulos/avaliacoes/consultas";
import {
  DIMENSOES,
  DIMENSOES_RUBRICA,
  NIVEIS_DA_RUBRICA,
  ROTULOS_DIMENSAO,
  ROTULOS_DIMENSAO_RUBRICA,
  ROTULOS_ESCALA_PODER_INTERESSE,
  ROTULOS_ESCALA_POSICIONAMENTO,
  ROTULOS_NATUREZA_ALTERACAO,
  ROTULOS_SITUACAO_METODOLOGIA,
  rotuloNivelDaRubrica,
} from "@/modulos/avaliacoes/rotulos";

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
      <AvisoDaMetodologia metodologia={metodologia} />
      {metodologia.descricao && (
        <p className="whitespace-pre-line text-sm text-texto-secundario">{metodologia.descricao}</p>
      )}
      <section className={classeCartao} aria-labelledby="titulo-escala">
        <h2 id="titulo-escala" className="mb-3 text-lg font-semibold">
          Escalas e versão
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-texto-secundario">Poder e interesse</dt>
            <dd>{ROTULOS_ESCALA_PODER_INTERESSE[metodologia.escalaPoderInteresse]}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Posicionamento</dt>
            <dd>{ROTULOS_ESCALA_POSICIONAMENTO[metodologia.escalaPosicionamento]}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Versão anterior</dt>
            <dd>
              {metodologia.metodologiaAnteriorId ? (
                <Link href={`/metodologias/${metodologia.metodologiaAnteriorId}`} className="underline">
                  {metodologia.anteriorNome}
                </Link>
              ) : (
                "Nenhuma (primeira versão desta linha)"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Natureza da alteração (D-064)</dt>
            <dd>
              {metodologia.naturezaAlteracao ? ROTULOS_NATUREZA_ALTERACAO[metodologia.naturezaAlteracao] : "—"}
              {metodologia.naturezaAprovadaEm && (
                <span className="block text-xs text-texto-secundario">
                  Aprovada por {metodologia.aprovadorNome ?? "—"} em {formatarDataHora(metodologia.naturezaAprovadaEm)}
                </span>
              )}
            </dd>
          </div>
          {metodologia.justificativaNatureza && (
            <div className="sm:col-span-2">
              <dt className="text-texto-secundario">Justificativa da natureza</dt>
              <dd className="whitespace-pre-line">{metodologia.justificativaNatureza}</dd>
            </div>
          )}
          {metodologia.equivalentePosicionamentoA && (
            <div className="sm:col-span-2">
              <dt className="text-texto-secundario">Equivalência de posicionamento declarada (T-6)</dt>
              <dd>
                Com {metodologia.equivalenteNome}: {metodologia.justificativaEquivalencia}
              </dd>
            </div>
          )}
        </dl>
      </section>
      {metodologia.escalaPoderInteresse !== "demonstracao_numerica" ? (
        DIMENSOES_RUBRICA.map((dimensao) => {
          const rubricas = NIVEIS_DA_RUBRICA[dimensao]
            .map((nivel) => metodologia.rubricas.find((r) => r.dimensao === dimensao && r.nivel === nivel))
            .filter((r) => r !== undefined);
          return (
            <section key={dimensao} className={classeCartao} aria-labelledby={`titulo-rubrica-${dimensao}`}>
              <h2 id={`titulo-rubrica-${dimensao}`} className="mb-1 text-lg font-semibold">
                Rubrica de {ROTULOS_DIMENSAO_RUBRICA[dimensao].toLowerCase()}
              </h2>
              <p className="mb-4 text-sm text-texto-secundario">Orientação do julgamento profissional, não regra rígida.</p>
              {rubricas.length === 0 ? (
                <p className="text-sm text-texto-secundario">Nenhuma rubrica.</p>
              ) : (
                <dl className="flex flex-col gap-3 text-sm">
                  {rubricas.map((r) => (
                    <div key={r.id}>
                      <dt className="font-medium">{rotuloNivelDaRubrica(r.nivel)}</dt>
                      <dd className="text-texto-secundario">
                        {r.criterioOrientador}
                        {r.basesTipicas && <span className="mt-0.5 block text-xs">Bases típicas: {r.basesTipicas}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          );
        })
      ) : (
      <>
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
      </>
      )}
    </div>
  );
}
