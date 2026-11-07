/**
 * Estrutura das tabelas do banco de dados (Etapa 1).
 *
 * Fonte única da estrutura: a partir deste arquivo o drizzle-kit gera os
 * scripts SQL em ./migracoes. Gatilhos (auditoria, preenchimento automático e
 * regras que envolvem mais de uma linha) ficam em scripts SQL próprios, na
 * mesma pasta. Documentação: docs/MODELO_DADOS.md.
 */
import { type SQL, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// --- Listas de valores -------------------------------------------------------

export const situacaoUsuario = pgEnum("situacao_usuario", ["ativo", "inativo"]);

export const tipoComite = pgEnum("tipo_comite", ["desenvolvimento", "tematico"]);

export const tipoProjetoTema = pgEnum("tipo_projeto_tema", ["projeto", "tema"]);

export const situacaoProjetoTema = pgEnum("situacao_projeto_tema", [
  "proposto",
  "ativo",
  "suspenso",
  "concluido",
]);

export const tipoStakeholder = pgEnum("tipo_stakeholder", ["pessoa", "instituicao"]);

export const naturezaInstituicao = pgEnum("natureza_instituicao", [
  "orgao_publico",
  "empresa",
  "entidade_classe",
  "academia",
  "terceiro_setor",
  "imprensa",
  "outra",
]);

export const esferaInstituicao = pgEnum("esfera_instituicao", [
  "federal",
  "estadual",
  "municipal",
  "nao_se_aplica",
]);

export const tipoContato = pgEnum("tipo_contato", ["email", "telefone", "celular", "site", "outro"]);

/** Pessoal; institucional (da instituição); funcional (do cargo, pode passar ao sucessor ou ser compartilhado). */
export const naturezaContato = pgEnum("natureza_contato", ["pessoal", "institucional", "funcional"]);

/** Papel do stakeholder no projeto ou tema, sem julgamento de poder ou interesse (decisão D-030). */
export const tipoRelacaoContexto = pgEnum("tipo_relacao_contexto", [
  "orgao_competente",
  "parceiro",
  "financiador",
  "executor",
  "beneficiario",
  "representacao_setorial",
  "outro",
]);

export const operacaoAuditoria = pgEnum("operacao_auditoria", [
  "inclusao",
  "alteracao",
  "arquivamento",
  "reativacao",
  "exclusao",
]);

// Avaliação estratégica (Etapa 2A). Critérios, escalas e pesos institucionais
// ainda não foram homologados: as tabelas só guardam a estrutura (D-032, D-034).

export const situacaoMetodologia = pgEnum("situacao_metodologia", ["rascunho", "vigente", "encerrada"]);

export const dimensaoCriterio = pgEnum("dimensao_criterio", ["poder", "interesse"]);

export const situacaoVersaoAvaliacao = pgEnum("situacao_versao_avaliacao", [
  "rascunho",
  "vigente",
  "substituida",
]);

/** Cinco níveis do Manual V2.0; "não avaliado" é a ausência de valor, nunca um nível. */
export const posicionamento = pgEnum("posicionamento", [
  "favoravel",
  "parcialmente_favoravel",
  "neutro",
  "parcialmente_contrario",
  "contrario",
]);

/** Três níveis qualitativos (D-036): informados e justificados pelo responsável, sem regra automática. */
export const grauConfianca = pgEnum("grau_confianca", ["alto", "medio", "baixo"]);

export const tipoEvidencia = pgEnum("tipo_evidencia", ["documento", "link", "observacao"]);

export const perfilContexto = pgEnum("perfil_contexto", ["gestor", "colaborador", "leitor"]);

// Escalas V2.2 (Etapa 2B, Q-67 1.0). Cada metodologia declara as suas escalas;
// nada é convertido de uma escala para outra (T-1, T-2).

/** Escala de poder e interesse de uma metodologia. */
export const escalaPoderInteresse = pgEnum("escala_poder_interesse", [
  "demonstracao_numerica",
  "binaria_historica",
  "ordinal_tres_niveis",
]);

/** Escala de posicionamento de uma metodologia: as cinco categorias ficam só no histórico (D-059). */
export const escalaPosicionamento = pgEnum("escala_posicionamento", ["cinco_categorias", "tres_categorias"]);

/** Níveis da escala ordinal (D-058); "não avaliado" é a ausência de valor, nunca um nível. */
export const nivelAvaliacao = pgEnum("nivel_avaliacao", ["alto", "medio", "baixo"]);

/** Situação das ressalvas do posicionamento (H2); vazio = não se aplica (sem manifestação identificada). */
export const situacaoRessalvas = pgEnum("situacao_ressalvas", [
  "ha_ressalvas",
  "nao_identificadas",
  "informacao_insuficiente",
]);

/** Natureza da informação do posicionamento (D-067, D-068): só a formal é manifestação confirmada. */
export const naturezaPosicionamento = pgEnum("natureza_posicionamento", [
  "manifestacao_formal",
  "informacao_informal",
  "percepcao_consultor",
]);

/** Natureza da alteração entre versões da metodologia (D-064). */
export const naturezaAlteracao = pgEnum("natureza_alteracao", ["substantiva", "editorial"]);

/** Dimensões com rubrica de níveis na metodologia ordinal. */
export const dimensaoRubrica = pgEnum("dimensao_rubrica", ["poder", "interesse", "posicionamento"]);

// --- Acesso e auditoria ------------------------------------------------------

export const usuario = pgTable(
  "usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    /** Identidade no Supabase Auth; sem ela, não há login (Etapa 5, D-074). A correspondência nunca é pelo e-mail. */
    authId: uuid("auth_id").unique("usuario_auth_id_unico"),
    administrador: boolean("administrador").notNull().default(false),
    situacao: situacaoUsuario("situacao").notNull().default("ativo"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("usuario_email_unico").on(sql`lower(${t.email})`)],
);

export const registroAuditoria = pgTable(
  "registro_auditoria",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    tabela: text("tabela").notNull(),
    registroId: uuid("registro_id").notNull(),
    operacao: operacaoAuditoria("operacao").notNull(),
    dadosAnteriores: jsonb("dados_anteriores"),
    dadosNovos: jsonb("dados_novos"),
    usuarioId: uuid("usuario_id").references(() => usuario.id),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("registro_auditoria_registro_idx").on(t.tabela, t.registroId)],
);

/** Campos de controle comuns às tabelas principais (docs/MODELO_DADOS.md, seção 5). */
function colunasControle() {
  return {
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    criadoPor: uuid("criado_por").references(() => usuario.id),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoPor: uuid("atualizado_por").references(() => usuario.id),
    arquivadoEm: timestamp("arquivado_em", { withTimezone: true }),
  };
}

// --- Estrutura institucional -------------------------------------------------

export const comite = pgTable(
  "comite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull().unique("comite_nome_unico"),
    sigla: text("sigla").unique("comite_sigla_unica"),
    tipo: tipoComite("tipo").notNull(),
    comiteSuperiorId: uuid("comite_superior_id").references((): AnyPgColumn => comite.id),
    ...colunasControle(),
  },
  (t) => [
    check(
      "comite_superior_coerente",
      sql`(${t.tipo} = 'desenvolvimento' and ${t.comiteSuperiorId} is null) or (${t.tipo} = 'tematico' and ${t.comiteSuperiorId} is not null)`,
    ),
    check("comite_nao_superior_de_si", sql`${t.comiteSuperiorId} is distinct from ${t.id}`),
  ],
);

