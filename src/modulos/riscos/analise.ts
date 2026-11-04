/**
 * Regras de leitura da Matriz de Riscos, sem dependência do banco (D-072, itens
 * 3.1 a 3.5): última avaliação inerente e residual, avaliação vigente, sinais
 * de reavaliação e comparação entre inerente e residual. Nenhuma regra aqui
 * reduz a avaliação de um risco: só uma nova avaliação fundamentada o faz.
 */
import { type Classificacao, type Nivel5, type TipoAvaliacao } from "./rotulos";

export type AvaliacaoResumo = {
  tipo: TipoAvaliacao;
  dataAvaliacao: string;
  probabilidade: number;
  impacto: number;
  criticidade: number;
  classificacao: Classificacao;
  criadoEm: Date | string;
};

const maisRecente = (a: AvaliacaoResumo, b: AvaliacaoResumo) =>
  a.dataAvaliacao !== b.dataAvaliacao
    ? a.dataAvaliacao > b.dataAvaliacao
    : new Date(a.criadoEm).getTime() > new Date(b.criadoEm).getTime();

/** Última avaliação de cada tipo (pela data da avaliação; no empate, a registrada por último). */
export function ultimasAvaliacoes(avaliacoes: readonly AvaliacaoResumo[]) {
  let inerente: AvaliacaoResumo | null = null;
  let residual: AvaliacaoResumo | null = null;
  for (const a of avaliacoes) {
    if (a.tipo === "inerente" && (!inerente || maisRecente(a, inerente))) inerente = a;
    if (a.tipo === "residual" && (!residual || maisRecente(a, residual))) residual = a;
  }
  return { inerente, residual };
}

/**
 * Avaliação vigente do risco: a residual mais recente, se houver; senão, a
 * inerente. A residual só existe quando alguém a registra, com justificativa,
 * considerando os controles efetivamente implementados.
 */
export function avaliacaoVigente(ultimas: { inerente: AvaliacaoResumo | null; residual: AvaliacaoResumo | null }) {
  return ultimas.residual ?? ultimas.inerente;
}

/**
 * Sinais de que o risco precisa ser reavaliado. Não alteram a avaliação: a
 * ocorrência de gatilho sinaliza a necessidade de análise (D-072, item 3.3).
 */
export function motivosReavaliacao(dados: {
  ultimaAvaliacaoEm: string | null;
  gatilhosOcorridosEm: readonly string[];
  proximaRevisao: string | null;
  hoje: string;
}): string[] {
  const motivos: string[] = [];
  const posteriores = dados.gatilhosOcorridosEm.filter((d) => !dados.ultimaAvaliacaoEm || d >= dados.ultimaAvaliacaoEm);
  if (posteriores.length > 0) motivos.push("Gatilho ocorrido depois da última avaliação.");
  if (dados.proximaRevisao && dados.proximaRevisao < dados.hoje) motivos.push("Data de revisão vencida.");
  return motivos;
}

/**
 * Comparação entre o risco inerente e o residual em pontos do índice de
 * criticidade e em classificação. Não é uma redução percentual da exposição:
 * o índice é ordinal (probabilidade × impacto em escalas de 1 a 5).
 */
export function compararInerenteResidual(inerente: AvaliacaoResumo | null, residual: AvaliacaoResumo | null) {
  if (!inerente || !residual) return null;
  return {
    variacaoIndice: residual.criticidade - inerente.criticidade,
    mudouClassificacao: residual.classificacao !== inerente.classificacao,
  };
}

/** Quantidade de riscos em cada célula da matriz: [probabilidade][impacto], de 1 a 5. */
export function distribuicaoNaMatriz(avaliacoes: readonly (Pick<AvaliacaoResumo, "probabilidade" | "impacto"> | null)[]) {
  const celulas = new Map<string, number>();
  for (const a of avaliacoes) {
    if (!a) continue;
    const chave = `${a.probabilidade}-${a.impacto}`;
    celulas.set(chave, (celulas.get(chave) ?? 0) + 1);
  }
  return (probabilidade: Nivel5, impacto: Nivel5) => celulas.get(`${probabilidade}-${impacto}`) ?? 0;
}
