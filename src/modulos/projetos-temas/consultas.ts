/**
 * Leitura e gravação de comitês (somente leitura), projetos e temas, comitês
 * participantes (D-023) e stakeholders dos contextos (D-030). As gravações
 * devem ser feitas dentro de comoUsuario(), para a trilha de auditoria.
 */
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/lib/banco/conexao";
import {
  comite,
  instituicao,
  pessoa,
  projetoTema,
  projetoTemaComite as participacao,
  registroAuditoria,
  stakeholder,
  stakeholderContexto as associacao,
  usuario,
} from "@/lib/banco/esquema";
import { escaparLike, normalizarTexto } from "@/lib/texto";
import type { DadosAssociacao, DadosParticipacao, DadosProjetoTema } from "./esquemas";
import type { SITUACOES_PROJETO_TEMA, TIPOS_PROJETO_TEMA } from "./rotulos";

const participacaoVigente = and(isNull(participacao.dataFim), isNull(participacao.arquivadoEm));

// --- Comitês (somente leitura — D-030) ---------------------------------------

/** Comitês com o total de projetos/temas em que são principais ou participantes. */
export async function listarComites(banco: Executor) {
  // Consulta de uma só tabela: o Drizzle não qualifica as colunas com o nome da
  // tabela, por isso as subconsultas usam apelidos e nomes escritos por extenso.
  return banco
    .select({
      id: comite.id,
      nome: comite.nome,
      tipo: comite.tipo,
      comiteSuperiorId: comite.comiteSuperiorId,
      comoPrincipal: sql<number>`(
        select count(*)::int from projeto_tema pt
        where pt.comite_id = comite.id and pt.arquivado_em is null
      )`,
      comoParticipante: sql<number>`(
        select count(*)::int from projeto_tema_comite ptc
        join projeto_tema pt on pt.id = ptc.projeto_tema_id
        where ptc.comite_id = comite.id and ptc.data_fim is null
          and ptc.arquivado_em is null and pt.arquivado_em is null
      )`,
    })
    .from(comite)
    .where(isNull(comite.arquivadoEm))
    .orderBy(sql`${comite.tipo} = 'tematico'`, asc(comite.nome));
}

export async function obterComite(banco: Executor, id: string) {
  const superior = alias(comite, "superior");
  const [encontrado] = await banco
    .select({ comite, superiorNome: superior.nome })
    .from(comite)
    .leftJoin(superior, eq(superior.id, comite.comiteSuperiorId))
    .where(eq(comite.id, id));
  return encontrado ? { ...encontrado.comite, superiorNome: encontrado.superiorNome } : null;
}

export async function listarSubordinados(banco: Executor, id: string) {
  return banco
    .select({ id: comite.id, nome: comite.nome })
    .from(comite)
    .where(and(eq(comite.comiteSuperiorId, id), isNull(comite.arquivadoEm)))
    .orderBy(asc(comite.nome));
}

/** Comitês ativos para as listas de seleção. */
export async function opcoesComites(banco: Executor) {
  return banco
    .select({ id: comite.id, nome: comite.nome })
    .from(comite)
    .where(isNull(comite.arquivadoEm))
    .orderBy(sql`${comite.tipo} = 'tematico'`, asc(comite.nome));
}

// --- Projetos e temas --------------------------------------------------------

function camposProjetoTema(dados: DadosProjetoTema) {
  return {
    tipo: dados.tipo,
    nome: dados.nome,
    nomeNormalizado: normalizarTexto(dados.nome),
    descricao: dados.descricao ?? null,
    comiteId: dados.comiteId,
    situacao: dados.situacao,
    dataInicio: dados.dataInicio ?? null,
    dataFim: dados.dataFim ?? null,
  };
}

export type FiltroProjetosTemas = {
  busca?: string;
  tipo?: (typeof TIPOS_PROJETO_TEMA)[number];
  situacao?: (typeof SITUACOES_PROJETO_TEMA)[number];
  /** Comitê principal ou participante vigente. */
  comiteId?: string;
  incluirArquivados?: boolean;
};