/**
 * Projetos e temas. `comite_id` é o comitê principal; os comitês participantes
 * ficam em projeto_tema_comite (D-023). Sem hierarquia entre temas e projetos (D-020).
 */
export const projetoTema = pgTable(
  "projeto_tema",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipo: tipoProjetoTema("tipo").notNull(),
    nome: text("nome").notNull(),
    nomeNormalizado: text("nome_normalizado").notNull(),
    descricao: text("descricao"),
    comiteId: uuid("comite_id")
      .notNull()
      .references(() => comite.id),
    situacao: situacaoProjetoTema("situacao").notNull().default("proposto"),
    dataInicio: date("data_inicio"),
    dataFim: date("data_fim"),
    responsavelId: uuid("responsavel_id").references(() => usuario.id),
    ...colunasControle(),
  },
  (t) => [
    unique("projeto_tema_nome_unico").on(t.comiteId, t.tipo, t.nome),
    check(
      "projeto_tema_datas",
      sql`${t.dataInicio} is null or ${t.dataFim} is null or ${t.dataFim} >= ${t.dataInicio}`,
    ),
    check("projeto_tema_nome_preenchido", sql`length(trim(${t.nome})) > 0`),
    index("projeto_tema_comite_principal_idx").on(t.comiteId),
    index("projeto_tema_nome_normalizado_idx").on(t.nomeNormalizado),
  ],
);

/** Comitês participantes de um projeto ou tema, com período (decisão D-023). */
export const projetoTemaComite = pgTable(
  "projeto_tema_comite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projetoTemaId: uuid("projeto_tema_id")
      .notNull()
      .references(() => projetoTema.id),
    comiteId: uuid("comite_id")
      .notNull()
      .references(() => comite.id),
    dataInicio: date("data_inicio"),
    dataFim: date("data_fim"),
    observacao: text("observacao"),
    ...colunasControle(),
  },
  (t) => [
    check(
      "projeto_tema_comite_datas",
      sql`${t.dataInicio} is null or ${t.dataFim} is null or ${t.dataFim} >= ${t.dataInicio}`,
    ),
    uniqueIndex("projeto_tema_comite_vigente_unico")
      .on(t.projetoTemaId, t.comiteId)
      .where(sql`${t.dataFim} is null and ${t.arquivadoEm} is null`),
    index("projeto_tema_comite_comite_idx").on(t.comiteId),
  ],
);

// --- Cadastro Mestre ---------------------------------------------------------

/** Tabela-mãe: cada pessoa ou instituição tem aqui o seu identificador comum. */
export const stakeholder = pgTable(
  "stakeholder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipo: tipoStakeholder("tipo").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    criadoPor: uuid("criado_por").references(() => usuario.id),
  },
  (t) => [unique("stakeholder_id_tipo_unico").on(t.id, t.tipo)],
);

/**
 * Pessoas: somente dados mínimos (decisão D-021). E-mails e telefones ficam na
 * tabela contato, com vínculo e histórico próprios (decisão D-025).
 */
export const pessoa = pgTable(
  "pessoa",
  {
    id: uuid("id").primaryKey(),
    tipoStakeholder: tipoStakeholder("tipo_stakeholder").notNull().default("pessoa"),
    nomeCompleto: text("nome_completo").notNull(),
    nomeTratamento: text("nome_tratamento"),
    nomeNormalizado: text("nome_normalizado").notNull(),
    observacoes: text("observacoes"),
    ...colunasControle(),
  },
  (t) => [
    foreignKey({
      name: "pessoa_stakeholder_fk",
      columns: [t.id, t.tipoStakeholder],
      foreignColumns: [stakeholder.id, stakeholder.tipo],
    }),
    check("pessoa_tipo_stakeholder", sql`${t.tipoStakeholder} = 'pessoa'`),
    check("pessoa_nome_preenchido", sql`length(trim(${t.nomeCompleto})) > 0`),
    index("pessoa_nome_normalizado_idx").on(t.nomeNormalizado),
  ],
);

export const instituicao = pgTable(
  "instituicao",
  {
    id: uuid("id").primaryKey(),
    tipoStakeholder: tipoStakeholder("tipo_stakeholder").notNull().default("instituicao"),
    nome: text("nome").notNull(),
    sigla: text("sigla"),
    nomeNormalizado: text("nome_normalizado").notNull(),
    natureza: naturezaInstituicao("natureza").notNull(),
    esfera: esferaInstituicao("esfera"),
    /** País (código ISO 3166-1 de duas letras); padrão Brasil. */
    pais: text("pais").notNull().default("BR"),
    cnpj: text("cnpj"),
    uf: text("uf"),
    municipio: text("municipio"),
    site: text("site"),
    instituicaoSuperiorId: uuid("instituicao_superior_id").references(
      (): AnyPgColumn => instituicao.id,
    ),
    ...colunasControle(),
  },
  (t) => [
    foreignKey({
      name: "instituicao_stakeholder_fk",
      columns: [t.id, t.tipoStakeholder],
      foreignColumns: [stakeholder.id, stakeholder.tipo],
    }),
    check("instituicao_tipo_stakeholder", sql`${t.tipoStakeholder} = 'instituicao'`),
    check("instituicao_nome_preenchido", sql`length(trim(${t.nome})) > 0`),
    // CNPJ numérico ou alfanumérico (Receita Federal, a partir de julho de 2026).
    check("instituicao_cnpj_formato", sql`${t.cnpj} is null or ${t.cnpj} ~ '^[0-9A-Z]{12}[0-9]{2}$'`),
    check("instituicao_uf_formato", sql`${t.uf} is null or ${t.uf} ~ '^[A-Z]{2}$'`),
    check("instituicao_pais_formato", sql`${t.pais} ~ '^[A-Z]{2}$'`),
    // UF e CNPJ são próprios de instituições brasileiras.
    check("instituicao_uf_somente_brasil", sql`${t.pais} = 'BR' or ${t.uf} is null`),
    check("instituicao_cnpj_somente_brasil", sql`${t.pais} = 'BR' or ${t.cnpj} is null`),
    check(
      "instituicao_nao_superior_de_si",
      sql`${t.instituicaoSuperiorId} is distinct from ${t.id}`,
    ),
    // CNPJ repetido gera alerta, não bloqueio (decisão D-024): subunidades podem usar o do órgão superior.
    index("instituicao_cnpj_idx").on(t.cnpj),
    index("instituicao_nome_normalizado_idx").on(t.nomeNormalizado),
  ],
);

