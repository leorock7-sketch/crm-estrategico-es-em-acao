/**
 * Valores das listas e seus nomes de exibição. Este arquivo não depende do
 * banco, para poder ser usado também nas telas do navegador; um teste
 * automatizado confere se as listas coincidem com as do banco.
 */

export const NATUREZAS = [
  "orgao_publico",
  "empresa",
  "entidade_classe",
  "academia",
  "terceiro_setor",
  "imprensa",
  "outra",
] as const;

export const ROTULOS_NATUREZA: Record<(typeof NATUREZAS)[number], string> = {
  orgao_publico: "Órgão público",
  empresa: "Empresa",
  entidade_classe: "Entidade de classe",
  academia: "Academia e pesquisa",
  terceiro_setor: "Terceiro setor",
  imprensa: "Imprensa",
  outra: "Outra",
};

export const ESFERAS = ["federal", "estadual", "municipal", "nao_se_aplica"] as const;

export const ROTULOS_ESFERA: Record<(typeof ESFERAS)[number], string> = {
  federal: "Federal",
  estadual: "Estadual",
  municipal: "Municipal",
  nao_se_aplica: "Não se aplica",
};

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const TIPOS_CONTATO = ["email", "telefone", "celular", "site", "outro"] as const;

export const ROTULOS_TIPO_CONTATO: Record<(typeof TIPOS_CONTATO)[number], string> = {
  email: "E-mail",
  telefone: "Telefone",
  celular: "Celular",
  site: "Site",
  outro: "Outro",
};

export const NATUREZAS_CONTATO = ["pessoal", "institucional", "funcional"] as const;

export const ROTULOS_NATUREZA_CONTATO: Record<(typeof NATUREZAS_CONTATO)[number], string> = {
  pessoal: "Pessoal",
  institucional: "Institucional",
  funcional: "Funcional (do cargo ou compartilhado)",
};

export const ROTULOS_OPERACAO: Record<string, string> = {
  inclusao: "Inclusão",
  alteracao: "Alteração",
  arquivamento: "Arquivamento",
  reativacao: "Reativação",
  exclusao: "Exclusão",
};

/** Nomes de exibição dos campos, usados no histórico de alterações. */
export const ROTULOS_CAMPOS: Record<string, string> = {
  nome_completo: "Nome completo",
  nome_tratamento: "Nome de tratamento",
  email: "E-mail",
  telefone: "Telefone",
  observacoes: "Observações",
  nome: "Nome",
  sigla: "Sigla",
  natureza: "Natureza",
  esfera: "Esfera",
  pais: "País",
  cnpj: "CNPJ",
  uf: "UF",
  municipio: "Município",
  site: "Site",
  instituicao_superior_id: "Instituição superior",
  pessoa_id: "Pessoa",
  instituicao_id: "Instituição",
  cargo: "Cargo",
  area: "Área",
  data_inicio: "Início",
  data_fim: "Término",
  principal: "Principal",
  arquivado_em: "Arquivado em",
  tipo: "Tipo",
  valor: "Contato",
  vinculo_id: "Vínculo",
  observacao: "Observação",
};
