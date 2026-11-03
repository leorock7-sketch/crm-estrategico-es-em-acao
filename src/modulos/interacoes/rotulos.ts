/**
 * Valores das listas de interações e compromissos, e seus nomes de exibição.
 * Sem dependência do banco, para uso também nas telas; um teste confere se as
 * listas coincidem com as do banco.
 */

export const TIPOS_INTERACAO = [
  "reuniao_presencial",
  "reuniao_virtual",
  "ligacao",
  "email",
  "evento",
  "visita",
  "outro",
] as const;
export type TipoInteracao = (typeof TIPOS_INTERACAO)[number];

export const ROTULOS_TIPO_INTERACAO: Record<TipoInteracao, string> = {
  reuniao_presencial: "Reunião presencial",
  reuniao_virtual: "Reunião virtual",
  ligacao: "Ligação",
  email: "E-mail",
  evento: "Evento",
  visita: "Visita",
  outro: "Outro",
};

export const SITUACOES_INTERACAO = ["agendada", "realizada", "cancelada"] as const;
export type SituacaoInteracao = (typeof SITUACOES_INTERACAO)[number];

export const ROTULOS_SITUACAO_INTERACAO: Record<SituacaoInteracao, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

export const PRESENCAS_INTERACAO = ["convidado", "presente", "ausente"] as const;
export type PresencaInteracao = (typeof PRESENCAS_INTERACAO)[number];

export const ROTULOS_PRESENCA: Record<PresencaInteracao, string> = {
  convidado: "Convidado",
  presente: "Presente",
  ausente: "Ausente",
};

/** Presença inicial dos participantes, conforme a situação da interação. */
export function presencaInicial(situacao: SituacaoInteracao): PresencaInteracao {
  return situacao === "realizada" ? "presente" : "convidado";
}

export const SITUACOES_COMPROMISSO = ["aberto", "em_andamento", "concluido", "cancelado"] as const;
export type SituacaoCompromisso = (typeof SITUACOES_COMPROMISSO)[number];

export const ROTULOS_SITUACAO_COMPROMISSO: Record<SituacaoCompromisso, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

/** Compromissos ainda pendentes (abertos ou em andamento). */
export const SITUACOES_COMPROMISSO_PENDENTES: readonly SituacaoCompromisso[] = ["aberto", "em_andamento"];

/** Situação do prazo, calculada (o banco não guarda "vencido"). */
export type SituacaoPrazo = "vencido" | "vence_hoje" | "no_prazo" | "sem_prazo" | "encerrado";

export const ROTULOS_SITUACAO_PRAZO: Record<SituacaoPrazo, string> = {
  vencido: "Prazo vencido",
  vence_hoje: "Vence hoje",
  no_prazo: "No prazo",
  sem_prazo: "Sem prazo",
  encerrado: "Encerrado",
};

/** Vencido: prazo anterior a hoje e compromisso ainda aberto ou em andamento. */
export function situacaoDoPrazo(
  compromisso: { situacao: SituacaoCompromisso; prazo: string | null },
  hoje: string,
): SituacaoPrazo {
  if (!SITUACOES_COMPROMISSO_PENDENTES.includes(compromisso.situacao)) return "encerrado";
  if (!compromisso.prazo) return "sem_prazo";
  if (compromisso.prazo < hoje) return "vencido";
  if (compromisso.prazo === hoje) return "vence_hoje";
  return "no_prazo";
}

/** Filtros da lista de compromissos. */
export const FILTROS_COMPROMISSO = ["pendentes", "vencidos", "concluidos", "cancelados", "todos"] as const;
export type FiltroCompromisso = (typeof FILTROS_COMPROMISSO)[number];

export const ROTULOS_FILTRO_COMPROMISSO: Record<FiltroCompromisso, string> = {
  pendentes: "Pendentes (abertos ou em andamento)",
  vencidos: "Com prazo vencido",
  concluidos: "Concluídos",
  cancelados: "Cancelados",
  todos: "Todos",
};

/** Filtro de período da lista de interações. */
export const PERIODOS_INTERACAO = ["futuras", "passadas"] as const;
export type PeriodoInteracao = (typeof PERIODOS_INTERACAO)[number];

export const ROTULOS_PERIODO_INTERACAO: Record<PeriodoInteracao, string> = {
  futuras: "Agenda (a partir de hoje)",
  passadas: "Já ocorridas",
};