/** Vínculos entre pessoas e instituições; o histórico é preservado pelas datas. */
export const vinculoPessoaInstituicao = pgTable(
  "vinculo_pessoa_instituicao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoa.id),
    instituicaoId: uuid("instituicao_id")
      .notNull()
      .references(() => instituicao.id),
    cargo: text("cargo"),
    area: text("area"),
    dataInicio: date("data_inicio"),
    dataFim: date("data_fim"),
    principal: boolean("principal").notNull().default(false),
    ...colunasControle(),
  },
  (t) => [
    check(
      "vinculo_datas",
      sql`${t.dataInicio} is null or ${t.dataFim} is null or ${t.dataFim} >= ${t.dataInicio}`,
    ),
    uniqueIndex("vinculo_principal_vigente_unico")
      .on(t.pessoaId)
      .where(sql`${t.principal} and ${t.dataFim} is null and ${t.arquivadoEm} is null`),
    index("vinculo_pessoa_idx").on(t.pessoaId),
    index("vinculo_instituicao_idx").on(t.instituicaoId),
  ],
);

/**
 * Contatos de pessoas e instituições, com natureza, período e histórico
 * próprios (decisão D-025). Não há unicidade do valor: o mesmo e-mail pode ser
 * compartilhado ou passar de um ocupante do cargo ao seguinte; repetições geram
 * alerta. Um contato funcional pode ser ligado ao vínculo (cargo) da pessoa e é
 * encerrado automaticamente quando esse vínculo termina.
 */
export const contato = pgTable(
  "contato",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stakeholderId: uuid("stakeholder_id")
      .notNull()
      .references(() => stakeholder.id),
    vinculoId: uuid("vinculo_id").references(() => vinculoPessoaInstituicao.id),
    tipo: tipoContato("tipo").notNull(),
    valor: text("valor").notNull(),
    valorNormalizado: text("valor_normalizado").notNull(),
    natureza: naturezaContato("natureza").notNull(),
    principal: boolean("principal").notNull().default(false),
    dataInicio: date("data_inicio"),
    dataFim: date("data_fim"),
    observacao: text("observacao"),
    ...colunasControle(),
  },
  (t) => [
    check("contato_valor_preenchido", sql`length(trim(${t.valor})) > 0`),
    check(
      "contato_datas",
      sql`${t.dataInicio} is null or ${t.dataFim} is null or ${t.dataFim} >= ${t.dataInicio}`,
    ),
    uniqueIndex("contato_principal_vigente_unico")
      .on(t.stakeholderId, t.tipo)
      .where(sql`${t.principal} and ${t.dataFim} is null and ${t.arquivadoEm} is null`),
    index("contato_stakeholder_idx").on(t.stakeholderId),
    index("contato_valor_normalizado_idx").on(t.valorNormalizado),
  ],
);

/**
 * Stakeholders de um contexto (projeto ou tema): quem se relaciona com ele e
 * em que papel. Não registra poder, interesse nem posicionamento, que serão
 * tratados nas avaliações da Etapa 2 (decisão D-030).
 */
export const stakeholderContexto = pgTable(
  "stakeholder_contexto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stakeholderId: uuid("stakeholder_id")
      .notNull()
      .references(() => stakeholder.id),
    projetoTemaId: uuid("projeto_tema_id")
      .notNull()
      .references(() => projetoTema.id),
    tipoRelacao: tipoRelacaoContexto("tipo_relacao").notNull(),
    descricao: text("descricao"),
    dataInicio: date("data_inicio"),
    dataFim: date("data_fim"),
    ...colunasControle(),
  },
  (t) => [
    check(
      "stakeholder_contexto_datas",
      sql`${t.dataInicio} is null or ${t.dataFim} is null or ${t.dataFim} >= ${t.dataInicio}`,
    ),
    uniqueIndex("stakeholder_contexto_vigente_unico")
      .on(t.stakeholderId, t.projetoTemaId, t.tipoRelacao)
      .where(sql`${t.dataFim} is null and ${t.arquivadoEm} is null`),
    index("stakeholder_contexto_projeto_idx").on(t.projetoTemaId),
    index("stakeholder_contexto_stakeholder_idx").on(t.stakeholderId),
  ],
);

// --- Avaliação estratégica de stakeholders (Etapa 2A) ------------------------

/**
 * Versões da metodologia de avaliação. Enquanto os critérios institucionais
 * não forem homologados, só existem metodologias de demonstração, com
 * `homologada` = false e resultados marcados como não homologados.
 */
export const metodologiaVersao = pgTable(
  "metodologia_versao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull().unique("metodologia_versao_nome_unico"),
    descricao: text("descricao"),
    situacao: situacaoMetodologia("situacao").notNull().default("rascunho"),
    homologada: boolean("homologada").notNull().default(false),
    vigenteDesde: date("vigente_desde"),
    vigenteAte: date("vigente_ate"),
    // As metodologias anteriores à Etapa 2B recebem as escalas de demonstração
    // na migração 0006; as novas nascem na escala V2.2.
    escalaPoderInteresse: escalaPoderInteresse("escala_poder_interesse").notNull().default("ordinal_tres_niveis"),
    escalaPosicionamento: escalaPosicionamento("escala_posicionamento").notNull().default("tres_categorias"),
    /** Versão substituída por esta; com ela, a natureza da alteração é obrigatória (D-064). */
    metodologiaAnteriorId: uuid("metodologia_anterior_id").references((): AnyPgColumn => metodologiaVersao.id),
    naturezaAlteracao: naturezaAlteracao("natureza_alteracao"),
    justificativaNatureza: text("justificativa_natureza"),
    naturezaAprovadaPor: uuid("natureza_aprovada_por").references(() => usuario.id),
    naturezaAprovadaEm: timestamp("natureza_aprovada_em", { withTimezone: true }),
    /** Equivalência declarada das definições de posicionamento, para a tendência (T-6). */
    equivalentePosicionamentoA: uuid("equivalente_posicionamento_a").references((): AnyPgColumn => metodologiaVersao.id),
    justificativaEquivalencia: text("justificativa_equivalencia"),
    ...colunasControle(),
  },
  (t) => [
    uniqueIndex("metodologia_vigente_unica").on(t.situacao).where(sql`${t.situacao} = 'vigente'`),
    check(
      "metodologia_versao_datas",
      sql`${t.vigenteDesde} is null or ${t.vigenteAte} is null or ${t.vigenteAte} >= ${t.vigenteDesde}`,
    ),
  ],
);

/** Critérios de poder e de interesse de uma versão da metodologia. */
export const criterioAvaliacao = pgTable(
  "criterio_avaliacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metodologiaVersaoId: uuid("metodologia_versao_id")
      .notNull()
      .references(() => metodologiaVersao.id),
    dimensao: dimensaoCriterio("dimensao").notNull(),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    escalaMinima: integer("escala_minima").notNull(),
    escalaMaxima: integer("escala_maxima").notNull(),
    peso: numeric("peso", { precision: 8, scale: 4, mode: "number" }),
    ordem: integer("ordem").notNull().default(0),
    ...colunasControle(),
  },
  (t) => [
    unique("criterio_avaliacao_nome_unico").on(t.metodologiaVersaoId, t.dimensao, t.nome),
    check("criterio_avaliacao_escala", sql`${t.escalaMaxima} > ${t.escalaMinima}`),
    check("criterio_avaliacao_peso", sql`${t.peso} is null or ${t.peso} >= 0`),
  ],
);

