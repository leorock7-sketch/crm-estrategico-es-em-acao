/**
 * Estrutura das tabelas do banco de dados (Etapa 1).
 *
 * Fonte única da estrutura: a partir deste arquivo o drizzle-kit gera os
 * scripts SQL em ./migracoes. Gatilhos (auditoria, preenchimento automático e
 * regras que envolvem mais de uma linha) ficam em scripts SQL próprios, na
 * mesma pasta. Documentação: docs/MODELO_DADOS.md.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  jsonb,
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

// --- Acesso e auditoria ------------------------------------------------------

export const usuario = pgTable(
  "usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
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
