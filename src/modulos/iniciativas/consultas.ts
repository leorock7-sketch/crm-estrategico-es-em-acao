/**
 * Leitura e gravação das iniciativas (Matriz de Iniciativas) e das suas ligações
 * com projetos, temas e stakeholders. As gravações devem ser feitas dentro de
 * comoUsuario(), para a trilha de auditoria. Retirar uma ligação é arquivá-la.
 */
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";
import {
  comite,
  iniciativa,
  iniciativaProjetoTema as iniciativaProjeto,
  iniciativaStakeholder,
  instituicao,
  pessoa,
  projetoTema,
  registroAuditoria,
  stakeholder,
  usuario,
} from "@/lib/banco/esquema";
import { escaparLike, normalizarTexto } from "@/lib/texto";
import { projetoVisivel, type ProjetosVisiveis } from "@/modulos/acesso/visibilidade";
import type { DadosIniciativa, DadosNovaIniciativa, DadosStakeholderDaIniciativa } from "./esquemas";
import {
  type PrioridadeIniciativa,
  type SituacaoIniciativa,
  SITUACOES_INICIATIVA_EM_CURSO,
  type TipoIniciativa,
} from "./rotulos";

/** Nome de exibição de um stakeholder (pessoa ou instituição), para consultas com os dois cadastros. */
export const nomeDoStakeholder = sql<string>`coalesce(${pessoa.nomeCompleto}, ${instituicao.nome})`;

/** A iniciativa (referenciada pelo nome da tabela) tem projeto ou tema visível. */
function iniciativaVisivel(visiveis: ProjetosVisiveis): SQL | undefined {
  if (visiveis === "todos") return undefined;
  return sql`exists (
    select 1 from iniciativa_projeto_tema ipv
    where ipv.iniciativa_id = iniciativa.id and ipv.arquivado_em is null
      and ${projetoVisivel(sql`ipv.projeto_tema_id`, visiveis)}
  )`;
}

function camposIniciativa(dados: DadosIniciativa) {
  return {
    tipo: dados.tipo,
    titulo: dados.titulo,
    tituloNormalizado: normalizarTexto(dados.titulo),
    descricao: dados.descricao ?? null,
    origem: dados.origem ?? null,
    situacao: dados.situacao,
    prioridade: dados.prioridade ?? null,
    responsavelId: dados.responsavelId ?? null,
    dataAbertura: dados.dataAbertura,
    dataPrevistaConclusao: dados.dataPrevistaConclusao ?? null,
    dataConclusao: dados.dataConclusao ?? null,
  };
}

// --- Iniciativas -------------------------------------------------------------

/** Cria a iniciativa já ligada aos projetos e temas (exigência verificada também no banco). */
export async function criarIniciativa(banco: Executor, dados: DadosNovaIniciativa): Promise<string> {
  const [nova] = await banco.insert(iniciativa).values(camposIniciativa(dados)).returning({ id: iniciativa.id });
  for (const projetoTemaId of new Set(dados.projetos)) {
    await banco.insert(iniciativaProjeto).values({ iniciativaId: nova.id, projetoTemaId });
  }
  return nova.id;
}

export async function atualizarIniciativa(banco: Executor, id: string, dados: DadosIniciativa) {
  await banco.update(iniciativa).set(camposIniciativa(dados)).where(eq(iniciativa.id, id));
}

export async function definirArquivamentoIniciativa(banco: Executor, id: string, arquivar: boolean) {
  await banco
    .update(iniciativa)
    .set({ arquivadoEm: arquivar ? sql`now()` : null })
    .where(eq(iniciativa.id, id));
}

export async function obterIniciativa(banco: Executor, id: string) {
  const [encontrada] = await banco
    .select({ iniciativa, responsavelNome: usuario.nome })
    .from(iniciativa)
    .leftJoin(usuario, eq(usuario.id, iniciativa.responsavelId))
    .where(eq(iniciativa.id, id));
  return encontrada ? { ...encontrada.iniciativa, responsavelNome: encontrada.responsavelNome } : null;
}

export type FiltroIniciativas = {
  busca?: string;
  tipo?: TipoIniciativa;
  /** Uma situação ou "em_curso" (todas as não encerradas). */
  situacao?: SituacaoIniciativa | "em_curso";
  prioridade?: PrioridadeIniciativa;
  /** Comitê principal ou participante vigente de algum projeto ou tema da iniciativa. */
  comiteId?: string;
  projetoTemaId?: string;
  responsavelId?: string;
  stakeholderId?: string;
  incluirArquivadas?: boolean;
};

