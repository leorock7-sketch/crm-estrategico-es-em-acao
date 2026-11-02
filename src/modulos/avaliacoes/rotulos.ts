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

/** Três categorias da escala V2.2 (D-059); as parciais ficam só no histórico. */
export const POSICIONAMENTOS_VIGENTES = ["favoravel", "neutro", "contrario"] as const satisfies readonly Posicionamento[];

/** Categorias da escala anterior, exibidas só no histórico, com a indicação "escala anterior". */
export function posicionamentoDaEscalaAnterior(posicionamento: Posicionamento | null): boolean {
  return posicionamento === "parcialmente_favoravel" || posicionamento === "parcialmente_contrario";
}

/** Condição distinta das categorias e dos níveis: nunca é "neutro", Baixo nem pontuação zero. */
export const ROTULO_NAO_AVALIADO = "Não avaliado";

/** Três níveis qualitativos (D-036): informados e justificados pelo responsável, sem regra automática. */
export const GRAUS_CONFIANCA = ["alto", "medio", "baixo"] as const;

export type GrauConfianca = (typeof GRAUS_CONFIANCA)[number];

/** Valores gravados mantidos; nomes de exibição da V2.2 (D-060). */
export const ROTULOS_GRAU_CONFIANCA: Record<GrauConfianca, string> = {
  alto: "Alta",
  medio: "Média",
  baixo: "Baixa",
};

/** Níveis da escala ordinal V2.2 (D-058), do mais alto ao mais baixo. */
export const NIVEIS = ["alto", "medio", "baixo"] as const;

export type Nivel = (typeof NIVEIS)[number];

export const ROTULOS_NIVEL: Record<Nivel, string> = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
};

/** Situação das ressalvas (H2, tratamentos da D-068); vazio = não se aplica. */
export const SITUACOES_RESSALVAS = ["ha_ressalvas", "nao_identificadas", "informacao_insuficiente"] as const;

export type SituacaoRessalvas = (typeof SITUACOES_RESSALVAS)[number];

export const ROTULOS_SITUACAO_RESSALVAS: Record<SituacaoRessalvas, string> = {
  ha_ressalvas: "Há ressalvas relevantes",
  nao_identificadas: "Não identificadas",
  informacao_insuficiente: "Informação insuficiente",
};

export const ROTULO_RESSALVAS_NAO_SE_APLICA = "Não se aplica (sem manifestação identificada)";

/** Natureza da informação do posicionamento (D-067, D-068): só a formal é manifestação confirmada. */
export const NATUREZAS_POSICIONAMENTO = ["manifestacao_formal", "informacao_informal", "percepcao_consultor"] as const;

export type NaturezaPosicionamento = (typeof NATUREZAS_POSICIONAMENTO)[number];

export const ROTULOS_NATUREZA_POSICIONAMENTO: Record<NaturezaPosicionamento, string> = {
  manifestacao_formal: "Manifestação formal",
  informacao_informal: "Informação informal",
  percepcao_consultor: "Percepção do consultor",
};

/** Posicionamento sem manifestação formal: avaliação preliminar, não posição oficial (D-068). */
export function posicionamentoPreliminar(
  posicionamento: Posicionamento | null,
  natureza: NaturezaPosicionamento | null,
): boolean {
  return posicionamento !== null && natureza !== null && natureza !== "manifestacao_formal";
}

export const ESCALAS_PODER_INTERESSE = ["demonstracao_numerica", "binaria_historica", "ordinal_tres_niveis"] as const;

export type EscalaPoderInteresse = (typeof ESCALAS_PODER_INTERESSE)[number];

export const ROTULOS_ESCALA_PODER_INTERESSE: Record<EscalaPoderInteresse, string> = {
  demonstracao_numerica: "Demonstração (notas de 0 a 100)",
  binaria_historica: "Binária histórica (Alto e Baixo)",
  ordinal_tres_niveis: "V2.2 (Baixo, Médio e Alto)",
};

export const ESCALAS_POSICIONAMENTO = ["cinco_categorias", "tres_categorias"] as const;

export type EscalaPosicionamento = (typeof ESCALAS_POSICIONAMENTO)[number];

export const ROTULOS_ESCALA_POSICIONAMENTO: Record<EscalaPosicionamento, string> = {
  cinco_categorias: "Cinco categorias (escala anterior)",
  tres_categorias: "Favorável, Neutro e Contrário (V2.2)",
};

export const NATUREZAS_ALTERACAO = ["substantiva", "editorial"] as const;

export const ROTULOS_NATUREZA_ALTERACAO: Record<(typeof NATUREZAS_ALTERACAO)[number], string> = {
  substantiva: "Substantiva (exige revalidação)",
  editorial: "Editorial (sem reclassificação)",
};

export const DIMENSOES_RUBRICA = ["poder", "interesse", "posicionamento"] as const;

export type DimensaoRubrica = (typeof DIMENSOES_RUBRICA)[number];

export const ROTULOS_DIMENSAO_RUBRICA: Record<DimensaoRubrica, string> = {
  poder: "Poder",
  interesse: "Interesse",
  posicionamento: "Posicionamento",
};

/** Níveis de cada dimensão nas rubricas, na ordem de exibição. */
export const NIVEIS_DA_RUBRICA: Record<DimensaoRubrica, readonly string[]> = {
  poder: ["alto", "medio", "baixo", "nao_avaliado"],
  interesse: ["alto", "medio", "baixo", "nao_avaliado"],
  posicionamento: ["favoravel", "neutro", "contrario", "nao_avaliado"],
};

export function rotuloNivelDaRubrica(nivel: string): string {
  if (nivel === "nao_avaliado") return ROTULO_NAO_AVALIADO;
  return ROTULOS_NIVEL[nivel as Nivel] ?? ROTULOS_POSICIONAMENTO[nivel as Posicionamento] ?? nivel;
}

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

/** Aviso da metodologia V2.2: rubricas homologadas, mas ainda só com dados fictícios (D-005, D-068). */
export const AVISO_DADOS_FICTICIOS =
  "Rubricas homologadas (Q-66 1.0). As avaliações são avaliações profissionais do consultor, não fatos certificados. Somente dados fictícios: o uso institucional depende de autorização.";

/** Aviso sobre o controle de acesso enquanto não há autenticação real (D-034). */
export const AVISO_SEGURANCA =
  "O controle de acesso por projeto ou tema está preparado e testado, mas a segurança multiusuário ainda não foi homologada: não há autenticação real nem controle efetivo no banco de dados.";
