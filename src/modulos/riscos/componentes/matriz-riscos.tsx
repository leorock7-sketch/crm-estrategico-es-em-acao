import Link from "next/link";
import { type AvaliacaoResumo, distribuicaoNaMatriz } from "../analise";
import { classificar, criticidade, FAIXAS, IMPACTOS, NIVEIS_5, type Classificacao, PROBABILIDADES } from "../rotulos";

/** Texto escuro fixo sobre as cores claras da matriz original, legível também no modo escuro. */
const TEXTO_SOBRE_COR = "#1f2937";

/** Selo da classificação com a cor institucional da faixa e, se informada, a criticidade. */
export function SeloClassificacao({ classificacao, valor }: { classificacao: Classificacao; valor?: number }) {
  const faixa = FAIXAS[classificacao];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-black/10 px-3 py-1 text-sm font-semibold"
      style={{ backgroundColor: faixa.cor, color: TEXTO_SOBRE_COR }}
    >
      {faixa.rotulo}
      {valor !== undefined && <span className="font-normal tabular-nums">· {valor}</span>}
    </span>
  );
}

/** Avaliação resumida: P × I = criticidade, com o selo da classificação. */
export function ResumoAvaliacao({ avaliacao }: { avaliacao: Pick<AvaliacaoResumo, "probabilidade" | "impacto" | "criticidade" | "classificacao"> | null }) {
  if (!avaliacao) return <span className="text-texto-secundario">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <SeloClassificacao classificacao={avaliacao.classificacao} valor={avaliacao.criticidade} />
      <span className="text-xs text-texto-secundario tabular-nums">
        P{avaliacao.probabilidade} × I{avaliacao.impacto}
      </span>
    </span>
  );
}

/**
 * Matriz 5 × 5 do Comitê de Infraestrutura: probabilidade nas linhas (5 a 1),
 * impacto nas colunas (1 a 5); cada célula mostra a criticidade, a cor da faixa
 * e, se houver, a quantidade de riscos nela.
 */
export function MatrizRiscos({
  titulo,
  descricao,
  avaliacoes,
  linkCelula,
}: {
  titulo: string;
  descricao?: string;
  avaliacoes: readonly (Pick<AvaliacaoResumo, "probabilidade" | "impacto"> | null)[];
  /** Endereço para listar os riscos de uma célula (opcional). */
  linkCelula?: (probabilidade: number, impacto: number) => string;
}) {
  const quantidade = distribuicaoNaMatriz(avaliacoes);
  const total = avaliacoes.filter(Boolean).length;
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption>
        <span className="font-semibold">{titulo}</span>
        <span className="text-sm text-texto-secundario"> · {total === 1 ? "1 risco" : `${total} riscos`}</span>
        {descricao && <span className="block text-xs text-texto-secundario">{descricao}</span>}
      </figcaption>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[18rem] table-fixed border-separate border-spacing-1 text-center text-xs">
          <caption className="sr-only">
            {titulo}: probabilidade nas linhas e impacto nas colunas; cada célula mostra a criticidade e a quantidade de riscos.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-16 text-left font-normal text-texto-secundario">
                P \ I
              </th>
              {NIVEIS_5.map((i) => (
                <th key={i} scope="col" className="font-semibold" title={`${IMPACTOS[i].rotulo}: ${IMPACTOS[i].criterio}`}>
                  {i}
                  <span className="block font-normal text-texto-secundario">{IMPACTOS[i].rotulo}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...NIVEIS_5].reverse().map((p) => (
              <tr key={p}>
                <th scope="row" className="text-left font-semibold" title={`${PROBABILIDADES[p].rotulo}: ${PROBABILIDADES[p].criterio}`}>
                  {p}
                  <span className="block font-normal text-texto-secundario">{PROBABILIDADES[p].rotulo}</span>
                </th>
                {NIVEIS_5.map((i) => {
                  const valor = criticidade(p, i);
                  const faixa = FAIXAS[classificar(valor)];
                  const n = quantidade(p, i);
                  const conteudo = (
                    <>
                      <span className="block text-[0.65rem] opacity-70 tabular-nums">{valor}</span>
                      <span className="block text-base font-bold leading-tight tabular-nums">{n > 0 ? n : " "}</span>
                    </>
                  );
                  return (
                    <td
                      key={i}
                      className={`h-12 rounded-md border ${n > 0 ? "border-black/40" : "border-black/5"}`}
                      style={{ backgroundColor: faixa.cor, color: TEXTO_SOBRE_COR }}
                      aria-label={`Probabilidade ${p}, impacto ${i}: criticidade ${valor} (${faixa.rotulo}), ${n} risco${n === 1 ? "" : "s"}`}
                    >
                      {n > 0 && linkCelula ? (
                        <Link href={linkCelula(p, i)} className="block hover:underline">
                          {conteudo}
                        </Link>
                      ) : (
                        conteudo
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Legenda das faixas da matriz original: criticidade, classificação e prioridade de tratamento. */
export function LegendaFaixas() {
  return (
    <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {(Object.keys(FAIXAS) as Classificacao[]).map((c) => (
        <li key={c} className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded border border-black/10" style={{ backgroundColor: FAIXAS[c].cor }} />
          <span>
            <span className="font-semibold">{FAIXAS[c].rotulo}</span>{" "}
            <span className="text-texto-secundario tabular-nums">
              ({FAIXAS[c].minimo} a {FAIXAS[c].maximo})
            </span>
            <span className="block text-xs text-texto-secundario">{FAIXAS[c].prioridade}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Comparação entre o inerente e o residual em pontos do índice e na
 * classificação, sem percentual: o índice é ordinal e não mede a exposição real.
 */
export function ComparacaoInerenteResidual({
  inerente,
  residual,
}: {
  inerente: Pick<AvaliacaoResumo, "criticidade" | "classificacao"> | null;
  residual: Pick<AvaliacaoResumo, "criticidade" | "classificacao"> | null;
}) {
  if (!inerente) return <span className="text-texto-secundario">—</span>;
  if (!residual) return <span className="text-texto-secundario">Residual ainda não avaliado</span>;
  const variacao = residual.criticidade - inerente.criticidade;
  const sinal = variacao > 0 ? "+" : "";
  const classe =
    residual.classificacao === inerente.classificacao
      ? "mesma classificação"
      : `de ${FAIXAS[inerente.classificacao].rotulo.toLowerCase()} para ${FAIXAS[residual.classificacao].rotulo.toLowerCase()}`;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {inerente.criticidade} → {residual.criticidade}{" "}
      <span className="text-texto-secundario">
        ({variacao === 0 ? "sem variação" : `${sinal}${variacao} pontos`}; {classe})
      </span>
    </span>
  );
}