export async function listarProjetosTemas(banco: Executor, filtro: FiltroProjetosTemas = {}) {
  const condicoes: (SQL | undefined)[] = [];
  if (!filtro.incluirArquivados) condicoes.push(isNull(projetoTema.arquivadoEm));
  if (filtro.tipo) condicoes.push(eq(projetoTema.tipo, filtro.tipo));
  if (filtro.situacao) condicoes.push(eq(projetoTema.situacao, filtro.situacao));
  if (filtro.comiteId) {
    condicoes.push(
      or(
        eq(projetoTema.comiteId, filtro.comiteId),
        sql`exists (
          select 1 from ${participacao}
          where ${participacao.projetoTemaId} = ${projetoTema.id} and ${participacao.comiteId} = ${filtro.comiteId}
            and ${participacao.dataFim} is null and ${participacao.arquivadoEm} is null
        )`,
      ),
    );
  }
  const termo = normalizarTexto(filtro.busca ?? "");
  if (termo) condicoes.push(ilike(projetoTema.nomeNormalizado, `%${escaparLike(termo)}%`));

  return banco
    .select({
      id: projetoTema.id,
      tipo: projetoTema.tipo,
      nome: projetoTema.nome,
      situacao: projetoTema.situacao,
      arquivadoEm: projetoTema.arquivadoEm,
      comiteId: comite.id,
      comiteNome: comite.nome,
      participantes: sql<string | null>`(
        select string_agg(c2.nome, ', ' order by c2.nome) from ${participacao}
        join ${comite} c2 on c2.id = ${participacao.comiteId}
        where ${participacao.projetoTemaId} = ${projetoTema.id}
          and ${participacao.dataFim} is null and ${participacao.arquivadoEm} is null
      )`,
      stakeholders: sql<number>`(
        select count(*)::int from ${associacao}
        where ${associacao.projetoTemaId} = ${projetoTema.id}
          and ${associacao.dataFim} is null and ${associacao.arquivadoEm} is null
      )`,
    })
    .from(projetoTema)
    .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
    .where(and(...condicoes))
    .orderBy(asc(projetoTema.tipo), asc(projetoTema.nomeNormalizado))
    .limit(500);
}

export async function obterProjetoTema(banco: Executor, id: string) {
  const [encontrado] = await banco
    .select({ projetoTema, comiteNome: comite.nome })
    .from(projetoTema)
    .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
    .where(eq(projetoTema.id, id));
  return encontrado ? { ...encontrado.projetoTema, comiteNome: encontrado.comiteNome } : null;
}

export async function criarProjetoTema(banco: Executor, dados: DadosProjetoTema): Promise<string> {
  const [novo] = await banco
    .insert(projetoTema)
    .values(camposProjetoTema(dados))
    .returning({ id: projetoTema.id });
  return novo.id;
}

export async function atualizarProjetoTema(banco: Executor, id: string, dados: DadosProjetoTema) {
  await banco.update(projetoTema).set(camposProjetoTema(dados)).where(eq(projetoTema.id, id));
}

export async function definirArquivamentoProjetoTema(banco: Executor, id: string, arquivar: boolean) {
  await banco
    .update(projetoTema)
    .set({ arquivadoEm: arquivar ? sql`now()` : null })
    .where(eq(projetoTema.id, id));
}

/** Projetos ou temas com nome igual ou que contém o outro (em qualquer comitê). Alerta, não bloqueio. */
export async function possiveisDuplicidadesProjetoTema(
  banco: Executor,
  dados: Pick<DadosProjetoTema, "nome">,
  ignorarId?: string,
) {
  const nome = normalizarTexto(dados.nome);
  const criterios: SQL[] = [eq(projetoTema.nomeNormalizado, nome)];
  if (nome.length >= 8) {
    criterios.push(ilike(projetoTema.nomeNormalizado, `%${escaparLike(nome)}%`));
    criterios.push(sql`${nome} like '%' || ${projetoTema.nomeNormalizado} || '%'`);
  }
  const encontrados = await banco
    .select({
      id: projetoTema.id,
      nome: projetoTema.nome,
      nomeNormalizado: projetoTema.nomeNormalizado,
      tipo: projetoTema.tipo,
      comiteNome: comite.nome,
      arquivadoEm: projetoTema.arquivadoEm,
    })
    .from(projetoTema)
    .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
    .where(and(or(...criterios), ignorarId ? ne(projetoTema.id, ignorarId) : undefined))
    .limit(10);

  return encontrados.map((p) => ({
    id: p.id,
    nome: `${p.nome} (${p.comiteNome})`,
    motivo: p.nomeNormalizado === nome ? "Mesmo nome" : "Nome semelhante",
    arquivado: p.arquivadoEm !== null,
  }));
}

