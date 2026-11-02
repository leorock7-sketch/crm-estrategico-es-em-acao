/**
 * Organiza as fichas de um projeto ou tema para a matriz (D-034, D-058): só
 * entram na grade (V2.2) ou no gráfico (demonstração) as avaliações da
 * metodologia vigente com os dois eixos classificados; as demais aparecem em
 * listas próprias, sem ser ocultadas. Escalas e metodologias diferentes nunca
 * são colocadas nos mesmos eixos. A célula é uma leitura, nunca uma conduta (RF-28).
 */
import type { GrauConfianca, NaturezaPosicionamento, Nivel, Posicionamento } from "./rotulos";

export type FichaParaMatriz = {
  stakeholderId: string;
  nome: string;
  tipoStakeholder: "pessoa" | "instituicao";
  /** Associação vigente ao contexto (Etapa 1.1). */
  associado: boolean;
  temRascunho: boolean;
  vigente: {
    numeroVersao: number;
    metodologiaId: string | null;
    metodologiaNome: string | null;
    /** Pontuação de 0 a 100 (metodologia de demonstração). */
    poder: number | null;
    interesse: number | null;
    /** Níveis da escala V2.2. */
    nivelPoder: Nivel | null;
    nivelInteresse: Nivel | null;
    posicionamento: Posicionamento | null;
    naturezaPosicionamento: NaturezaPosicionamento | null;
    grauConfianca: GrauConfianca | null;
    dataReferencia: string;
    proximaRevisao: string;
  } | null;
};

export type FichaAvaliada = FichaParaMatriz & { vigente: NonNullable<FichaParaMatriz["vigente"]> };

export type ClassificacaoMatriz = {
  /** Metodologia vigente, com os dois eixos classificados: vão para a grade ou o gráfico. */
  noGrafico: (FichaAvaliada & { revisaoVencida: boolean })[];
  /** Metodologia vigente, mas com algum eixo "não avaliado" (ou sem pontuação, na demonstração). */
  semPontuacao: FichaAvaliada[];
  /** Avaliação vigente feita com metodologia anterior: histórica, exige reavaliação. */
  metodologiaAnterior: FichaAvaliada[];
  /** Associados ao contexto e ainda sem avaliação publicada. */
  naoAvaliados: FichaParaMatriz[];
  /** Avaliação publicada de quem não está mais associado ao contexto. */
  associacaoEncerrada: FichaAvaliada[];
  /** Quem precisa de reavaliação: metodologia anterior ou revisão anual vencida. */
  exigemReavaliacao: { ficha: FichaAvaliada; motivo: "metodologia_anterior" | "revisao_vencida" }[];
};

/** Os dois eixos classificados: níveis (V2.2) ou pontuações (demonstração). */
function eixosClassificados(v: FichaAvaliada["vigente"]): boolean {
  return (v.nivelPoder !== null && v.nivelInteresse !== null) || (v.poder !== null && v.interesse !== null);
}

/** `hoje` no formato AAAA-MM-DD, para comparar com a data da próxima revisão. */
export function classificarParaMatriz(
  fichas: FichaParaMatriz[],
  metodologiaVigenteId: string | null,
  hoje: string,
): ClassificacaoMatriz {
  const resultado: ClassificacaoMatriz = {
    noGrafico: [],
    semPontuacao: [],
    metodologiaAnterior: [],
    naoAvaliados: [],
    associacaoEncerrada: [],
    exigemReavaliacao: [],
  };
  for (const ficha of fichas) {
    if (!ficha.vigente) {
      if (ficha.associado) resultado.naoAvaliados.push(ficha);
      continue;
    }
    const avaliada = ficha as FichaAvaliada;
    if (!ficha.associado) {
      resultado.associacaoEncerrada.push(avaliada);
      continue;
    }
    const { metodologiaId, proximaRevisao } = avaliada.vigente;
    if (metodologiaId !== null && metodologiaId !== metodologiaVigenteId) {
      resultado.metodologiaAnterior.push(avaliada);
      resultado.exigemReavaliacao.push({ ficha: avaliada, motivo: "metodologia_anterior" });
      continue;
    }
    const revisaoVencida = proximaRevisao < hoje;
    if (revisaoVencida) resultado.exigemReavaliacao.push({ ficha: avaliada, motivo: "revisao_vencida" });
    if (metodologiaId !== null && eixosClassificados(avaliada.vigente)) {
      resultado.noGrafico.push({ ...avaliada, revisaoVencida });
    } else {
      resultado.semPontuacao.push(avaliada);
    }
  }
  return resultado;
}

/** Nome descritivo de cada célula da grade 3 × 3 (Metodologia, seção 6.1; D-058). */
export function nomeDaCelula(poder: Nivel, interesse: Nivel): string {
  if (poder === "medio" && interesse === "medio") return "Zona intermediária central";
  if (poder === "medio" || interesse === "medio") return "Zona intermediária";
  return `${poder === "alto" ? "Alto" : "Baixo"} poder / ${interesse === "alto" ? "alto" : "baixo"} interesse`;
}

/** Fichas de cada célula da grade, com chave "poder|interesse". */
export function agruparPorCelula<T extends FichaAvaliada>(fichas: T[]): Map<string, T[]> {
  const celulas = new Map<string, T[]>();
  for (const ficha of fichas) {
    const { nivelPoder, nivelInteresse } = ficha.vigente;
    if (!nivelPoder || !nivelInteresse) continue;
    const chave = `${nivelPoder}|${nivelInteresse}`;
    celulas.set(chave, [...(celulas.get(chave) ?? []), ficha]);
  }
  return celulas;
}