/**
 * Rubrica de cada nível da metodologia ordinal (Q-66 1.0): texto de ajuda que
 * orienta o julgamento, sem substituí-lo. Travada quando a metodologia entra em vigor.
 */
export const rubricaNivel = pgTable(
  "rubrica_nivel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metodologiaVersaoId: uuid("metodologia_versao_id")
      .notNull()
      .references(() => metodologiaVersao.id),
    dimensao: dimensaoRubrica("dimensao").notNull(),
    /** Poder e interesse: alto, medio, baixo; posicionamento: favoravel, neutro, contrario; e nao_avaliado. */
    nivel: text("nivel").notNull(),
    criterioOrientador: text("criterio_orientador").notNull(),
    basesTipicas: text("bases_tipicas"),
    ordem: integer("ordem").notNull().default(0),
    ...colunasControle(),
  },
  (t) => [
    unique("rubrica_nivel_unica").on(t.metodologiaVersaoId, t.dimensao, t.nivel),
    check(
      "rubrica_nivel_valido",
      sql`(${t.dimensao} in ('poder', 'interesse') and ${t.nivel} in ('alto', 'medio', 'baixo', 'nao_avaliado'))
        or (${t.dimensao} = 'posicionamento' and ${t.nivel} in ('favoravel', 'neutro', 'contrario', 'nao_avaliado'))`,
    ),
    check("rubrica_nivel_criterio_preenchido", sql`length(trim(${t.criterioOrientador})) > 0`),
  ],
);

/** Ficha: reúne as versões da avaliação de um stakeholder em um projeto ou tema. */
export const avaliacao = pgTable(
  "avaliacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stakeholderId: uuid("stakeholder_id")
      .notNull()
      .references(() => stakeholder.id),
    projetoTemaId: uuid("projeto_tema_id")
      .notNull()
      .references(() => projetoTema.id),
    ...colunasControle(),
  },
  (t) => [
    unique("avaliacao_stakeholder_contexto_unica").on(t.stakeholderId, t.projetoTemaId),
    index("avaliacao_projeto_idx").on(t.projetoTemaId),
  ],
);

/**
 * Cada versão é uma avaliação completa. Nasce como rascunho; ao ser publicada
 * torna-se a vigente e não pode mais ser alterada (só passar a "substituída").
 * Na metodologia de demonstração, poder e interesse ficam gravados como
 * resultado na escala de 0 a 100; na V2.2, como níveis escolhidos pelo consultor.
 */
export const avaliacaoVersao = pgTable(
  "avaliacao_versao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    avaliacaoId: uuid("avaliacao_id")
      .notNull()
      .references(() => avaliacao.id),
    numeroVersao: integer("numero_versao").notNull(),
    situacao: situacaoVersaoAvaliacao("situacao").notNull().default("rascunho"),
    metodologiaVersaoId: uuid("metodologia_versao_id").references(() => metodologiaVersao.id),
    poder: numeric("poder", { precision: 6, scale: 2, mode: "number" }),
    interesse: numeric("interesse", { precision: 6, scale: 2, mode: "number" }),
    posicionamento: posicionamento("posicionamento"),
    grauConfianca: grauConfianca("grau_confianca"),
    justificativaConfianca: text("justificativa_confianca"),
    justificativa: text("justificativa"),
    validacaoInstitucional: text("validacao_institucional"),
    dataReferencia: date("data_referencia"),
    proximaRevisao: date("proxima_revisao"),
    avaliadorId: uuid("avaliador_id").references(() => usuario.id),
    publicadaEm: timestamp("publicada_em", { withTimezone: true }),
    // Escala V2.2 (Etapa 2B). Vazio = "não avaliado"; nunca vira Baixo (T17).
    nivelPoder: nivelAvaliacao("nivel_poder"),
    nivelInteresse: nivelAvaliacao("nivel_interesse"),
    justificativaPoder: text("justificativa_poder"),
    justificativaInteresse: text("justificativa_interesse"),
    justificativaPosicionamento: text("justificativa_posicionamento"),
    naturezaPosicionamento: naturezaPosicionamento("natureza_posicionamento"),
    situacaoRessalvas: situacaoRessalvas("situacao_ressalvas"),
    descricaoRessalvas: text("descricao_ressalvas"),
    /** Alertas orientativos mantidos pelo consultor na publicação; gravados automaticamente. */
    alertasReconhecidos: text("alertas_reconhecidos").array(),
    ...colunasControle(),
  },
  (t) => [
    unique("avaliacao_versao_numero_unico").on(t.avaliacaoId, t.numeroVersao),
    uniqueIndex("avaliacao_versao_vigente_unica")
      .on(t.avaliacaoId)
      .where(sql`${t.situacao} = 'vigente'`),
    uniqueIndex("avaliacao_versao_rascunho_unico")
      .on(t.avaliacaoId)
      .where(sql`${t.situacao} = 'rascunho' and ${t.arquivadoEm} is null`),
    check("avaliacao_versao_poder", sql`${t.poder} is null or (${t.poder} >= 0 and ${t.poder} <= 100)`),
    check(
      "avaliacao_versao_interesse",
      sql`${t.interesse} is null or (${t.interesse} >= 0 and ${t.interesse} <= 100)`,
    ),
  ],
);

/** Nota de cada critério numa versão de avaliação. */
export const avaliacaoNotaCriterio = pgTable(
  "avaliacao_nota_criterio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    avaliacaoVersaoId: uuid("avaliacao_versao_id")
      .notNull()
      .references(() => avaliacaoVersao.id),
    criterioAvaliacaoId: uuid("criterio_avaliacao_id")
      .notNull()
      .references(() => criterioAvaliacao.id),
    nota: numeric("nota", { precision: 6, scale: 2, mode: "number" }).notNull(),
    justificativa: text("justificativa"),
    ...colunasControle(),
  },
  (t) => [unique("avaliacao_nota_criterio_unica").on(t.avaliacaoVersaoId, t.criterioAvaliacaoId)],
);

/**
 * Fundamentos de uma versão de avaliação. Exigidos para publicar só na
 * metodologia de demonstração; na V2.2 são opcionais (D-067).
 */
export const evidencia = pgTable(
  "evidencia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    avaliacaoVersaoId: uuid("avaliacao_versao_id")
      .notNull()
      .references(() => avaliacaoVersao.id),
    tipo: tipoEvidencia("tipo").notNull(),
    descricao: text("descricao").notNull(),
    fonte: text("fonte"),
    url: text("url"),
    dataEvidencia: date("data_evidencia"),
    /** Evidência trazida de versão anterior, como referência (T-4). */
    evidenciaOrigemId: uuid("evidencia_origem_id").references((): AnyPgColumn => evidencia.id),
    ...colunasControle(),
  },
  (t) => [
    check("evidencia_descricao_preenchida", sql`length(trim(${t.descricao})) > 0`),
    index("evidencia_versao_idx").on(t.avaliacaoVersaoId),
  ],
);

/**
 * Permissões por projeto ou tema (D-008). Estrutura preparada e testada na
 * Etapa 2A; a segurança multiusuário só será homologada com a autenticação.
 */