// --- Comitês participantes (D-023) -------------------------------------------

export async function listarParticipantes(banco: Executor, projetoTemaId: string) {
  return banco
    .select({
      id: participacao.id,
      comiteId: comite.id,
      comiteNome: comite.nome,
      dataInicio: participacao.dataInicio,
      dataFim: participacao.dataFim,
      observacao: participacao.observacao,
    })
    .from(participacao)
    .innerJoin(comite, eq(comite.id, participacao.comiteId))
    .where(and(eq(participacao.projetoTemaId, projetoTemaId), isNull(participacao.arquivadoEm)))
    .orderBy(sql`${participacao.dataFim} is null desc`, asc(comite.nome));
}

export async function criarParticipacao(banco: Executor, dados: DadosParticipacao): Promise<string> {
  const [nova] = await banco
    .insert(participacao)
    .values({
      projetoTemaId: dados.projetoTemaId,
      comiteId: dados.comiteId,
      dataInicio: dados.dataInicio ?? null,
      observacao: dados.observacao ?? null,
    })
    .returning({ id: participacao.id });
  return nova.id;
}

/** Encerra uma participação vigente. Retorna o projeto/tema, ou null se já estava encerrada. */
export async function encerrarParticipacao(banco: Executor, id: string, dataFim: string) {
  const [alterada] = await banco
    .update(participacao)
    .set({ dataFim })
    .where(and(eq(participacao.id, id), isNull(participacao.dataFim)))
    .returning({ projetoTemaId: participacao.projetoTemaId });
  return alterada?.projetoTemaId ?? null;
}

/** Projetos e temas de um comitê: como principal e como participante vigente. */
export async function projetosTemasDoComite(banco: Executor, comiteId: string) {
  const [principais, participacoes] = await Promise.all([
    banco
      .select({ id: projetoTema.id, nome: projetoTema.nome, tipo: projetoTema.tipo, situacao: projetoTema.situacao })
      .from(projetoTema)
      .where(and(eq(projetoTema.comiteId, comiteId), isNull(projetoTema.arquivadoEm)))
      .orderBy(asc(projetoTema.tipo), asc(projetoTema.nomeNormalizado)),
    banco
      .select({
        id: projetoTema.id,
        nome: projetoTema.nome,
        tipo: projetoTema.tipo,
        situacao: projetoTema.situacao,
        principalNome: comite.nome,
      })
      .from(participacao)
      .innerJoin(projetoTema, eq(projetoTema.id, participacao.projetoTemaId))
      .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
      .where(and(eq(participacao.comiteId, comiteId), participacaoVigente, isNull(projetoTema.arquivadoEm)))
      .orderBy(asc(projetoTema.tipo), asc(projetoTema.nomeNormalizado)),
  ]);
  return { principais, participacoes };
}

// --- Stakeholders dos contextos (D-030) --------------------------------------

/** Pessoas e instituições ativas, para a lista de seleção da associação. */
export async function opcoesStakeholders(banco: Executor) {
  const [pessoas, instituicoes] = await Promise.all([
    banco
      .select({ id: pessoa.id, nome: pessoa.nomeCompleto })
      .from(pessoa)
      .where(isNull(pessoa.arquivadoEm))
      .orderBy(asc(pessoa.nomeNormalizado)),
    banco
      .select({ id: instituicao.id, nome: instituicao.nome, sigla: instituicao.sigla })
      .from(instituicao)
      .where(isNull(instituicao.arquivadoEm))
      .orderBy(asc(instituicao.nomeNormalizado)),
  ]);
  return {
    pessoas,
    instituicoes: instituicoes.map((i) => ({ id: i.id, nome: i.sigla ? `${i.nome} (${i.sigla})` : i.nome })),
  };
}