/** Matriz de Iniciativas em forma de lista filtrável (Q-20, provisória). */
export async function listarIniciativas(
  banco: Executor,
  filtro: FiltroIniciativas = {},
  visiveis: ProjetosVisiveis = "todos",
) {
  const condicoes: (SQL | undefined)[] = [iniciativaVisivel(visiveis)];
  if (!filtro.incluirArquivadas) condicoes.push(isNull(iniciativa.arquivadoEm));
  if (filtro.tipo) condicoes.push(eq(iniciativa.tipo, filtro.tipo));
  if (filtro.situacao === "em_curso") condicoes.push(inArray(iniciativa.situacao, [...SITUACOES_INICIATIVA_EM_CURSO]));
  else if (filtro.situacao) condicoes.push(eq(iniciativa.situacao, filtro.situacao));
  if (filtro.prioridade) condicoes.push(eq(iniciativa.prioridade, filtro.prioridade));
  if (filtro.responsavelId) condicoes.push(eq(iniciativa.responsavelId, filtro.responsavelId));
  if (filtro.projetoTemaId) {
    condicoes.push(sql`exists (
      select 1 from iniciativa_projeto_tema ipf
      where ipf.iniciativa_id = iniciativa.id and ipf.arquivado_em is null and ipf.projeto_tema_id = ${filtro.projetoTemaId}
    )`);
  }
  if (filtro.comiteId) {
    condicoes.push(sql`exists (
      select 1 from iniciativa_projeto_tema ipc
      join projeto_tema ptc on ptc.id = ipc.projeto_tema_id
      where ipc.iniciativa_id = iniciativa.id and ipc.arquivado_em is null
        and (ptc.comite_id = ${filtro.comiteId} or exists (
          select 1 from projeto_tema_comite ptcc
          where ptcc.projeto_tema_id = ptc.id and ptcc.comite_id = ${filtro.comiteId}
            and ptcc.data_fim is null and ptcc.arquivado_em is null
        ))
    )`);
  }
  if (filtro.stakeholderId) {
    condicoes.push(sql`exists (
      select 1 from iniciativa_stakeholder isf
      where isf.iniciativa_id = iniciativa.id and isf.arquivado_em is null and isf.stakeholder_id = ${filtro.stakeholderId}
    )`);
  }
  const termo = normalizarTexto(filtro.busca ?? "");
  if (termo) condicoes.push(ilike(iniciativa.tituloNormalizado, `%${escaparLike(termo)}%`));

  return banco
    .select({
      id: iniciativa.id,
      tipo: iniciativa.tipo,
      titulo: iniciativa.titulo,
      situacao: iniciativa.situacao,
      prioridade: iniciativa.prioridade,
      dataAbertura: iniciativa.dataAbertura,
      dataPrevistaConclusao: iniciativa.dataPrevistaConclusao,
      arquivadoEm: iniciativa.arquivadoEm,
      responsavelNome: usuario.nome,
      projetos: sql<string | null>`(
        select string_agg(pt.nome, ', ' order by pt.nome) from iniciativa_projeto_tema ip
        join projeto_tema pt on pt.id = ip.projeto_tema_id
        where ip.iniciativa_id = iniciativa.id and ip.arquivado_em is null
      )`,
      comites: sql<string | null>`(
        select string_agg(distinct c.nome, ', ') from iniciativa_projeto_tema ip
        join projeto_tema pt on pt.id = ip.projeto_tema_id
        join comite c on c.id = pt.comite_id
        where ip.iniciativa_id = iniciativa.id and ip.arquivado_em is null
      )`,
      stakeholders: sql<number>`(
        select count(distinct ist.stakeholder_id)::int from iniciativa_stakeholder ist
        where ist.iniciativa_id = iniciativa.id and ist.arquivado_em is null
      )`,
      interacoes: sql<number>`(
        select count(*)::int from interacao_iniciativa ii
        join interacao it on it.id = ii.interacao_id
        where ii.iniciativa_id = iniciativa.id and ii.arquivado_em is null and it.arquivado_em is null
      )`,
      compromissosPendentes: sql<number>`(
        select count(*)::int from compromisso cp
        where cp.arquivado_em is null and cp.situacao in ('aberto', 'em_andamento')
          and (cp.iniciativa_id = iniciativa.id or (cp.iniciativa_id is null and cp.interacao_id in (
            select ii2.interacao_id from interacao_iniciativa ii2
            where ii2.iniciativa_id = iniciativa.id and ii2.arquivado_em is null
          )))
      )`,
    })
    .from(iniciativa)
    .leftJoin(usuario, eq(usuario.id, iniciativa.responsavelId))
    .where(and(...condicoes))
    .orderBy(desc(iniciativa.dataAbertura), asc(iniciativa.tituloNormalizado))
    .limit(500);
}

