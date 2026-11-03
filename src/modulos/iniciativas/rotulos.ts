/**
 * Valores das listas de iniciativas e seus nomes de exibição. Sem dependência
 * do banco, para uso também nas telas; um teste confere se as listas coincidem
 * com as do banco. Situações, prioridade e papéis são propostas provisórias
 * (docs/MATRIZ_INICIATIVAS.md; Q-21 e Q-23), reversíveis.
 */

export const TIPOS_INICIATIVA = ["demanda", "reuniao_relevante", "frente_atuacao"] as const;
export type TipoIniciativa = (typeof TIPOS_INICIATIVA)[number];

export const ROTULOS_TIPO_INICIATIVA: Record<TipoIniciativa, string> = {
  demanda: "Demanda",
  reuniao_relevante: "Reunião relevante",
  frente_atuacao: "Frente de atuação",
};

/** Explicação curta de cada tipo, exibida no formulário. */
export const AJUDA_TIPO_INICIATIVA: Record<TipoIniciativa, string> = {
  demanda: "Pedido ou necessidade apresentada ao ES em Ação.",
  reuniao_relevante:
    "Assunto acompanhado por meio de encontros estratégicos; cada encontro é registrado uma única vez em Interações.",
  frente_atuacao: "Linha de trabalho contínua.",
};

export const SITUACOES_INICIATIVA = [
  "registrada",
  "em_analise",
  "em_andamento",
  "suspensa",
  "concluida",
  "cancelada",
] as const;
export type SituacaoIniciativa = (typeof SITUACOES_INICIATIVA)[number];

export const ROTULOS_SITUACAO_INICIATIVA: Record<SituacaoIniciativa, string> = {
  registrada: "Registrada",
  em_analise: "Em análise",
  em_andamento: "Em andamento",
  suspensa: "Suspensa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/** Situações de iniciativa ainda em curso (filtro "em curso"). */
export const SITUACOES_INICIATIVA_EM_CURSO: readonly SituacaoIniciativa[] = [
  "registrada",
  "em_analise",
  "em_andamento",
  "suspensa",
];

export const PRIORIDADES_INICIATIVA = ["alta", "media", "baixa"] as const;
export type PrioridadeIniciativa = (typeof PRIORIDADES_INICIATIVA)[number];

export const ROTULOS_PRIORIDADE_INICIATIVA: Record<PrioridadeIniciativa, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const PAPEIS_INICIATIVA = ["demandante", "apoiador", "decisor", "executor", "afetado", "outro"] as const;
export type PapelIniciativa = (typeof PAPEIS_INICIATIVA)[number];

export const ROTULOS_PAPEL_INICIATIVA: Record<PapelIniciativa, string> = {
  demandante: "Demandante",
  apoiador: "Apoiador",
  decisor: "Decisor",
  executor: "Executor",
  afetado: "Afetado",
  outro: "Outro",
};