export async function listarStakeholdersDoContexto(banco: Executor, projetoTemaId: string) {
  return banco
    .select({
      id: associacao.id,
      stakeholderId: stakeholder.id,
      tipoStakeholder: stakeholder.tipo,
      nome: sql<string>`coalesce(${pessoa.nomeCompleto}, ${instituicao.nome})`,
      tipoRelacao: associacao.tipoRelacao,
      descricao: associacao.descricao,
      dataInicio: associacao.dataInicio,
      dataFim: associacao.dataFim,
    })
    .from(associacao)
    .innerJoin(stakeholder, eq(stakeholder.id, associacao.stakeholderId))
    .leftJoin(pessoa, eq(pessoa.id, stakeholder.id))
    .leftJoin(instituicao, eq(instituicao.id, stakeholder.id))
    .where(and(eq(associacao.projetoTemaId, projetoTemaId), isNull(associacao.arquivadoEm)))
    .orderBy(
      sql`${associacao.dataFim} is null desc`,
      asc(associacao.tipoRelacao),
      sql`coalesce(${pessoa.nomeCompleto}, ${instituicao.nome})`,
    );
}

export async function criarAssociacao(banco: Executor, dados: DadosAssociacao): Promise<string> {
  const [nova] = await banco
    .insert(associacao)
    .values({
      projetoTemaId: dados.projetoTemaId,
      stakeholderId: dados.stakeholderId,
      tipoRelacao: dados.tipoRelacao,
      descricao: dados.descricao ?? null,
      dataInicio: dados.dataInicio ?? null,
    })
    .returning({ id: associacao.id });
  return nova.id;
}

/** Encerra uma associação vigente. Retorna o projeto/tema, ou null se já estava encerrada. */
export async function encerrarAssociacao(banco: Executor, id: string, dataFim: string) {
  const [alterada] = await banco
    .update(associacao)
    .set({ dataFim })
    .where(and(eq(associacao.id, id), isNull(associacao.dataFim)))
    .returning({ projetoTemaId: associacao.projetoTemaId, stakeholderId: associacao.stakeholderId });
  return alterada ?? null;
}

/** Projetos e temas a que uma pessoa ou instituição está associada. */
export async function contextosDoStakeholder(banco: Executor, stakeholderId: string) {
  return banco
    .select({
      id: associacao.id,
      projetoTemaId: projetoTema.id,
      projetoTemaNome: projetoTema.nome,
      tipo: projetoTema.tipo,
      comiteNome: comite.nome,
      tipoRelacao: associacao.tipoRelacao,
      descricao: associacao.descricao,
      dataInicio: associacao.dataInicio,
      dataFim: associacao.dataFim,
      projetoArquivado: projetoTema.arquivadoEm,
    })
    .from(associacao)
    .innerJoin(projetoTema, eq(projetoTema.id, associacao.projetoTemaId))
    .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
    .where(and(eq(associacao.stakeholderId, stakeholderId), isNull(associacao.arquivadoEm)))
    .orderBy(sql`${associacao.dataFim} is null desc`, asc(projetoTema.nomeNormalizado));
}

export type ContextoDoStakeholder = Awaited<ReturnType<typeof contextosDoStakeholder>>[number];

// --- Histórico ---------------------------------------------------------------

/** Trilha de auditoria de um projeto ou tema, incluindo participações e associações. */
export async function historicoDoProjetoTema(banco: Executor, id: string) {
  const dados = sql`coalesce(${registroAuditoria.dadosNovos}, ${registroAuditoria.dadosAnteriores})`;
  return banco
    .select({
      id: registroAuditoria.id,
      tabela: registroAuditoria.tabela,
      operacao: registroAuditoria.operacao,
      dadosAnteriores: registroAuditoria.dadosAnteriores,
      dadosNovos: registroAuditoria.dadosNovos,
      ocorridoEm: registroAuditoria.ocorridoEm,
      usuarioNome: usuario.nome,
    })
    .from(registroAuditoria)
    .leftJoin(usuario, eq(usuario.id, registroAuditoria.usuarioId))
    .where(
      or(
        and(eq(registroAuditoria.tabela, "projeto_tema"), eq(registroAuditoria.registroId, id)),
        and(
          inArray(registroAuditoria.tabela, ["projeto_tema_comite", "stakeholder_contexto"]),
          sql`${dados} ->> 'projeto_tema_id' = ${id}`,
        ),
      ),
    )
    .orderBy(desc(registroAuditoria.ocorridoEm), desc(registroAuditoria.id))
    .limit(200);
}