/** Iniciativas não arquivadas, para listas de seleção. */
export async function opcoesIniciativas(banco: Executor, visiveis: ProjetosVisiveis = "todos") {
  return banco
    .select({ id: iniciativa.id, titulo: iniciativa.titulo, tipo: iniciativa.tipo, situacao: iniciativa.situacao })
    .from(iniciativa)
    .where(and(isNull(iniciativa.arquivadoEm), iniciativaVisivel(visiveis)))
    .orderBy(asc(iniciativa.tituloNormalizado));
}

/** Projetos e temas ativos, para listas de seleção. */
export async function opcoesProjetosTemas(banco: Executor, visiveis: ProjetosVisiveis = "todos") {
  return banco
    .select({ id: projetoTema.id, nome: projetoTema.nome, tipo: projetoTema.tipo, comiteNome: comite.nome })
    .from(projetoTema)
    .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
    .where(and(isNull(projetoTema.arquivadoEm), projetoVisivel(sql`${projetoTema.id}`, visiveis)))
    .orderBy(asc(projetoTema.tipo), asc(projetoTema.nomeNormalizado));
}

/** A iniciativa pode ser vista com as permissões informadas? */
export async function iniciativaEhVisivel(banco: Executor, id: string, visiveis: ProjetosVisiveis) {
  if (visiveis === "todos") return true;
  const projetos = await banco
    .select({ projetoTemaId: iniciativaProjeto.projetoTemaId })
    .from(iniciativaProjeto)
    .where(and(eq(iniciativaProjeto.iniciativaId, id), isNull(iniciativaProjeto.arquivadoEm)));
  return projetos.some((p) => visiveis.includes(p.projetoTemaId));
}

// --- Projetos e temas da iniciativa ------------------------------------------

export async function projetosDaIniciativa(banco: Executor, iniciativaId: string) {
  return banco
    .select({
      id: iniciativaProjeto.id,
      projetoTemaId: projetoTema.id,
      nome: projetoTema.nome,
      tipo: projetoTema.tipo,
      comiteNome: comite.nome,
      projetoArquivado: projetoTema.arquivadoEm,
    })
    .from(iniciativaProjeto)
    .innerJoin(projetoTema, eq(projetoTema.id, iniciativaProjeto.projetoTemaId))
    .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
    .where(and(eq(iniciativaProjeto.iniciativaId, iniciativaId), isNull(iniciativaProjeto.arquivadoEm)))
    .orderBy(asc(projetoTema.tipo), asc(projetoTema.nomeNormalizado));
}

export async function incluirProjetoNaIniciativa(banco: Executor, iniciativaId: string, projetoTemaId: string) {
  const [nova] = await banco
    .insert(iniciativaProjeto)
    .values({ iniciativaId, projetoTemaId })
    .returning({ id: iniciativaProjeto.id });
  return nova.id;
}

/** Retira (arquiva) a ligação. Retorna a iniciativa, ou null se já estava retirada. */
export async function retirarProjetoDaIniciativa(banco: Executor, ligacaoId: string, iniciativaId: string) {
  const [alterada] = await banco
    .update(iniciativaProjeto)
    .set({ arquivadoEm: sql`now()` })
    .where(
      and(
        eq(iniciativaProjeto.id, ligacaoId),
        eq(iniciativaProjeto.iniciativaId, iniciativaId),
        isNull(iniciativaProjeto.arquivadoEm),
      ),
    )
    .returning({ iniciativaId: iniciativaProjeto.iniciativaId, projetoTemaId: iniciativaProjeto.projetoTemaId });
  return alterada ?? null;
}

// --- Stakeholders da iniciativa ----------------------------------------------

