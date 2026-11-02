/**
 * Cálculo de DEMONSTRAÇÃO do poder e do interesse (D-034): média ponderada das
 * notas, cada uma convertida para a escala de 0 a 100. Vale só para as
 * metodologias de demonstração; na escala V2.2 não há cálculo (D-058, T21).
 * Também a tendência do posicionamento, só entre avaliações comparáveis (T-6).
 * Funções puras, sem acesso ao banco, para que possam ser testadas isoladamente.
 */
import { POSICIONAMENTOS, type Posicionamento } from "./rotulos";

export type CriterioParaCalculo = {
  id: string;
  dimensao: "poder" | "interesse";
  escalaMinima: number;
  escalaMaxima: number;
  peso: number | null;
};

/**
 * Valor consolidado de uma dimensão, de 0 a 100. Devolve null quando algum
 * critério da dimensão está sem nota: falta de nota nunca vale zero.
 * Critérios sem peso contam com peso 1.
 */
export function calcularDimensao(
  criterios: CriterioParaCalculo[],
  notas: ReadonlyMap<string, number>,
  dimensao: CriterioParaCalculo["dimensao"],
): number | null {
  const daDimensao = criterios.filter((c) => c.dimensao === dimensao);
  if (daDimensao.length === 0) return null;
  let soma = 0;
  let somaPesos = 0;
  for (const criterio of daDimensao) {
    const nota = notas.get(criterio.id);
    if (nota === undefined) return null;
    const peso = criterio.peso ?? 1;
    const normalizada = ((nota - criterio.escalaMinima) / (criterio.escalaMaxima - criterio.escalaMinima)) * 100;
    soma += normalizada * peso;
    somaPesos += peso;
  }
  if (somaPesos === 0) return null;
  return Math.round((soma / somaPesos) * 100) / 100;
}

export function calcularResultado(criterios: CriterioParaCalculo[], notas: ReadonlyMap<string, number>) {
  return {
    poder: calcularDimensao(criterios, notas, "poder"),
    interesse: calcularDimensao(criterios, notas, "interesse"),
  };
}

export type Tendencia = "mais_favoravel" | "estavel" | "menos_favoravel" | "nao_comparavel";

/** Ligações de uma metodologia com a anterior, para decidir se duas avaliações são comparáveis. */
export type LigacaoMetodologia = {
  anteriorId: string | null;
  naturezaAlteracao: "substantiva" | "editorial" | null;
  equivalentePosicionamentoA: string | null;
};

/**
 * Duas avaliações são metodologicamente comparáveis (T-6, D-064) quando usam a
 * mesma metodologia, quando a mais nova chega à mais antiga só por alterações
 * editoriais aprovadas, ou quando há equivalência de posicionamento declarada.
 * A mesma escala não basta. Versões sem metodologia (anteriores à Etapa 2B)
 * só se comparam entre si.
 */
export function metodologiasComparaveis(
  atualId: string | null,
  anteriorId: string | null,
  ligacoes: ReadonlyMap<string, LigacaoMetodologia>,
): boolean {
  if (atualId === anteriorId) return true;
  if (atualId === null || anteriorId === null) return false;
  const visitadas = new Set<string>();
  let corrente: string | null = atualId;
  while (corrente && !visitadas.has(corrente)) {
    visitadas.add(corrente);
    const ligacao = ligacoes.get(corrente);
    if (!ligacao) return false;
    if (ligacao.equivalentePosicionamentoA === anteriorId) return true;
    if (ligacao.naturezaAlteracao !== "editorial") return false;
    if (ligacao.anteriorId === anteriorId) return true;
    corrente = ligacao.anteriorId;
  }
  return false;
}

/**
 * Tendência do posicionamento em relação à versão anterior. Só existe quando as
 * duas versões têm posicionamento: "não avaliado" não entra na comparação. Entre
 * metodologias não comparáveis, a tendência é "não comparável" (T-6).
 */
export function tendenciaDoPosicionamento(
  atual: Posicionamento | null,
  anterior: Posicionamento | null,
  comparaveis = true,
): Tendencia | null {
  if (!atual || !anterior) return null;
  if (!comparaveis) return "nao_comparavel";
  // Na lista, índice menor significa mais favorável.
  const diferenca = POSICIONAMENTOS.indexOf(anterior) - POSICIONAMENTOS.indexOf(atual);
  if (diferenca > 0) return "mais_favoravel";
  if (diferenca < 0) return "menos_favoravel";
  return "estavel";
}
