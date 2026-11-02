/**
 * Cálculo de DEMONSTRAÇÃO do poder e do interesse (D-034): média ponderada das
 * notas, cada uma convertida para a escala de 0 a 100. Não é a fórmula
 * institucional, que depende da revisão dos seis critérios originais (Etapa 2B).
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

export type Tendencia = "mais_favoravel" | "estavel" | "menos_favoravel";

/**
 * Tendência do posicionamento em relação à versão anterior. Só existe quando as
 * duas versões têm posicionamento: "não avaliado" não entra na comparação.
 * O posicionamento não depende da metodologia, por isso pode ser comparado.
 */
export function tendenciaDoPosicionamento(
  atual: Posicionamento | null,
  anterior: Posicionamento | null,
): Tendencia | null {
  if (!atual || !anterior) return null;
  // Na lista, índice menor significa mais favorável.
  const diferenca = POSICIONAMENTOS.indexOf(anterior) - POSICIONAMENTOS.indexOf(atual);
  if (diferenca > 0) return "mais_favoravel";
  if (diferenca < 0) return "menos_favoravel";
  return "estavel";
}