export async function stakeholdersDaIniciativa(banco: Executor, iniciativaId: string) {
  return banco
    .select({
      id: iniciativaStakeholder.id,
      stakeholderId: stakeholder.id,
      tipoStakeholder: stakeholder.tipo,
      nome: nomeDoStakeholder,
      papel: iniciativaStakeholder.papel,
      observacao: iniciativaStakeholder.observacao,
    })
    .from(iniciativaStakeholder)
    .innerJoin(stakeholder, eq(stakeholder.id, iniciativaStakeholder.stakeholderId))
    .leftJoin(pessoa, eq(pessoa.id, stakeholder.id))
    .leftJoin(instituicao, eq(instituicao.id, stakeholder.id))
    .where(and(eq(iniciativaStakeholder.iniciativaId, iniciativaId), isNull(iniciativaStakeholder.arquivadoEm)))
    .orderBy(asc(iniciativaStakeholder.papel), nomeDoStakeholder);
}

export async function incluirStakeholderNaIniciativa(banco: Executor, dados: DadosStakeholderDaIniciativa) {
  const [nova] = await banco
    .insert(iniciativaStakeholder)
    .values({
      iniciativaId: dados.iniciativaId,
      stakeholderId: dados.stakeholderId,
      papel: dados.papel,
      observacao: dados.observacao ?? null,
    })
    .returning({ id: iniciativaStakeholder.id });
  return nova.id;
}

export async function retirarStakeholderDaIniciativa(banco: Executor, ligacaoId: string, iniciativaId: string) {
  const [alterada] = await banco
    .update(iniciativaStakeholder)
    .set({ arquivadoEm: sql`now()` })
    .where(
      and(
        eq(iniciativaStakeholder.id, ligacaoId),
        eq(iniciativaStakeholder.iniciativaId, iniciativaId),
        isNull(iniciativaStakeholder.arquivadoEm),
      ),
    )
    .returning({ iniciativaId: iniciativaStakeholder.iniciativaId, stakeholderId: iniciativaStakeholder.stakeholderId });
  return alterada ?? null;
}

/** Iniciativas de uma pessoa ou instituição, com os papéis. */
export async function iniciativasDoStakeholder(
  banco: Executor,
  stakeholderId: string,
  visiveis: ProjetosVisiveis = "todos",
) {
  return banco
    .select({
      id: iniciativa.id,
      titulo: iniciativa.titulo,
      tipo: iniciativa.tipo,
      situacao: iniciativa.situacao,
      papeis: sql<string[]>`array_agg(${iniciativaStakeholder.papel}::text order by ${iniciativaStakeholder.papel})`,
    })
    .from(iniciativaStakeholder)
    .innerJoin(iniciativa, eq(iniciativa.id, iniciativaStakeholder.iniciativaId))
    .where(
      and(
        eq(iniciativaStakeholder.stakeholderId, stakeholderId),
        isNull(iniciativaStakeholder.arquivadoEm),
        isNull(iniciativa.arquivadoEm),
        iniciativaVisivel(visiveis),
      ),
    )
    .groupBy(iniciativa.id)
    .orderBy(desc(iniciativa.dataAbertura));
}

/** Iniciativas ligadas a um projeto ou tema. */
export async function iniciativasDoProjetoTema(banco: Executor, projetoTemaId: string) {
  return banco
    .select({
      id: iniciativa.id,
      titulo: iniciativa.titulo,
      tipo: iniciativa.tipo,
      situacao: iniciativa.situacao,
      responsavelNome: usuario.nome,
    })
    .from(iniciativaProjeto)
    .innerJoin(iniciativa, eq(iniciativa.id, iniciativaProjeto.iniciativaId))
    .leftJoin(usuario, eq(usuario.id, iniciativa.responsavelId))
    .where(
      and(
        eq(iniciativaProjeto.projetoTemaId, projetoTemaId),
        isNull(iniciativaProjeto.arquivadoEm),
        isNull(iniciativa.arquivadoEm),
      ),
    )
    .orderBy(desc(iniciativa.dataAbertura));
}

// --- Histórico ---------------------------------------------------------------

/** Trilha de auditoria da iniciativa e das suas ligações com projetos e stakeholders. */
export async function historicoDaIniciativa(banco: Executor, id: string) {
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
        and(eq(registroAuditoria.tabela, "iniciativa"), eq(registroAuditoria.registroId, id)),
        and(
          inArray(registroAuditoria.tabela, ["iniciativa_projeto_tema", "iniciativa_stakeholder"]),
          sql`${dados} ->> 'iniciativa_id' = ${id}`,
        ),
      ),
    )
    .orderBy(desc(registroAuditoria.ocorridoEm), desc(registroAuditoria.id))
    .limit(200);
}
