/**
 * Valores das listas de projetos, temas e contextos, e seus nomes de exibição.
 * Sem dependência do banco, para uso também nas telas; um teste confere se as
 * listas coincidem com as do banco.
 */

export const TIPOS_PROJETO_TEMA = ["projeto", "tema"] as const;

export const ROTULOS_TIPO_PROJETO_TEMA: Record<(typeof TIPOS_PROJETO_TEMA)[number], string> = {
  projeto: "Projeto",
  tema: "Tema",
};

export const SITUACOES_PROJETO_TEMA = ["proposto", "ativo", "suspenso", "concluido"] as const;

export const ROTULOS_SITUACAO_PROJETO_TEMA: Record<(typeof SITUACOES_PROJETO_TEMA)[number], string> = {
  proposto: "Proposto",
  ativo: "Ativo",
  suspenso: "Suspenso",
  concluido: "Concluído",
};

/** Papel do stakeholder no contexto, sem julgamento de poder ou interesse (D-030). */
export const TIPOS_RELACAO = [
  "orgao_competente",
  "parceiro",
  "financiador",
  "executor",
  "beneficiario",
  "representacao_setorial",
  "outro",
] as const;

export const ROTULOS_TIPO_RELACAO: Record<(typeof TIPOS_RELACAO)[number], string> = {
  orgao_competente: "Órgão competente ou regulador",
  parceiro: "Parceiro",
  financiador: "Financiador ou investidor",
  executor: "Executor",
  beneficiario: "Beneficiário ou afetado",
  representacao_setorial: "Representação setorial",
  outro: "Outro",
};

export const TIPOS_COMITE = ["desenvolvimento", "tematico"] as const;

export const ROTULOS_TIPO_COMITE: Record<(typeof TIPOS_COMITE)[number], string> = {
  desenvolvimento: "Comitê de Desenvolvimento",
  tematico: "Comitê temático",
};
