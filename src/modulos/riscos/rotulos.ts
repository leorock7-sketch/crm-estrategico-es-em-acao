/**
 * Parâmetros da Matriz de Riscos 5 × 5 do Comitê de Infraestrutura (D-072),
 * reproduzidos do instrumento original (aba "Critérios"): escalas de
 * probabilidade e impacto, criticidade = probabilidade × impacto, faixas,
 * classificações, cores, prioridade de tratamento e status. O banco calcula a
 * criticidade e a classificação com as mesmas faixas; um teste confere.
 */

export type Nivel5 = 1 | 2 | 3 | 4 | 5;
export const NIVEIS_5: readonly Nivel5[] = [1, 2, 3, 4, 5];

export const PROBABILIDADES: Record<Nivel5, { rotulo: string; criterio: string }> = {
  1: { rotulo: "Remota", criterio: "Sem sinais concretos e sem precedentes recentes." },
  2: { rotulo: "Baixa", criterio: "Possível, mas pouco provável no ciclo atual." },
  3: { rotulo: "Média", criterio: "Há sinais ou antecedentes relevantes." },
  4: { rotulo: "Alta", criterio: "Risco recorrente ou com forte indício de ocorrência." },
  5: { rotulo: "Muito alta", criterio: "Risco já em curso ou muito provável no curto prazo." },
};

export const IMPACTOS: Record<Nivel5, { rotulo: string; criterio: string }> = {
  1: { rotulo: "Muito baixo", criterio: "Afeta atividade pontual, sem prejuízo relevante ao objetivo." },
  2: { rotulo: "Baixo", criterio: "Gera pequeno atraso ou retrabalho pontual." },
  3: { rotulo: "Médio", criterio: "Compromete parcialmente uma ação ou reduz sua qualidade." },
  4: { rotulo: "Alto", criterio: "Compromete agenda relevante, ator crítico ou marco importante." },
  5: { rotulo: "Muito alto", criterio: "Compromete legitimidade, governança ou capacidade de influência do comitê." },
};

export const CLASSIFICACOES = ["baixo", "moderado", "alto", "critico"] as const;
export type Classificacao = (typeof CLASSIFICACOES)[number];

/** Faixas de criticidade, cores e prioridade de tratamento da matriz original. */
export const FAIXAS: Record<Classificacao, { rotulo: string; minimo: number; maximo: number; cor: string; prioridade: string }> = {
  baixo: { rotulo: "Baixo", minimo: 1, maximo: 4, cor: "#E2F0D9", prioridade: "Manter controles" },
  moderado: { rotulo: "Moderado", minimo: 5, maximo: 9, cor: "#FFF2CC", prioridade: "Monitorar com controles e revisão periódica" },
  alto: { rotulo: "Alto", minimo: 10, maximo: 16, cor: "#FCE4D6", prioridade: "Mitigar com roteiro de atuação" },
  critico: { rotulo: "Crítico", minimo: 17, maximo: 25, cor: "#F4CCCC", prioridade: "Escalonar imediatamente" },
};

/** Criticidade = probabilidade × impacto (de 1 a 25). */
export function criticidade(probabilidade: number, impacto: number): number {
  return probabilidade * impacto;
}

/** Classificação pela faixa de criticidade. */
export function classificar(valor: number): Classificacao {
  if (valor <= FAIXAS.baixo.maximo) return "baixo";
  if (valor <= FAIXAS.moderado.maximo) return "moderado";
  if (valor <= FAIXAS.alto.maximo) return "alto";
  return "critico";
}

export const SITUACOES_RISCO = ["aberto", "em_mitigacao", "monitorado", "mitigado", "escalonado"] as const;
export type SituacaoRisco = (typeof SITUACOES_RISCO)[number];

export const ROTULOS_SITUACAO_RISCO: Record<SituacaoRisco, string> = {
  aberto: "Aberto",
  em_mitigacao: "Em mitigação",
  monitorado: "Monitorado",
  mitigado: "Mitigado",
  escalonado: "Escalonado",
};

export const DESCRICOES_SITUACAO_RISCO: Record<SituacaoRisco, string> = {
  aberto: "O risco foi identificado, mas ainda não possui tratamento estruturado implementado.",
  em_mitigacao: "Existem ações concretas em andamento para reduzir probabilidade e/ou impacto.",
  monitorado: "O risco está sob controle, sem necessidade de novas ações no momento, mas exige vigilância.",
  mitigado: "O risco foi reduzido a um nível baixo ou aceitável, com baixa probabilidade de impacto relevante.",
  escalonado: "O risco ultrapassou a capacidade de gestão do nível atual e precisa de decisão ou intervenção superior.",
};

export const TIPOS_AVALIACAO = ["inerente", "residual"] as const;
export type TipoAvaliacao = (typeof TIPOS_AVALIACAO)[number];

export const ROTULOS_TIPO_AVALIACAO: Record<TipoAvaliacao, string> = {
  inerente: "Risco inerente",
  residual: "Risco residual",
};

/** Definições adotadas (D-072, item 3.1). */
export const DESCRICOES_TIPO_AVALIACAO: Record<TipoAvaliacao, string> = {
  inerente: "Avaliação do risco antes de considerar os controles e as medidas de mitigação.",
  residual:
    "Avaliação do risco remanescente depois de considerar os controles efetivamente implementados e a sua eficácia. Medidas apenas planejadas não contam como controles eficazes.",
};

export const ESTRATEGIAS_RESPOSTA = ["evitar", "mitigar", "transferir", "aceitar"] as const;
export type EstrategiaResposta = (typeof ESTRATEGIAS_RESPOSTA)[number];

export const ROTULOS_ESTRATEGIA: Record<EstrategiaResposta, string> = {
  evitar: "Evitar",
  mitigar: "Mitigar",
  transferir: "Transferir",
  aceitar: "Aceitar",
};

export const SITUACOES_RESPOSTA = ["planejada", "em_execucao", "concluida", "cancelada"] as const;
export type SituacaoResposta = (typeof SITUACOES_RESPOSTA)[number];

export const ROTULOS_SITUACAO_RESPOSTA: Record<SituacaoResposta, string> = {
  planejada: "Planejada",
  em_execucao: "Em execução",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/** Significado da ocorrência do gatilho, conforme a matriz original. */
export const SIGNIFICADO_GATILHO = {
  ocorrido: "O risco está se materializando ou se aproximando de um nível crítico: reavaliação e ação imediata.",
  naoOcorrido: "O risco permanece com o mesmo status.",
} as const;
