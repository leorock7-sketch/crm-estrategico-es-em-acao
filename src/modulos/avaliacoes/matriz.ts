/**
 * Organiza as fichas de um projeto ou tema para a matriz (D-034): só entram no
 * gráfico as avaliações da metodologia vigente com poder e interesse; as demais
 * aparecem em listas próprias, sem ser ocultadas. Pontuações de metodologias
 * diferentes nunca são colocadas nos mesmos eixos.
 */
import type { GrauConfianca, Posicionamento } from "./rotulos";

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
    poder: number | null;
    interesse: number | null;
    posicionamento: Posicionamento | null;
    grauConfianca: GrauConfianca | null;
    dataReferencia: string;
    proximaRevisao: string;
  } | null;
};

export type FichaAvaliada = FichaParaMatriz & { vigente: NonNullable<FichaParaMatriz["vigente"]> };

export type ClassificacaoMatriz = {
  /** Metodologia vigente, com poder e interesse: vão para o gráfico. */
  noGrafico: (FichaAvaliada & { revisaoVencida: boolean })[];
  /** Metodologia vigente (ou nenhuma), mas sem poder ou interesse calculados. */
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
    const { metodologiaId, poder, interesse, proximaRevisao } = avaliada.vigente;
    if (metodologiaId !== null && metodologiaId !== metodologiaVigenteId) {
      resultado.metodologiaAnterior.push(avaliada);
      resultado.exigemReavaliacao.push({ ficha: avaliada, motivo: "metodologia_anterior" });
      continue;
    }
    const revisaoVencida = proximaRevisao < hoje;
    if (revisaoVencida) resultado.exigemReavaliacao.push({ ficha: avaliada, motivo: "revisao_vencida" });
    if (metodologiaId !== null && poder !== null && interesse !== null) {
      resultado.noGrafico.push({ ...avaliada, revisaoVencida });
    } else {
      resultado.semPontuacao.push(avaliada);
    }
  }
  return resultado;
}
