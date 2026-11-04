/**
 * Valores das listas do Plano de Ação e seus nomes de exibição. Sem
 * dependência do banco, para uso também nas telas; um teste confere se as
 * listas coincidem com as do banco.
 */

export const SITUACOES_VERSAO_PLANO = ["rascunho", "em_aprovacao", "aprovada", "rejeitada", "substituida"] as const;
export type SituacaoVersaoPlano = (typeof SITUACOES_VERSAO_PLANO)[number];

export const ROTULOS_SITUACAO_VERSAO: Record<SituacaoVersaoPlano, string> = {
  rascunho: "Rascunho",
  em_aprovacao: "Em aprovação",
  aprovada: "Aprovada (vigente)",
  rejeitada: "Rejeitada",
  substituida: "Substituída",
};

export const DECISOES_PLANO = ["enviada", "devolvida", "aprovada", "rejeitada"] as const;
export type DecisaoPlano = (typeof DECISOES_PLANO)[number];

export const ROTULOS_DECISAO: Record<DecisaoPlano, string> = {
  enviada: "Enviada para aprovação",
  devolvida: "Devolvida para ajustes",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

export const PERIODICIDADES = ["mensal", "bimestral", "trimestral", "semestral", "anual"] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];

export const ROTULOS_PERIODICIDADE: Record<Periodicidade, string> = {
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const SITUACOES_ACAO = ["nao_iniciada", "em_andamento", "concluida", "suspensa", "cancelada"] as const;
export type SituacaoAcao = (typeof SITUACOES_ACAO)[number];

export const ROTULOS_SITUACAO_ACAO: Record<SituacaoAcao, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
};

/**
 * Pilares de referência do Comitê de Infraestrutura (D-072, item 2.1): modelo
 * oferecido ao criar o plano, nunca obrigatório; cada plano pode ter os seus eixos.
 */
export const PILARES_REFERENCIA_INFRAESTRUTURA = [
  { codigo: "P1", nome: "Institucional / Governança" },
  { codigo: "P2", nome: "Regulatório / Procedimental" },
  { codigo: "P3", nome: "Técnico-Estratégico" },
  { codigo: "P4", nome: "Operacional Indireto / Prontidão" },
  { codigo: "P5", nome: "Comunicação / Transparência / Licença Social" },
] as const;

/**
 * Ação atrasada: prazo final previsto anterior a hoje e ação ainda não
 * concluída nem cancelada (sem registro de andamento, conta como não iniciada).
 */
export function acaoAtrasada(situacao: SituacaoAcao | null, fimPrevisto: string | null, hoje: string): boolean {
  if (situacao === "concluida" || situacao === "cancelada") return false;
  return fimPrevisto !== null && fimPrevisto < hoje;
}

/** Marco atrasado: prazo previsto anterior a hoje e ainda não alcançado. */
export function marcoAtrasado(alcancado: boolean, prazoPrevisto: string | null, hoje: string): boolean {
  return !alcancado && prazoPrevisto !== null && prazoPrevisto < hoje;
}

/** Próximo código sequencial com prefixo (A-01, R-01, P1, M1…), a partir dos existentes. */
export function proximoCodigo(existentes: readonly string[], prefixo: string, digitos: number): string {
  const numeros = existentes
    .map((c) => (c.startsWith(prefixo) ? Number.parseInt(c.slice(prefixo.length), 10) : Number.NaN))
    .filter((n) => Number.isInteger(n));
  const proximo = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `${prefixo}${String(proximo).padStart(digitos, "0")}`;
}