export const permissaoContexto = pgTable(
  "permissao_contexto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id),
    projetoTemaId: uuid("projeto_tema_id")
      .notNull()
      .references(() => projetoTema.id),
    perfil: perfilContexto("perfil").notNull(),
    validaAte: date("valida_ate"),
    ...colunasControle(),
  },
  (t) => [
    uniqueIndex("permissao_contexto_unica")
      .on(t.usuarioId, t.projetoTemaId)
      .where(sql`${t.arquivadoEm} is null`),
  ],
);

// --- Iniciativas, interações e compromissos (Etapa 3) ------------------------
// Cada reunião existe uma única vez (interacao) e se liga a quantas iniciativas,
// projetos e participantes forem necessários (RN-05, RN-06). Ligações não são
// apagadas: retirá-las é arquivá-las, com registro na auditoria.

export const tipoIniciativa = pgEnum("tipo_iniciativa", ["demanda", "reuniao_relevante", "frente_atuacao"]);

/** Ciclo de vida proposto em docs/MATRIZ_INICIATIVAS.md, seção 5 (provisório). */
export const situacaoIniciativa = pgEnum("situacao_iniciativa", [
  "registrada",
  "em_analise",
  "em_andamento",
  "suspensa",
  "concluida",
  "cancelada",
]);

/** Escala provisória de prioridade (Q-21). */
export const prioridadeIniciativa = pgEnum("prioridade_iniciativa", ["alta", "media", "baixa"]);

/** Papéis propostos do stakeholder na iniciativa (Q-23, provisório). */
export const papelIniciativa = pgEnum("papel_iniciativa", [
  "demandante",
  "apoiador",
  "decisor",
  "executor",
  "afetado",
  "outro",
]);

export const tipoInteracao = pgEnum("tipo_interacao", [
  "reuniao_presencial",
  "reuniao_virtual",
  "ligacao",
  "email",
  "evento",
  "visita",
  "outro",
]);

export const situacaoInteracao = pgEnum("situacao_interacao", ["agendada", "realizada", "cancelada"]);

export const presencaInteracao = pgEnum("presenca_interacao", ["convidado", "presente", "ausente"]);

/** "Vencido" não é situação: é calculado (prazo passado e compromisso ainda aberto ou em andamento). */
export const situacaoCompromisso = pgEnum("situacao_compromisso", [
  "aberto",
  "em_andamento",
  "concluido",
  "cancelado",
]);

/**
 * Iniciativas da Matriz de Iniciativas (cadastro manual). A do tipo "reunião
 * relevante" representa o assunto acompanhado; os encontros realizados ficam
 * em interacao, ligados a ela (docs/MATRIZ_INICIATIVAS.md, seção 3).
 */
export const iniciativa = pgTable(
  "iniciativa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipo: tipoIniciativa("tipo").notNull(),
    titulo: text("titulo").notNull(),
    tituloNormalizado: text("titulo_normalizado").notNull(),
    descricao: text("descricao"),
    origem: text("origem"),
    situacao: situacaoIniciativa("situacao").notNull().default("registrada"),
    prioridade: prioridadeIniciativa("prioridade"),
    responsavelId: uuid("responsavel_id").references(() => usuario.id),
    dataAbertura: date("data_abertura").notNull(),
    dataPrevistaConclusao: date("data_prevista_conclusao"),
    dataConclusao: date("data_conclusao"),
    ...colunasControle(),
  },
  (t) => [
    check("iniciativa_titulo_preenchido", sql`length(trim(${t.titulo})) > 0`),
    check(
      "iniciativa_datas",
      sql`(${t.dataConclusao} is null or ${t.dataConclusao} >= ${t.dataAbertura}) and (${t.dataPrevistaConclusao} is null or ${t.dataPrevistaConclusao} >= ${t.dataAbertura})`,
    ),
    check("iniciativa_concluida_com_data", sql`${t.situacao} <> 'concluida' or ${t.dataConclusao} is not null`),
    index("iniciativa_titulo_normalizado_idx").on(t.tituloNormalizado),
    index("iniciativa_responsavel_idx").on(t.responsavelId),
  ],
);

/** Projetos e temas da iniciativa (pelo menos um vigente — regra no banco). */
export const iniciativaProjetoTema = pgTable(
  "iniciativa_projeto_tema",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    iniciativaId: uuid("iniciativa_id")
      .notNull()
      .references(() => iniciativa.id),
    projetoTemaId: uuid("projeto_tema_id")
      .notNull()
      .references(() => projetoTema.id),
    ...colunasControle(),
  },
  (t) => [
    uniqueIndex("iniciativa_projeto_tema_unico")
      .on(t.iniciativaId, t.projetoTemaId)
      .where(sql`${t.arquivadoEm} is null`),
    index("iniciativa_projeto_tema_projeto_idx").on(t.projetoTemaId),
  ],
);

/** Pessoas e instituições envolvidas na iniciativa; o mesmo stakeholder pode ter mais de um papel. */
export const iniciativaStakeholder = pgTable(
  "iniciativa_stakeholder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    iniciativaId: uuid("iniciativa_id")
      .notNull()
      .references(() => iniciativa.id),
    stakeholderId: uuid("stakeholder_id")
      .notNull()
      .references(() => stakeholder.id),
    papel: papelIniciativa("papel").notNull(),
    observacao: text("observacao"),
    ...colunasControle(),
  },
  (t) => [
    uniqueIndex("iniciativa_stakeholder_unico")
      .on(t.iniciativaId, t.stakeholderId, t.papel)
      .where(sql`${t.arquivadoEm} is null`),
    index("iniciativa_stakeholder_stakeholder_idx").on(t.stakeholderId),
  ],
);

/**
 * Reuniões, contatos e demais encontros, registrados uma única vez. A origem
 * (sistema e identificador do evento) impede importar duas vezes a mesma
 * reunião de um calendário externo (integração futura).
 */
export const interacao = pgTable(
  "interacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipo: tipoInteracao("tipo").notNull(),
    assunto: text("assunto").notNull(),
    assuntoNormalizado: text("assunto_normalizado").notNull(),
    inicio: timestamp("inicio", { withTimezone: true }).notNull(),
    fim: timestamp("fim", { withTimezone: true }),
    local: text("local"),
    resumo: text("resumo"),
    situacao: situacaoInteracao("situacao").notNull().default("realizada"),
    origemSistema: text("origem_sistema"),
    origemId: text("origem_id"),
    ...colunasControle(),
  },
  (t) => [
    check("interacao_assunto_preenchido", sql`length(trim(${t.assunto})) > 0`),
    check("interacao_periodo", sql`${t.fim} is null or ${t.fim} >= ${t.inicio}`),
    check("interacao_origem_completa", sql`(${t.origemSistema} is null) = (${t.origemId} is null)`),
    uniqueIndex("interacao_origem_unica")
      .on(t.origemSistema, t.origemId)
      .where(sql`${t.origemSistema} is not null`),
    index("interacao_inicio_idx").on(t.inicio),
    index("interacao_assunto_normalizado_idx").on(t.assuntoNormalizado),
  ],
);

