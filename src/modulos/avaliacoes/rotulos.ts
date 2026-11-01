/**
 * Valores das listas da avaliação estratégica e seus nomes de exibição. Sem
 * dependência do banco, para uso também nas telas; um teste confere se as
 * listas coincidem com as do banco.
 */

/** Cinco níveis do Manual V2.0, do mais favorável ao mais contrário. */
export const POSICIONAMENTOS = [
  "favoravel",
  "parcialmente_favoravel",
  "neutro",
  "parcialmente_contrario",
  "contrario",
] as const;

export type Posicionamento = (typeof POSICIONAMENTOS)[number];

export const ROTULOS_POSICIONAMENTO: Record<Posicionamento, string> = {
  favoravel: "Favorável",
  parcialmente_favoravel: "Parcialmente favorável",
  neutro: "Neutro",
  parcialmente_contrario: "Parcialmente contrário",
  contrario: "Contrário",
};

/** Condição distinta dos cinco níveis: nunca é "neutro" nem pontuação zero. */
export const ROTULO_NAO_AVALIADO = "Não avaliado";

/** Três níveis aprovados (D-034). A classificação é do avaliador, sem regra automática. */
export const GRAUS_CONFIANCA = ["alto", "medio", "baixo"] as const;

export type GrauConfianca = (typeof GRAUS_CONFIANCA)[number];

export const ROTULOS_GRAU_CONFIANCA: Record<GrauConfianca, string> = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
};

export const TIPOS_EVIDENCIA = ["documento", "link", "observacao"] as const;

export const ROTULOS_TIPO_EVIDENCIA: Record<(typeof TIPOS_EVIDENCIA)[number], string> = {
  documento: "Documento",
  link: "Link",
  observacao: "Observação",
};

export const DIMENSOES = ["poder", "interesse"] as const;

export const ROTULOS_DIMENSAO: Record<(typeof DIMENSOES)[number], string> = {
  poder: "Poder",
  interesse: "Interesse",
};

export const SITUACOES_METODOLOGIA = ["rascunho", "vigente", "encerrada"] as const;

export const ROTULOS_SITUACAO_METODOLOGIA: Record<(typeof SITUACOES_METODOLOGIA)[number], string> = {
  rascunho: "Rascunho",
  vigente: "Vigente",
  encerrada: "Encerrada",
};

export const SITUACOES_VERSAO = ["rascunho", "vigente", "substituida"] as const;

export const ROTULOS_SITUACAO_VERSAO: Record<(typeof SITUACOES_VERSAO)[number], string> = {
  rascunho: "Rascunho",
  vigente: "Vigente",
  substituida: "Substituída",
};

export const PERFIS_CONTEXTO = ["gestor", "colaborador", "leitor"] as const;

export const ROTULOS_PERFIL_CONTEXTO: Record<(typeof PERFIS_CONTEXTO)[number], string> = {
  gestor: "Gestor de contexto",
  colaborador: "Colaborador",
  leitor: "Leitor",
};

/** Aviso exibido junto a qualquer resultado de metodologia não homologada (D-034). */
export const AVISO_NAO_HOMOLOGADO =
  "Demonstração com dados fictícios — resultados não homologados. Critérios, escalas, pesos e fórmula são provisórios e não representam a metodologia institucional.";

/** Aviso sobre o controle de acesso enquanto não há autenticação real (D-034). */
export const AVISO_SEGURANCA =
  "O controle de acesso por projeto ou tema está preparado e testado, mas a segurança multiusuário ainda não foi homologada: não há autenticação real nem controle efetivo no banco de dados.";