/** Participantes: externo (stakeholder) ou da equipe interna (usuário), nunca os dois. */
export const interacaoParticipante = pgTable(
  "interacao_participante",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interacaoId: uuid("interacao_id")
      .notNull()
      .references(() => interacao.id),
    stakeholderId: uuid("stakeholder_id").references(() => stakeholder.id),
    usuarioId: uuid("usuario_id").references(() => usuario.id),
    presenca: presencaInteracao("presenca").notNull().default("presente"),
    ...colunasControle(),
  },
  (t) => [
    check("interacao_participante_um_tipo", sql`(${t.stakeholderId} is null) <> (${t.usuarioId} is null)`),
    uniqueIndex("interacao_participante_stakeholder_unico")
      .on(t.interacaoId, t.stakeholderId)
      .where(sql`${t.stakeholderId} is not null and ${t.arquivadoEm} is null`),
    uniqueIndex("interacao_participante_usuario_unico")
      .on(t.interacaoId, t.usuarioId)
      .where(sql`${t.usuarioId} is not null and ${t.arquivadoEm} is null`),
    index("interacao_participante_stakeholder_idx").on(t.stakeholderId),
  ],
);

/** Projetos e temas a que a interação se refere diretamente. */
export const interacaoProjetoTema = pgTable(
  "interacao_projeto_tema",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interacaoId: uuid("interacao_id")
      .notNull()
      .references(() => interacao.id),
    projetoTemaId: uuid("projeto_tema_id")
      .notNull()
      .references(() => projetoTema.id),
    ...colunasControle(),
  },
  (t) => [
    uniqueIndex("interacao_projeto_tema_unico")
      .on(t.interacaoId, t.projetoTemaId)
      .where(sql`${t.arquivadoEm} is null`),
    index("interacao_projeto_tema_projeto_idx").on(t.projetoTemaId),
  ],
);

/** Uma interação contribui para uma ou mais iniciativas, sem duplicar a reunião (RF-42, RF-43). */
export const interacaoIniciativa = pgTable(
  "interacao_iniciativa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interacaoId: uuid("interacao_id")
      .notNull()
      .references(() => interacao.id),
    iniciativaId: uuid("iniciativa_id")
      .notNull()
      .references(() => iniciativa.id),
    contribuicao: text("contribuicao"),
    ...colunasControle(),
  },
  (t) => [
    uniqueIndex("interacao_iniciativa_unico")
      .on(t.interacaoId, t.iniciativaId)
      .where(sql`${t.arquivadoEm} is null`),
    index("interacao_iniciativa_iniciativa_idx").on(t.iniciativaId),
  ],
);

/**
 * Compromissos e encaminhamentos, ligados à interação que os originou e/ou a
 * uma iniciativa. O vínculo com ações do Plano de Ação entra na Etapa 4.
 */
export const compromisso = pgTable(
  "compromisso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    descricao: text("descricao").notNull(),
    interacaoId: uuid("interacao_id").references(() => interacao.id),
    iniciativaId: uuid("iniciativa_id").references(() => iniciativa.id),
    responsavelUsuarioId: uuid("responsavel_usuario_id").references(() => usuario.id),
    responsavelStakeholderId: uuid("responsavel_stakeholder_id").references(() => stakeholder.id),
    prazo: date("prazo"),
    situacao: situacaoCompromisso("situacao").notNull().default("aberto"),
    concluidoEm: date("concluido_em"),
    /** Ação do Plano de Ação em que o compromisso foi convertido (Etapa 4). */
    acaoId: uuid("acao_id").references((): AnyPgColumn => acao.id),
    ...colunasControle(),
  },
  (t) => [
    check("compromisso_descricao_preenchida", sql`length(trim(${t.descricao})) > 0`),
    check("compromisso_com_origem", sql`${t.interacaoId} is not null or ${t.iniciativaId} is not null`),
    check(
      "compromisso_com_responsavel",
      sql`${t.responsavelUsuarioId} is not null or ${t.responsavelStakeholderId} is not null`,
    ),
    check("compromisso_concluido_com_data", sql`${t.situacao} <> 'concluido' or ${t.concluidoEm} is not null`),
    index("compromisso_interacao_idx").on(t.interacaoId),
    index("compromisso_iniciativa_idx").on(t.iniciativaId),
    index("compromisso_prazo_idx").on(t.prazo),
  ],
);

/** Histórico de acompanhamento do compromisso: cada registro é preservado; corrige-se com um novo. */
export const compromissoAcompanhamento = pgTable(
  "compromisso_acompanhamento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    compromissoId: uuid("compromisso_id")
      .notNull()
      .references(() => compromisso.id),
    data: date("data").notNull(),
    registro: text("registro").notNull(),
    /** Situação definida neste acompanhamento, quando houve mudança. */
    situacao: situacaoCompromisso("situacao"),
    ...colunasControle(),
  },
  (t) => [
    check("compromisso_acompanhamento_registro_preenchido", sql`length(trim(${t.registro})) > 0`),
    index("compromisso_acompanhamento_compromisso_idx").on(t.compromissoId),
  ],
);

// --- Plano de Ação e Matriz de Riscos (Etapa 4) ------------------------------
// Reproduzem os instrumentos do Comitê de Infraestrutura (D-072): plano por
// projeto ou tema, organizado por pilares ou eixos, com ações e marcos de
// acompanhamento; matriz de riscos 5 × 5 com avaliações inerente e residual.

/** Fluxo de aprovação das versões do plano (D-072, item 2.3). */
export const situacaoVersaoPlano = pgEnum("situacao_versao_plano", [
  "rascunho",
  "em_aprovacao",
  "aprovada",
  "rejeitada",
  "substituida",
]);

/** Registro de cada passo do fluxo: quem decidiu, quando e com que parecer (D-072, D3). */
export const decisaoPlano = pgEnum("decisao_plano", ["enviada", "devolvida", "aprovada", "rejeitada"]);

export const periodicidadeAcao = pgEnum("periodicidade_acao", ["mensal", "bimestral", "trimestral", "semestral", "anual"]);

/** Andamento da ação; "atrasada" é calculada (prazo vencido sem conclusão). */
export const situacaoAcao = pgEnum("situacao_acao", ["nao_iniciada", "em_andamento", "concluida", "suspensa", "cancelada"]);

/** Status dos riscos conforme a matriz do Comitê de Infraestrutura (D-072, item 3.2). */
export const situacaoRisco = pgEnum("situacao_risco", ["aberto", "em_mitigacao", "monitorado", "mitigado", "escalonado"]);

export const tipoAvaliacaoRisco = pgEnum("tipo_avaliacao_risco", ["inerente", "residual"]);

export const estrategiaResposta = pgEnum("estrategia_resposta", ["evitar", "mitigar", "transferir", "aceitar"]);

export const situacaoResposta = pgEnum("situacao_resposta", ["planejada", "em_execucao", "concluida", "cancelada"]);

/** Um plano de ação por projeto ou tema (D-072, D2), com versões. */
export const planoAcao = pgTable(
  "plano_acao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projetoTemaId: uuid("projeto_tema_id")
      .notNull()
      .references(() => projetoTema.id),
    titulo: text("titulo").notNull(),
    /** Objetivo geral do plano no projeto ou tema. */
    objetivo: text("objetivo"),
    responsavelId: uuid("responsavel_id").references(() => usuario.id),
    ...colunasControle(),
  },
  (t) => [
    check("plano_acao_titulo_preenchido", sql`length(trim(${t.titulo})) > 0`),
    uniqueIndex("plano_acao_projeto_unico").on(t.projetoTemaId).where(sql`${t.arquivadoEm} is null`),
  ],
);

/**
 * Pilares ou eixos do plano, próprios de cada projeto ou tema (D-072, item 2.1):
 * os cinco pilares da Infraestrutura são um modelo de referência, não obrigatório.
 */
export const planoEixo = pgTable(
  "plano_eixo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planoAcaoId: uuid("plano_acao_id")
      .notNull()
      .references(() => planoAcao.id),
    codigo: text("codigo").notNull(),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    /** Objetivo estratégico do pilar ou eixo neste projeto ou tema. */
    objetivo: text("objetivo"),
    ordem: integer("ordem").notNull().default(0),
    ...colunasControle(),
  },
  (t) => [
    check("plano_eixo_nome_preenchido", sql`length(trim(${t.nome})) > 0`),
    uniqueIndex("plano_eixo_codigo_unico").on(t.planoAcaoId, t.codigo).where(sql`${t.arquivadoEm} is null`),
  ],
);

/** Versões do plano: só a aprovada vigora; as decididas não mudam. */
export const planoAcaoVersao = pgTable(
  "plano_acao_versao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planoAcaoId: uuid("plano_acao_id")
      .notNull()
      .references(() => planoAcao.id),
    numeroVersao: integer("numero_versao").notNull(),
    situacao: situacaoVersaoPlano("situacao").notNull().default("rascunho"),
    motivoAlteracao: text("motivo_alteracao"),
    propostaPor: uuid("proposta_por").references(() => usuario.id),
    propostaEm: timestamp("proposta_em", { withTimezone: true }),
    decididaPor: uuid("decidida_por").references(() => usuario.id),
    decididaEm: timestamp("decidida_em", { withTimezone: true }),
    parecer: text("parecer"),
    ...colunasControle(),
  },
  (t) => [
    unique("plano_acao_versao_numero_unico").on(t.planoAcaoId, t.numeroVersao),
    uniqueIndex("plano_acao_versao_vigente_unica").on(t.planoAcaoId).where(sql`${t.situacao} = 'aprovada'`),
    uniqueIndex("plano_acao_versao_elaboracao_unica")
      .on(t.planoAcaoId)
      .where(sql`${t.situacao} in ('rascunho', 'em_aprovacao') and ${t.arquivadoEm} is null`),
    check(
      "plano_acao_versao_decisao_registrada",
      sql`${t.situacao} not in ('aprovada', 'rejeitada', 'substituida') or (${t.decididaPor} is not null and ${t.decididaEm} is not null)`,
    ),
  ],
);

/** Histórico do fluxo de aprovação (envio, devolução, aprovação, rejeição), preservado. */
export const planoAcaoDecisao = pgTable("plano_acao_decisao", {
  id: uuid("id").primaryKey().defaultRandom(),
  planoAcaoVersaoId: uuid("plano_acao_versao_id")
    .notNull()
    .references(() => planoAcaoVersao.id),
  decisao: decisaoPlano("decisao").notNull(),
  parecer: text("parecer"),
  ...colunasControle(),
});

/** Identidade permanente da ação (código A-01, A-02…), que atravessa as versões. */
export const acao = pgTable(
  "acao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planoAcaoId: uuid("plano_acao_id")
      .notNull()
      .references(() => planoAcao.id),
    codigo: text("codigo").notNull(),
    iniciativaId: uuid("iniciativa_id").references(() => iniciativa.id),
    ...colunasControle(),
  },
  (t) => [unique("acao_codigo_unico").on(t.planoAcaoId, t.codigo), index("acao_iniciativa_idx").on(t.iniciativaId)],
);

/** O que foi planejado para a ação em cada versão (fotografia completa do plano). */
export const acaoPlanejamento = pgTable(
  "acao_planejamento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    acaoId: uuid("acao_id")
      .notNull()
      .references(() => acao.id),
    planoAcaoVersaoId: uuid("plano_acao_versao_id")
      .notNull()
      .references(() => planoAcaoVersao.id),
    eixoId: uuid("eixo_id").references(() => planoEixo.id),
    titulo: text("titulo").notNull(),
    /** Detalhamento: desdobramentos e subações. */
    descricao: text("descricao"),
    justificativa: text("justificativa"),
    responsavelUsuarioId: uuid("responsavel_usuario_id").references(() => usuario.id),
    responsavelStakeholderId: uuid("responsavel_stakeholder_id").references(() => stakeholder.id),
    inicioPrevisto: date("inicio_previsto"),
    fimPrevisto: date("fim_previsto"),
    periodicidade: periodicidadeAcao("periodicidade"),
    ...colunasControle(),
  },
  (t) => [
    check("acao_planejamento_titulo_preenchido", sql`length(trim(${t.titulo})) > 0`),
    check(
      "acao_planejamento_datas",
      sql`${t.inicioPrevisto} is null or ${t.fimPrevisto} is null or ${t.fimPrevisto} >= ${t.inicioPrevisto}`,
    ),
    check(
      "acao_planejamento_com_responsavel",
      sql`${t.responsavelUsuarioId} is not null or ${t.responsavelStakeholderId} is not null`,
    ),
    uniqueIndex("acao_planejamento_unico")
      .on(t.acaoId, t.planoAcaoVersaoId)
      .where(sql`${t.arquivadoEm} is null`),
    index("acao_planejamento_versao_idx").on(t.planoAcaoVersaoId),
  ],
);

/** Marcos de acompanhamento da ação (M1, M2…): pontos de verificação da evolução. */
export const acaoMarco = pgTable(
  "acao_marco",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    acaoId: uuid("acao_id")
      .notNull()
      .references(() => acao.id),
    codigo: text("codigo").notNull(),
    ...colunasControle(),
  },
  (t) => [unique("acao_marco_codigo_unico").on(t.acaoId, t.codigo)],
);

/** O que foi planejado para o marco em cada versão. */
export const marcoPlanejamento = pgTable(
  "marco_planejamento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marcoId: uuid("marco_id")
      .notNull()
      .references(() => acaoMarco.id),
    planoAcaoVersaoId: uuid("plano_acao_versao_id")
      .notNull()
      .references(() => planoAcaoVersao.id),
    descricao: text("descricao").notNull(),
    prazoPrevisto: date("prazo_previsto"),
    ...colunasControle(),
  },
  (t) => [
    check("marco_planejamento_descricao_preenchida", sql`length(trim(${t.descricao})) > 0`),
    uniqueIndex("marco_planejamento_unico")
      .on(t.marcoId, t.planoAcaoVersaoId)
      .where(sql`${t.arquivadoEm} is null`),
  ],
);

/**
 * Acompanhamento da ação, sem aprovação: situação, percentual (complementar,
 * opcional), observação e marco alcançado (D-072, item 2.2). Preservado.
 */
export const acaoAcompanhamento = pgTable(
  "acao_acompanhamento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    acaoId: uuid("acao_id")
      .notNull()
      .references(() => acao.id),
    data: date("data").notNull(),
    situacao: situacaoAcao("situacao"),
    percentual: integer("percentual"),
    observacao: text("observacao"),
    marcoId: uuid("marco_id").references(() => acaoMarco.id),
    /** Com marco: verdadeiro se alcançado; falso corrige um registro anterior. */
    marcoAlcancado: boolean("marco_alcancado"),
    ...colunasControle(),
  },
  (t) => [
    check("acao_acompanhamento_percentual", sql`${t.percentual} is null or ${t.percentual} between 0 and 100`),
    check("acao_acompanhamento_marco", sql`(${t.marcoId} is null) = (${t.marcoAlcancado} is null)`),
    check(
      "acao_acompanhamento_preenchido",
      sql`${t.situacao} is not null or ${t.percentual} is not null or ${t.marcoId} is not null or length(trim(coalesce(${t.observacao}, ''))) > 0`,
    ),
    index("acao_acompanhamento_acao_idx").on(t.acaoId),
  ],
);

/** Pessoas e instituições relacionadas à ação. */
export const acaoStakeholder = pgTable(
  "acao_stakeholder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    acaoId: uuid("acao_id")
      .notNull()
      .references(() => acao.id),
    stakeholderId: uuid("stakeholder_id")
      .notNull()
      .references(() => stakeholder.id),
    observacao: text("observacao"),
    ...colunasControle(),
  },
  (t) => [
    uniqueIndex("acao_stakeholder_unico").on(t.acaoId, t.stakeholderId).where(sql`${t.arquivadoEm} is null`),
    index("acao_stakeholder_stakeholder_idx").on(t.stakeholderId),
  ],
);

/** Riscos do projeto ou tema (matriz 5 × 5 do Comitê de Infraestrutura). */
export const risco = pgTable(
  "risco",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projetoTemaId: uuid("projeto_tema_id")
      .notNull()
      .references(() => projetoTema.id),
    iniciativaId: uuid("iniciativa_id").references(() => iniciativa.id),
    /** Pilar ou eixo do plano do mesmo projeto ou tema. */
    eixoId: uuid("eixo_id").references(() => planoEixo.id),
    codigo: text("codigo").notNull(),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    causa: text("causa"),
    consequencia: text("consequencia"),
    controlesExistentes: text("controles_existentes"),
    responsavelId: uuid("responsavel_id").references(() => usuario.id),
    situacao: situacaoRisco("situacao").notNull().default("aberto"),
    proximaRevisao: date("proxima_revisao"),
    ...colunasControle(),
  },
  (t) => [
    check("risco_titulo_preenchido", sql`length(trim(${t.titulo})) > 0`),
    unique("risco_codigo_unico").on(t.projetoTemaId, t.codigo),
    index("risco_iniciativa_idx").on(t.iniciativaId),
  ],
);

/**
 * Avaliações do risco, inerente (antes dos controles) e residual (depois dos
 * controles efetivamente implementados). Criticidade = probabilidade × impacto
 * e classificação pelas faixas da matriz original, calculadas pelo banco.
 * Cada reavaliação é um novo registro: o histórico é preservado.
 */
export const riscoAvaliacao = pgTable(
  "risco_avaliacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riscoId: uuid("risco_id")
      .notNull()
      .references(() => risco.id),
    tipo: tipoAvaliacaoRisco("tipo").notNull(),
    dataAvaliacao: date("data_avaliacao").notNull(),
    probabilidade: integer("probabilidade").notNull(),
    impacto: integer("impacto").notNull(),
    criticidade: integer("criticidade")
      .notNull()
      .generatedAlwaysAs((): SQL => sql`probabilidade * impacto`),
    classificacao: text("classificacao")
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`case when probabilidade * impacto <= 4 then 'baixo' when probabilidade * impacto <= 9 then 'moderado' when probabilidade * impacto <= 16 then 'alto' else 'critico' end`,
      ),
    justificativa: text("justificativa").notNull(),
    avaliadoPor: uuid("avaliado_por")
      .notNull()
      .references(() => usuario.id),
    ...colunasControle(),
  },
  (t) => [
    check("risco_avaliacao_probabilidade", sql`${t.probabilidade} between 1 and 5`),
    check("risco_avaliacao_impacto", sql`${t.impacto} between 1 and 5`),
    check("risco_avaliacao_justificativa_preenchida", sql`length(trim(${t.justificativa})) > 0`),
    index("risco_avaliacao_risco_idx").on(t.riscoId),
  ],
);

/** Gatilhos (sinais de alerta) do risco. */
export const riscoGatilho = pgTable(
  "risco_gatilho",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riscoId: uuid("risco_id")
      .notNull()
      .references(() => risco.id),
    descricao: text("descricao").notNull(),
    ...colunasControle(),
  },
  (t) => [check("risco_gatilho_descricao_preenchida", sql`length(trim(${t.descricao})) > 0`)],
);

/**
 * Acompanhamento do gatilho (ocorreu ou não, com observação). A ocorrência não
 * altera a avaliação do risco: sinaliza a necessidade de reavaliação (D-072, 3.3).
 */
export const riscoGatilhoRegistro = pgTable("risco_gatilho_registro", {
  id: uuid("id").primaryKey().defaultRandom(),
  gatilhoId: uuid("gatilho_id")
    .notNull()
    .references(() => riscoGatilho.id),
  data: date("data").notNull(),
  ocorrido: boolean("ocorrido").notNull(),
  observacao: text("observacao"),
  ...colunasControle(),
});

/** Medidas de resposta; quando já for uma ação do plano, aponta para ela, sem duplicar. */
export const riscoResposta = pgTable(
  "risco_resposta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riscoId: uuid("risco_id")
      .notNull()
      .references(() => risco.id),
    estrategia: estrategiaResposta("estrategia").notNull(),
    descricao: text("descricao").notNull(),
    responsavelUsuarioId: uuid("responsavel_usuario_id").references(() => usuario.id),
    responsavelStakeholderId: uuid("responsavel_stakeholder_id").references(() => stakeholder.id),
    prazo: date("prazo"),
    situacao: situacaoResposta("situacao").notNull().default("planejada"),
    acaoId: uuid("acao_id").references(() => acao.id),
    ...colunasControle(),
  },
  (t) => [
    check("risco_resposta_descricao_preenchida", sql`length(trim(${t.descricao})) > 0`),
    index("risco_resposta_risco_idx").on(t.riscoId),
    index("risco_resposta_acao_idx").on(t.acaoId),
  ],
);

/** Pessoas e instituições relacionadas ao risco. */
export const riscoStakeholder = pgTable(
  "risco_stakeholder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riscoId: uuid("risco_id")
      .notNull()
      .references(() => risco.id),
    stakeholderId: uuid("stakeholder_id")
      .notNull()
      .references(() => stakeholder.id),
    observacao: text("observacao"),
    ...colunasControle(),
  },
  (t) => [
    uniqueIndex("risco_stakeholder_unico").on(t.riscoId, t.stakeholderId).where(sql`${t.arquivadoEm} is null`),
    index("risco_stakeholder_stakeholder_idx").on(t.stakeholderId),
  ],
);
