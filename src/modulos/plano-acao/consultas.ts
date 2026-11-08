/**
 * Leitura e gravação do Plano de Ação (D-072): um plano por projeto ou tema,
 * pilares ou eixos próprios, versões com aprovação, ações e marcos planejados
 * por versão e acompanhamento sem aprovação. As gravações devem ser feitas
 * dentro de comoUsuario(), para a trilha de auditoria.
 */
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/lib/banco/conexao";
import {
  acao,
  acaoAcompanhamento,
  acaoMarco,
  acaoPlanejamento,
  acaoStakeholder,
  comite,
  compromisso,
  iniciativa,
  instituicao,
  marcoPlanejamento,
  pessoa,
  planoAcao,
  planoAcaoDecisao,
  planoAcaoVersao,
  planoEixo,
  projetoTema,
  registroAuditoria,
  stakeholder,
  usuario,
} from "@/lib/banco/esquema";
import { projetoVisivel, type ProjetosVisiveis } from "@/modulos/acesso/visibilidade";
import type {
  DadosAcaoPlanejada,
  DadosAcompanhamentoAcao,
  DadosEixo,
  DadosMarco,
  DadosNovoPlano,
  DadosPlano,
  DadosStakeholderAcao,
} from "./esquemas";
import { acaoAtrasada, PILARES_REFERENCIA_INFRAESTRUTURA, proximoCodigo, type SituacaoAcao } from "./rotulos";

/** Regra de negócio violada, com mensagem para o usuário. */
export class ErroDoPlano extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDoPlano";
  }
}

const decididaPorUsuario = alias(usuario, "decidida_por_usuario");
const responsavelExterno = alias(stakeholder, "responsavel_externo");
const pessoaResponsavel = alias(pessoa, "pessoa_responsavel");
const instituicaoResponsavel = alias(instituicao, "instituicao_responsavel");
const nomeResponsavelExterno = sql<string | null>`coalesce(${pessoaResponsavel.nomeCompleto}, ${instituicaoResponsavel.nome})`;

/** Situação mais recente registrada para a ação (referenciada pela expressão informada). */
const situacaoAtual = (acaoId: SQL) => sql`(
  select aa.situacao from acao_acompanhamento aa
  where aa.acao_id = ${acaoId} and aa.situacao is not null and aa.arquivado_em is null
  order by aa.data desc, aa.criado_em desc limit 1
)`;

/** O marco está alcançado se o registro mais recente sobre ele o dá como alcançado. */
const marcoAlcancado = (marcoId: SQL) => sql`coalesce((
  select aa.marco_alcancado from acao_acompanhamento aa
  where aa.marco_id = ${marcoId} and aa.arquivado_em is null
  order by aa.data desc, aa.criado_em desc limit 1
), false)`;

// --- Planos ------------------------------------------------------------------

/** Cria o plano, com os pilares de referência se pedido, e a versão 1 em rascunho. */
export async function criarPlano(banco: Executor, dados: DadosNovoPlano): Promise<string> {
  const [novo] = await banco
    .insert(planoAcao)
    .values({
      projetoTemaId: dados.projetoTemaId,
      titulo: dados.titulo,
      objetivo: dados.objetivo ?? null,
      responsavelId: dados.responsavelId ?? null,
    })
    .returning({ id: planoAcao.id });
  if (dados.usarPilaresReferencia) {
    for (const [ordem, pilar] of PILARES_REFERENCIA_INFRAESTRUTURA.entries()) {
      await banco.insert(planoEixo).values({ planoAcaoId: novo.id, codigo: pilar.codigo, nome: pilar.nome, ordem });
    }
  }
  await banco.insert(planoAcaoVersao).values({ planoAcaoId: novo.id, numeroVersao: 1 });
  return novo.id;
}

export async function atualizarPlano(banco: Executor, id: string, dados: DadosPlano) {
  await banco
    .update(planoAcao)
    .set({ titulo: dados.titulo, objetivo: dados.objetivo ?? null, responsavelId: dados.responsavelId ?? null })
    .where(eq(planoAcao.id, id));
}

export async function obterPlano(banco: Executor, id: string) {
  const [encontrado] = await banco
    .select({
      plano: planoAcao,
      projetoNome: projetoTema.nome,
      projetoTipo: projetoTema.tipo,
      comiteNome: comite.nome,
      responsavelNome: usuario.nome,
    })
    .from(planoAcao)
    .innerJoin(projetoTema, eq(projetoTema.id, planoAcao.projetoTemaId))
    .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
    .leftJoin(usuario, eq(usuario.id, planoAcao.responsavelId))
    .where(eq(planoAcao.id, id));
  return encontrado
    ? {
        ...encontrado.plano,
        projetoNome: encontrado.projetoNome,
        projetoTipo: encontrado.projetoTipo,
        comiteNome: encontrado.comiteNome,
        responsavelNome: encontrado.responsavelNome,
      }
    : null;
}

export async function planoDoProjetoTema(banco: Executor, projetoTemaId: string): Promise<string | null> {
  const [encontrado] = await banco
    .select({ id: planoAcao.id })
    .from(planoAcao)
    .where(and(eq(planoAcao.projetoTemaId, projetoTemaId), isNull(planoAcao.arquivadoEm)));
  return encontrado?.id ?? null;
}

/** Planos com a versão vigente, a versão em elaboração e o andamento das ações vigentes. */
export async function listarPlanos(
  banco: Executor,
  hoje: string,
  visiveis: ProjetosVisiveis = "todos",
  projetoTemaId?: string,
) {
  const vigente = sql`(select v.id from plano_acao_versao v where v.plano_acao_id = plano_acao.id and v.situacao = 'aprovada')`;
  return banco
    .select({
      id: planoAcao.id,
      titulo: planoAcao.titulo,
      projetoTemaId: projetoTema.id,
      projetoNome: projetoTema.nome,
      comiteNome: comite.nome,
      responsavelNome: usuario.nome,
      versaoVigente: sql<number | null>`(select v.numero_versao from plano_acao_versao v where v.plano_acao_id = plano_acao.id and v.situacao = 'aprovada')`,
      versaoElaboracao: sql<string | null>`(
        select v.numero_versao || ':' || v.situacao from plano_acao_versao v
        where v.plano_acao_id = plano_acao.id and v.situacao in ('rascunho', 'em_aprovacao') and v.arquivado_em is null
      )`,
      acoes: sql<number>`(select count(*)::int from acao_planejamento ap where ap.plano_acao_versao_id = ${vigente} and ap.arquivado_em is null)`,
      atrasadas: sql<number>`(
        select count(*)::int from acao_planejamento ap
        where ap.plano_acao_versao_id = ${vigente} and ap.arquivado_em is null and ap.fim_previsto < ${hoje}::date
          and coalesce(${situacaoAtual(sql`ap.acao_id`)}::text, 'nao_iniciada') not in ('concluida', 'cancelada')
      )`,
      marcosPrevistos: sql<number>`(select count(*)::int from marco_planejamento mp where mp.plano_acao_versao_id = ${vigente} and mp.arquivado_em is null)`,
      marcosAlcancados: sql<number>`(
        select count(*)::int from marco_planejamento mp
        where mp.plano_acao_versao_id = ${vigente} and mp.arquivado_em is null and ${marcoAlcancado(sql`mp.marco_id`)}
      )`,
    })
    .from(planoAcao)
    .innerJoin(projetoTema, eq(projetoTema.id, planoAcao.projetoTemaId))
    .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
    .leftJoin(usuario, eq(usuario.id, planoAcao.responsavelId))
    .where(
      and(
        isNull(planoAcao.arquivadoEm),
        projetoVisivel(sql`${planoAcao.projetoTemaId}`, visiveis),
        projetoTemaId ? eq(planoAcao.projetoTemaId, projetoTemaId) : undefined,
      ),
    )
    .orderBy(asc(projetoTema.nomeNormalizado))
    .limit(500);
}

export type PlanoDaLista = Awaited<ReturnType<typeof listarPlanos>>[number];

/** Planos dos projetos ou temas informados (para converter compromissos em ações). */
export async function opcoesPlanos(banco: Executor, projetoTemaIds: readonly string[]) {
  if (projetoTemaIds.length === 0) return [];
  return banco
    .select({ id: planoAcao.id, titulo: planoAcao.titulo, projetoNome: projetoTema.nome })
    .from(planoAcao)
    .innerJoin(projetoTema, eq(projetoTema.id, planoAcao.projetoTemaId))
    .where(and(inArray(planoAcao.projetoTemaId, [...projetoTemaIds]), isNull(planoAcao.arquivadoEm)))
    .orderBy(asc(projetoTema.nomeNormalizado));
}

export async function planoEhVisivel(banco: Executor, planoId: string, visiveis: ProjetosVisiveis) {
  if (visiveis === "todos") return true;
  const plano = await obterPlano(banco, planoId);
  return plano !== null && visiveis.includes(plano.projetoTemaId);
}

// --- Pilares ou eixos --------------------------------------------------------

export async function eixosDoPlano(banco: Executor, planoId: string) {
  return banco
    .select({
      id: planoEixo.id,
      codigo: planoEixo.codigo,
      nome: planoEixo.nome,
      descricao: planoEixo.descricao,
      objetivo: planoEixo.objetivo,
      ordem: planoEixo.ordem,
    })
    .from(planoEixo)
    .where(and(eq(planoEixo.planoAcaoId, planoId), isNull(planoEixo.arquivadoEm)))
    .orderBy(asc(planoEixo.ordem), asc(planoEixo.codigo));
}

export async function criarEixo(banco: Executor, dados: DadosEixo): Promise<string> {
  const existentes = await banco
    .select({ codigo: planoEixo.codigo, ordem: planoEixo.ordem })
    .from(planoEixo)
    .where(eq(planoEixo.planoAcaoId, dados.planoAcaoId));
  const [novo] = await banco
    .insert(planoEixo)
    .values({
      planoAcaoId: dados.planoAcaoId,
      codigo: proximoCodigo(
        existentes.map((e) => e.codigo),
        "P",
        1,
      ),
      nome: dados.nome,
      descricao: dados.descricao ?? null,
      objetivo: dados.objetivo ?? null,
      ordem: existentes.length ? Math.max(...existentes.map((e) => e.ordem)) + 1 : 0,
    })
    .returning({ id: planoEixo.id });
  return novo.id;
}

export async function atualizarEixo(banco: Executor, id: string, dados: Omit<DadosEixo, "planoAcaoId">) {
  await banco
    .update(planoEixo)
    .set({ nome: dados.nome, descricao: dados.descricao ?? null, objetivo: dados.objetivo ?? null })
    .where(eq(planoEixo.id, id));
}

export async function arquivarEixo(banco: Executor, id: string) {
  await banco.update(planoEixo).set({ arquivadoEm: sql`now()` }).where(and(eq(planoEixo.id, id), isNull(planoEixo.arquivadoEm)));
}

// --- Versões -----------------------------------------------------------------

export async function listarVersoes(banco: Executor, planoId: string) {
  return banco
    .select({
      id: planoAcaoVersao.id,
      numeroVersao: planoAcaoVersao.numeroVersao,
      situacao: planoAcaoVersao.situacao,
      motivoAlteracao: planoAcaoVersao.motivoAlteracao,
      propostaEm: planoAcaoVersao.propostaEm,
      decididaEm: planoAcaoVersao.decididaEm,
      decididaPorNome: decididaPorUsuario.nome,
      parecer: planoAcaoVersao.parecer,
      criadoEm: planoAcaoVersao.criadoEm,
      arquivadoEm: planoAcaoVersao.arquivadoEm,
    })
    .from(planoAcaoVersao)
    .leftJoin(decididaPorUsuario, eq(decididaPorUsuario.id, planoAcaoVersao.decididaPor))
    .where(eq(planoAcaoVersao.planoAcaoId, planoId))
    .orderBy(desc(planoAcaoVersao.numeroVersao));
}

export async function obterVersao(banco: Executor, id: string) {
  const [encontrada] = await banco
    .select({ versao: planoAcaoVersao, decididaPorNome: decididaPorUsuario.nome })
    .from(planoAcaoVersao)
    .leftJoin(decididaPorUsuario, eq(decididaPorUsuario.id, planoAcaoVersao.decididaPor))
    .where(eq(planoAcaoVersao.id, id));
  return encontrada ? { ...encontrada.versao, decididaPorNome: encontrada.decididaPorNome } : null;
}

export async function versaoVigente(banco: Executor, planoId: string) {
  const [v] = await banco
    .select({ id: planoAcaoVersao.id, numeroVersao: planoAcaoVersao.numeroVersao })
    .from(planoAcaoVersao)
    .where(and(eq(planoAcaoVersao.planoAcaoId, planoId), eq(planoAcaoVersao.situacao, "aprovada")));
  return v ?? null;
}

export async function versaoEmElaboracao(banco: Executor, planoId: string) {
  const [v] = await banco
    .select({ id: planoAcaoVersao.id, numeroVersao: planoAcaoVersao.numeroVersao, situacao: planoAcaoVersao.situacao })
    .from(planoAcaoVersao)
    .where(
      and(
        eq(planoAcaoVersao.planoAcaoId, planoId),
        inArray(planoAcaoVersao.situacao, ["rascunho", "em_aprovacao"]),
        isNull(planoAcaoVersao.arquivadoEm),
      ),
    );
  return v ?? null;
}

/** Nova versão em rascunho, como cópia completa da vigente (ações e marcos). */
export async function criarNovaVersao(banco: Executor, planoId: string): Promise<string> {
  if (await versaoEmElaboracao(banco, planoId)) {
    throw new ErroDoPlano("Já existe uma versão em elaboração ou em aprovação deste plano.");
  }
  const [{ maior }] = await banco
    .select({ maior: sql<number>`coalesce(max(${planoAcaoVersao.numeroVersao}), 0)::int` })
    .from(planoAcaoVersao)
    .where(eq(planoAcaoVersao.planoAcaoId, planoId));
  const [nova] = await banco
    .insert(planoAcaoVersao)
    .values({ planoAcaoId: planoId, numeroVersao: maior + 1 })
    .returning({ id: planoAcaoVersao.id });
  const vigente = await versaoVigente(banco, planoId);
  if (vigente) {
    await banco.execute(sql`
      insert into acao_planejamento (acao_id, plano_acao_versao_id, eixo_id, titulo, descricao, justificativa,
        responsavel_usuario_id, responsavel_stakeholder_id, inicio_previsto, fim_previsto, periodicidade)
      select acao_id, ${nova.id}, eixo_id, titulo, descricao, justificativa,
        responsavel_usuario_id, responsavel_stakeholder_id, inicio_previsto, fim_previsto, periodicidade
      from acao_planejamento where plano_acao_versao_id = ${vigente.id} and arquivado_em is null`);
    await banco.execute(sql`
      insert into marco_planejamento (marco_id, plano_acao_versao_id, descricao, prazo_previsto)
      select marco_id, ${nova.id}, descricao, prazo_previsto
      from marco_planejamento where plano_acao_versao_id = ${vigente.id} and arquivado_em is null`);
  }
  return nova.id;
}

/** Descarta (arquiva) a versão em rascunho; o histórico é preservado. */
export async function descartarRascunho(banco: Executor, versaoId: string) {
  const [alterada] = await banco
    .update(planoAcaoVersao)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(planoAcaoVersao.id, versaoId), eq(planoAcaoVersao.situacao, "rascunho"), isNull(planoAcaoVersao.arquivadoEm)))
    .returning({ planoAcaoId: planoAcaoVersao.planoAcaoId });
  return alterada?.planoAcaoId ?? null;
}

/** Envia o rascunho para aprovação, com o motivo da alteração (obrigatório a partir da versão 2). */
export async function enviarParaAprovacao(banco: Executor, versaoId: string, motivo: string | undefined) {
  await banco
    .update(planoAcaoVersao)
    .set({ situacao: "em_aprovacao", motivoAlteracao: motivo ?? null })
    .where(eq(planoAcaoVersao.id, versaoId));
  await banco.insert(planoAcaoDecisao).values({ planoAcaoVersaoId: versaoId, decisao: "enviada" });
}

/** Aprova, rejeita ou devolve para ajustes; quem decidiu, quando e o parecer ficam registrados. */
export async function decidirVersao(
  banco: Executor,
  versaoId: string,
  decisao: "aprovada" | "rejeitada" | "devolvida",
  parecer: string | undefined,
) {
  if (decisao === "devolvida") {
    await banco.update(planoAcaoVersao).set({ situacao: "rascunho" }).where(eq(planoAcaoVersao.id, versaoId));
  } else {
    await banco
      .update(planoAcaoVersao)
      .set({ situacao: decisao, parecer: parecer ?? null })
      .where(eq(planoAcaoVersao.id, versaoId));
  }
  await banco.insert(planoAcaoDecisao).values({ planoAcaoVersaoId: versaoId, decisao, parecer: parecer ?? null });
}

/** Histórico do fluxo de aprovação das versões do plano. */
export async function decisoesDoPlano(banco: Executor, planoId: string) {
  return banco
    .select({
      id: planoAcaoDecisao.id,
      versaoId: planoAcaoDecisao.planoAcaoVersaoId,
      numeroVersao: planoAcaoVersao.numeroVersao,
      decisao: planoAcaoDecisao.decisao,
      parecer: planoAcaoDecisao.parecer,
      em: planoAcaoDecisao.criadoEm,
      porNome: usuario.nome,
    })
    .from(planoAcaoDecisao)
    .innerJoin(planoAcaoVersao, eq(planoAcaoVersao.id, planoAcaoDecisao.planoAcaoVersaoId))
    .leftJoin(usuario, eq(usuario.id, planoAcaoDecisao.criadoPor))
    .where(eq(planoAcaoVersao.planoAcaoId, planoId))
    // Na mesma transação, o envio vem antes da decisão.
    .orderBy(desc(planoAcaoDecisao.criadoEm), desc(planoAcaoVersao.numeroVersao), sql`(${planoAcaoDecisao.decisao} = 'enviada')`);
}

// --- Ações e marcos planejados -----------------------------------------------

export type MarcoPlanejado = {
  id: string;
  marcoId: string;
  codigo: string;
  descricao: string;
  prazoPrevisto: string | null;
};

/**
 * Ações planejadas em várias versões de uma só vez, com o pilar, os responsáveis e os marcos: o painel
 * lê todos os planos sem uma consulta por plano. Versão sem ações aparece com a lista vazia.
 */
export async function planejamentoDasVersoes(banco: Executor, versaoIds: readonly string[]) {
  const ids = [...versaoIds];
  const acoes = await banco
    .select({
      versaoId: acaoPlanejamento.planoAcaoVersaoId,
      id: acaoPlanejamento.id,
      acaoId: acao.id,
      codigo: acao.codigo,
      iniciativaId: acao.iniciativaId,
      iniciativaTitulo: iniciativa.titulo,
      eixoId: acaoPlanejamento.eixoId,
      eixoCodigo: planoEixo.codigo,
      eixoNome: planoEixo.nome,
      eixoOrdem: planoEixo.ordem,
      titulo: acaoPlanejamento.titulo,
      descricao: acaoPlanejamento.descricao,
      justificativa: acaoPlanejamento.justificativa,
      responsavelUsuarioId: acaoPlanejamento.responsavelUsuarioId,
      responsavelUsuarioNome: usuario.nome,
      responsavelStakeholderId: acaoPlanejamento.responsavelStakeholderId,
      responsavelStakeholderTipo: responsavelExterno.tipo,
      responsavelStakeholderNome: nomeResponsavelExterno,
      inicioPrevisto: acaoPlanejamento.inicioPrevisto,
      fimPrevisto: acaoPlanejamento.fimPrevisto,
      periodicidade: acaoPlanejamento.periodicidade,
    })
    .from(acaoPlanejamento)
    .innerJoin(acao, eq(acao.id, acaoPlanejamento.acaoId))
    .leftJoin(iniciativa, eq(iniciativa.id, acao.iniciativaId))
    .leftJoin(planoEixo, eq(planoEixo.id, acaoPlanejamento.eixoId))
    .leftJoin(usuario, eq(usuario.id, acaoPlanejamento.responsavelUsuarioId))
    .leftJoin(responsavelExterno, eq(responsavelExterno.id, acaoPlanejamento.responsavelStakeholderId))
    .leftJoin(pessoaResponsavel, eq(pessoaResponsavel.id, acaoPlanejamento.responsavelStakeholderId))
    .leftJoin(instituicaoResponsavel, eq(instituicaoResponsavel.id, acaoPlanejamento.responsavelStakeholderId))
    .where(and(inArray(acaoPlanejamento.planoAcaoVersaoId, ids), isNull(acaoPlanejamento.arquivadoEm)))
    .orderBy(sql`${planoEixo.ordem} nulls last`, asc(acao.codigo));
  const marcos = await banco
    .select({
      versaoId: marcoPlanejamento.planoAcaoVersaoId,
      id: marcoPlanejamento.id,
      marcoId: acaoMarco.id,
      acaoId: acaoMarco.acaoId,
      codigo: acaoMarco.codigo,
      descricao: marcoPlanejamento.descricao,
      prazoPrevisto: marcoPlanejamento.prazoPrevisto,
    })
    .from(marcoPlanejamento)
    .innerJoin(acaoMarco, eq(acaoMarco.id, marcoPlanejamento.marcoId))
    .where(and(inArray(marcoPlanejamento.planoAcaoVersaoId, ids), isNull(marcoPlanejamento.arquivadoEm)))
    .orderBy(asc(acaoMarco.codigo));
  const porVersao = new Map(ids.map((id) => [id, [] as (Omit<(typeof acoes)[number], "versaoId"> & { marcos: MarcoPlanejado[] })[]]));
  for (const { versaoId, ...a } of acoes) {
    porVersao.get(versaoId)?.push({
      ...a,
      marcos: marcos
        .filter((m) => m.versaoId === versaoId && m.acaoId === a.acaoId)
        .map((m): MarcoPlanejado => ({ id: m.id, marcoId: m.marcoId, codigo: m.codigo, descricao: m.descricao, prazoPrevisto: m.prazoPrevisto })),
    });
  }
  return porVersao;
}

/** Ações planejadas numa versão, com o pilar, os responsáveis e os marcos. */
export async function planejamentoDaVersao(banco: Executor, versaoId: string) {
  return (await planejamentoDasVersoes(banco, [versaoId])).get(versaoId) ?? [];
}

export type AcaoDaVersao = Awaited<ReturnType<typeof planejamentoDaVersao>>[number];

function camposPlanejamento(dados: Omit<DadosAcaoPlanejada, "versaoId" | "iniciativaId">) {
  return {
    eixoId: dados.eixoId ?? null,
    titulo: dados.titulo,
    descricao: dados.descricao ?? null,
    justificativa: dados.justificativa ?? null,
    responsavelUsuarioId: dados.responsavelUsuarioId ?? null,
    responsavelStakeholderId: dados.responsavelStakeholderId ?? null,
    inicioPrevisto: dados.inicioPrevisto ?? null,
    fimPrevisto: dados.fimPrevisto ?? null,
    periodicidade: dados.periodicidade ?? null,
  };
}

/** Inclui uma nova ação (código permanente gerado) na versão em rascunho. */
export async function incluirAcaoNaVersao(banco: Executor, dados: DadosAcaoPlanejada): Promise<string> {
  const versao = await obterVersao(banco, dados.versaoId);
  if (!versao) throw new ErroDoPlano("Versão não encontrada.");
  const codigos = await banco.select({ codigo: acao.codigo }).from(acao).where(eq(acao.planoAcaoId, versao.planoAcaoId));
  const [nova] = await banco
    .insert(acao)
    .values({
      planoAcaoId: versao.planoAcaoId,
      codigo: proximoCodigo(
        codigos.map((c) => c.codigo),
        "A-",
        2,
      ),
      iniciativaId: dados.iniciativaId ?? null,
    })
    .returning({ id: acao.id });
  await banco.insert(acaoPlanejamento).values({ acaoId: nova.id, planoAcaoVersaoId: dados.versaoId, ...camposPlanejamento(dados) });
  return nova.id;
}

export async function atualizarAcaoPlanejada(
  banco: Executor,
  planejamentoId: string,
  dados: Omit<DadosAcaoPlanejada, "versaoId" | "iniciativaId">,
) {
  await banco.update(acaoPlanejamento).set(camposPlanejamento(dados)).where(eq(acaoPlanejamento.id, planejamentoId));
}

/** Retira a ação (e os seus marcos) da versão em rascunho; ela continua nas versões anteriores. */
export async function retirarAcaoDaVersao(banco: Executor, planejamentoId: string) {
  const [retirado] = await banco
    .update(acaoPlanejamento)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(acaoPlanejamento.id, planejamentoId), isNull(acaoPlanejamento.arquivadoEm)))
    .returning({ acaoId: acaoPlanejamento.acaoId, versaoId: acaoPlanejamento.planoAcaoVersaoId });
  if (!retirado) return null;
  await banco.execute(sql`
    update marco_planejamento set arquivado_em = now()
    where plano_acao_versao_id = ${retirado.versaoId} and arquivado_em is null
      and marco_id in (select id from acao_marco where acao_id = ${retirado.acaoId})`);
  return retirado;
}

/** Inclui um marco (código M1, M2… por ação) na ação, na versão em rascunho. */
export async function incluirMarco(banco: Executor, dados: DadosMarco): Promise<string> {
  const [planejada] = await banco
    .select({ id: acaoPlanejamento.id })
    .from(acaoPlanejamento)
    .where(
      and(
        eq(acaoPlanejamento.acaoId, dados.acaoId),
        eq(acaoPlanejamento.planoAcaoVersaoId, dados.versaoId),
        isNull(acaoPlanejamento.arquivadoEm),
      ),
    );
  if (!planejada) throw new ErroDoPlano("A ação não está nesta versão do plano.");
  const codigos = await banco.select({ codigo: acaoMarco.codigo }).from(acaoMarco).where(eq(acaoMarco.acaoId, dados.acaoId));
  const [novo] = await banco
    .insert(acaoMarco)
    .values({
      acaoId: dados.acaoId,
      codigo: proximoCodigo(
        codigos.map((c) => c.codigo),
        "M",
        1,
      ),
    })
    .returning({ id: acaoMarco.id });
  await banco
    .insert(marcoPlanejamento)
    .values({ marcoId: novo.id, planoAcaoVersaoId: dados.versaoId, descricao: dados.descricao, prazoPrevisto: dados.prazoPrevisto ?? null });
  return novo.id;
}

export async function atualizarMarcoPlanejado(
  banco: Executor,
  marcoPlanejamentoId: string,
  dados: { descricao: string; prazoPrevisto?: string },
) {
  await banco
    .update(marcoPlanejamento)
    .set({ descricao: dados.descricao, prazoPrevisto: dados.prazoPrevisto ?? null })
    .where(eq(marcoPlanejamento.id, marcoPlanejamentoId));
}

export async function retirarMarcoDaVersao(banco: Executor, marcoPlanejamentoId: string) {
  const [retirado] = await banco
    .update(marcoPlanejamento)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(marcoPlanejamento.id, marcoPlanejamentoId), isNull(marcoPlanejamento.arquivadoEm)))
    .returning({ versaoId: marcoPlanejamento.planoAcaoVersaoId });
  return retirado ?? null;
}

// --- Acompanhamento ----------------------------------------------------------

export type Andamento = { situacao: SituacaoAcao | null; percentual: number | null; data: string | null };

/** Situação e percentual mais recentes de cada ação. */
export async function andamentoDasAcoes(banco: Executor, acaoIds: readonly string[]): Promise<Map<string, Andamento>> {
  return andamentoDasLinhas(await acompanhamentosDasAcoes(banco, acaoIds));
}

/** Acompanhamentos não arquivados das ações, do mais recente para o mais antigo (data e momento do registro). */
export async function acompanhamentosDasAcoes(banco: Executor, acaoIds: readonly string[]) {
  if (acaoIds.length === 0) return [];
  return banco
    .select({
      acaoId: acaoAcompanhamento.acaoId,
      data: acaoAcompanhamento.data,
      situacao: acaoAcompanhamento.situacao,
      percentual: acaoAcompanhamento.percentual,
    })
    .from(acaoAcompanhamento)
    .where(and(inArray(acaoAcompanhamento.acaoId, [...acaoIds]), isNull(acaoAcompanhamento.arquivadoEm)))
    .orderBy(desc(acaoAcompanhamento.data), desc(acaoAcompanhamento.criadoEm));
}

/** Andamento de cada ação a partir dos acompanhamentos já ordenados (o mais recente decide cada campo). */
export function andamentoDasLinhas(linhas: Awaited<ReturnType<typeof acompanhamentosDasAcoes>>): Map<string, Andamento> {
  const mapa = new Map<string, Andamento>();
  for (const l of linhas) {
    const atual = mapa.get(l.acaoId) ?? { situacao: null, percentual: null, data: l.data };
    if (atual.situacao === null && l.situacao) atual.situacao = l.situacao;
    if (atual.percentual === null && l.percentual !== null) atual.percentual = l.percentual;
    mapa.set(l.acaoId, atual);
  }
  return mapa;
}

/** Marcos alcançados (o registro mais recente de cada marco decide). */
export async function marcosAlcancados(banco: Executor, marcoIds: readonly string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (marcoIds.length === 0) return mapa;
  const linhas = await banco
    .select({ marcoId: acaoAcompanhamento.marcoId, alcancado: acaoAcompanhamento.marcoAlcancado, data: acaoAcompanhamento.data })
    .from(acaoAcompanhamento)
    .where(and(inArray(acaoAcompanhamento.marcoId, [...marcoIds]), isNull(acaoAcompanhamento.arquivadoEm)))
    .orderBy(desc(acaoAcompanhamento.data), desc(acaoAcompanhamento.criadoEm));
  const vistos = new Set<string>();
  for (const l of linhas) {
    if (!l.marcoId || vistos.has(l.marcoId)) continue;
    vistos.add(l.marcoId);
    if (l.alcancado) mapa.set(l.marcoId, l.data);
  }
  return mapa;
}

/** Ações de várias versões de uma só vez, com andamento, atraso e marcos alcançados. */
export async function acoesDasVersoes(banco: Executor, versaoIds: readonly string[], hoje: string) {
  const planejadas = await planejamentoDasVersoes(banco, versaoIds);
  const todas = [...planejadas.values()].flat();
  const [andamentos, alcancados] = await Promise.all([
    andamentoDasAcoes(
      banco,
      todas.map((a) => a.acaoId),
    ),
    marcosAlcancados(
      banco,
      todas.flatMap((a) => a.marcos.map((m) => m.marcoId)),
    ),
  ]);
  return completarAcoesDasVersoes(planejadas, andamentos, alcancados, hoje);
}

/** Acrescenta andamento, atraso e marcos alcançados às ações planejadas de cada versão (sem consultar o banco). */
export function completarAcoesDasVersoes(
  planejadas: Awaited<ReturnType<typeof planejamentoDasVersoes>>,
  andamentos: Map<string, Andamento>,
  alcancados: Map<string, string>,
  hoje: string,
) {
  const comAndamento = (a: AcaoDaVersao) => {
    const andamento = andamentos.get(a.acaoId) ?? { situacao: null, percentual: null, data: null };
    return {
      ...a,
      andamento,
      atrasada: acaoAtrasada(andamento.situacao, a.fimPrevisto, hoje),
      marcos: a.marcos.map((m) => ({ ...m, alcancadoEm: alcancados.get(m.marcoId) ?? null })),
    };
  };
  return new Map([...planejadas].map(([versaoId, acoes]) => [versaoId, acoes.map(comAndamento)]));
}

/** Ações da versão vigente, com andamento, atraso e marcos alcançados. */
export async function acoesVigentes(banco: Executor, planoId: string, hoje: string) {
  const vigente = await versaoVigente(banco, planoId);
  if (!vigente) return { versao: null, acoes: [] };
  const porVersao = await acoesDasVersoes(banco, [vigente.id], hoje);
  return { versao: vigente, acoes: porVersao.get(vigente.id) ?? [] };
}

export type AcaoVigente = Awaited<ReturnType<typeof acoesVigentes>>["acoes"][number];

export async function registrarAcompanhamento(banco: Executor, dados: DadosAcompanhamentoAcao) {
  await banco.insert(acaoAcompanhamento).values({
    acaoId: dados.acaoId,
    data: dados.data,
    situacao: dados.situacao ?? null,
    percentual: dados.percentual ?? null,
    observacao: dados.observacao ?? null,
    marcoId: dados.marcoId ?? null,
    marcoAlcancado: dados.marcoId ? (dados.marcoAlcancado ?? null) : null,
  });
}

export async function acompanhamentosDaAcao(banco: Executor, acaoId: string) {
  return banco
    .select({
      id: acaoAcompanhamento.id,
      data: acaoAcompanhamento.data,
      situacao: acaoAcompanhamento.situacao,
      percentual: acaoAcompanhamento.percentual,
      observacao: acaoAcompanhamento.observacao,
      marcoCodigo: acaoMarco.codigo,
      marcoAlcancado: acaoAcompanhamento.marcoAlcancado,
      autorNome: usuario.nome,
      criadoEm: acaoAcompanhamento.criadoEm,
    })
    .from(acaoAcompanhamento)
    .leftJoin(acaoMarco, eq(acaoMarco.id, acaoAcompanhamento.marcoId))
    .leftJoin(usuario, eq(usuario.id, acaoAcompanhamento.criadoPor))
    .where(and(eq(acaoAcompanhamento.acaoId, acaoId), isNull(acaoAcompanhamento.arquivadoEm)))
    .orderBy(desc(acaoAcompanhamento.data), desc(acaoAcompanhamento.criadoEm));
}

// --- Ação (identidade) -------------------------------------------------------

export async function obterAcao(banco: Executor, acaoId: string) {
  const [encontrada] = await banco
    .select({
      id: acao.id,
      codigo: acao.codigo,
      planoAcaoId: acao.planoAcaoId,
      planoTitulo: planoAcao.titulo,
      projetoTemaId: planoAcao.projetoTemaId,
      projetoNome: projetoTema.nome,
      iniciativaId: acao.iniciativaId,
      iniciativaTitulo: iniciativa.titulo,
    })
    .from(acao)
    .innerJoin(planoAcao, eq(planoAcao.id, acao.planoAcaoId))
    .innerJoin(projetoTema, eq(projetoTema.id, planoAcao.projetoTemaId))
    .leftJoin(iniciativa, eq(iniciativa.id, acao.iniciativaId))
    .where(eq(acao.id, acaoId));
  return encontrada ?? null;
}

/** Como a ação foi planejada em cada versão (comparação ao longo do tempo). */
export async function planejamentosDaAcao(banco: Executor, acaoId: string) {
  return banco
    .select({
      versaoId: planoAcaoVersao.id,
      numeroVersao: planoAcaoVersao.numeroVersao,
      situacaoVersao: planoAcaoVersao.situacao,
      titulo: acaoPlanejamento.titulo,
      fimPrevisto: acaoPlanejamento.fimPrevisto,
      inicioPrevisto: acaoPlanejamento.inicioPrevisto,
      responsavelUsuarioNome: usuario.nome,
      responsavelStakeholderNome: nomeResponsavelExterno,
      retirada: sql<boolean>`${acaoPlanejamento.arquivadoEm} is not null`,
    })
    .from(acaoPlanejamento)
    .innerJoin(planoAcaoVersao, eq(planoAcaoVersao.id, acaoPlanejamento.planoAcaoVersaoId))
    .leftJoin(usuario, eq(usuario.id, acaoPlanejamento.responsavelUsuarioId))
    .leftJoin(pessoaResponsavel, eq(pessoaResponsavel.id, acaoPlanejamento.responsavelStakeholderId))
    .leftJoin(instituicaoResponsavel, eq(instituicaoResponsavel.id, acaoPlanejamento.responsavelStakeholderId))
    .where(and(eq(acaoPlanejamento.acaoId, acaoId), isNull(planoAcaoVersao.arquivadoEm)))
    .orderBy(desc(planoAcaoVersao.numeroVersao));
}

export async function atualizarIniciativaDaAcao(banco: Executor, acaoId: string, iniciativaId: string | null) {
  await banco.update(acao).set({ iniciativaId }).where(eq(acao.id, acaoId));
}

/** Ação em que o compromisso foi convertido, se houver. */
export async function acaoDoCompromisso(banco: Executor, compromissoId: string): Promise<string | null> {
  const [encontrado] = await banco.select({ acaoId: compromisso.acaoId }).from(compromisso).where(eq(compromisso.id, compromissoId));
  return encontrado?.acaoId ?? null;
}

/** Compromissos convertidos nesta ação. */
export async function compromissosDaAcao(banco: Executor, acaoId: string) {
  return banco
    .select({ id: compromisso.id, descricao: compromisso.descricao, interacaoId: compromisso.interacaoId })
    .from(compromisso)
    .where(eq(compromisso.acaoId, acaoId));
}

/** Ações (com o planejamento da versão vigente, ou o mais recente) para listas de seleção. */
export async function opcoesAcoes(banco: Executor, visiveis: ProjetosVisiveis = "todos", projetoTemaId?: string) {
  const linhas = await banco
    .select({
      id: acao.id,
      codigo: acao.codigo,
      projetoNome: projetoTema.nome,
      titulo: sql<string>`(
        select ap.titulo from acao_planejamento ap join plano_acao_versao v on v.id = ap.plano_acao_versao_id
        where ap.acao_id = acao.id and ap.arquivado_em is null and v.arquivado_em is null
        order by (v.situacao = 'aprovada') desc, v.numero_versao desc limit 1
      )`,
    })
    .from(acao)
    .innerJoin(planoAcao, eq(planoAcao.id, acao.planoAcaoId))
    .innerJoin(projetoTema, eq(projetoTema.id, planoAcao.projetoTemaId))
    .where(
      and(
        isNull(planoAcao.arquivadoEm),
        projetoVisivel(sql`${planoAcao.projetoTemaId}`, visiveis),
        projetoTemaId ? eq(planoAcao.projetoTemaId, projetoTemaId) : undefined,
      ),
    )
    .orderBy(asc(projetoTema.nomeNormalizado), asc(acao.codigo));
  return linhas.filter((l) => l.titulo);
}

// --- Stakeholders da ação ----------------------------------------------------

export async function stakeholdersDaAcao(banco: Executor, acaoId: string) {
  return banco
    .select({
      id: acaoStakeholder.id,
      stakeholderId: stakeholder.id,
      tipoStakeholder: stakeholder.tipo,
      nome: sql<string>`coalesce(${pessoa.nomeCompleto}, ${instituicao.nome})`,
      observacao: acaoStakeholder.observacao,
    })
    .from(acaoStakeholder)
    .innerJoin(stakeholder, eq(stakeholder.id, acaoStakeholder.stakeholderId))
    .leftJoin(pessoa, eq(pessoa.id, stakeholder.id))
    .leftJoin(instituicao, eq(instituicao.id, stakeholder.id))
    .where(and(eq(acaoStakeholder.acaoId, acaoId), isNull(acaoStakeholder.arquivadoEm)));
}

export async function incluirStakeholderNaAcao(banco: Executor, dados: DadosStakeholderAcao) {
  await banco
    .insert(acaoStakeholder)
    .values({ acaoId: dados.acaoId, stakeholderId: dados.stakeholderId, observacao: dados.observacao ?? null });
}

export async function retirarStakeholderDaAcao(banco: Executor, ligacaoId: string, acaoId: string) {
  const [retirada] = await banco
    .update(acaoStakeholder)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(acaoStakeholder.id, ligacaoId), eq(acaoStakeholder.acaoId, acaoId), isNull(acaoStakeholder.arquivadoEm)))
    .returning({ id: acaoStakeholder.id });
  return retirada ?? null;
}

// --- Integrações -------------------------------------------------------------

/**
 * Converte o compromisso em ação do plano, na versão em rascunho (criada se
 * preciso), preservando a origem: o compromisso guarda a ação, e a ação a
 * iniciativa do compromisso. Não converte duas vezes.
 */
export async function converterCompromissoEmAcao(
  banco: Executor,
  compromissoId: string,
  planoId: string,
  eixoId: string | undefined,
): Promise<{ acaoId: string; versaoId: string }> {
  const [origem] = await banco.select().from(compromisso).where(eq(compromisso.id, compromissoId));
  if (!origem) throw new ErroDoPlano("Compromisso não encontrado.");
  if (origem.acaoId) throw new ErroDoPlano("Este compromisso já foi convertido em ação do plano.");
  let versao = await versaoEmElaboracao(banco, planoId);
  if (versao?.situacao === "em_aprovacao") {
    throw new ErroDoPlano("Há uma versão do plano em aprovação: decida sobre ela antes de incluir novas ações.");
  }
  if (!versao) {
    const novaId = await criarNovaVersao(banco, planoId);
    versao = { id: novaId, numeroVersao: 0, situacao: "rascunho" };
  }
  const acaoId = await incluirAcaoNaVersao(banco, {
    versaoId: versao.id,
    eixoId,
    titulo: origem.descricao.slice(0, 300),
    justificativa: "Convertida de compromisso; a interação ou a iniciativa de origem continua registrada.",
    responsavelUsuarioId: origem.responsavelUsuarioId ?? undefined,
    responsavelStakeholderId: origem.responsavelStakeholderId ?? undefined,
    fimPrevisto: origem.prazo ?? undefined,
    iniciativaId: origem.iniciativaId ?? undefined,
  });
  await banco.update(compromisso).set({ acaoId }).where(eq(compromisso.id, compromissoId));
  return { acaoId, versaoId: versao.id };
}

/** Ações ligadas a uma iniciativa, com o título vigente (ou o mais recente). */
export async function acoesDaIniciativa(banco: Executor, iniciativaId: string) {
  return banco
    .select({
      id: acao.id,
      codigo: acao.codigo,
      planoAcaoId: acao.planoAcaoId,
      projetoNome: projetoTema.nome,
      titulo: sql<string | null>`(
        select ap.titulo from acao_planejamento ap join plano_acao_versao v on v.id = ap.plano_acao_versao_id
        where ap.acao_id = acao.id and ap.arquivado_em is null and v.arquivado_em is null
        order by (v.situacao = 'aprovada') desc, v.numero_versao desc limit 1
      )`,
      situacao: sql<SituacaoAcao | null>`${situacaoAtual(sql`acao.id`)}`,
    })
    .from(acao)
    .innerJoin(planoAcao, eq(planoAcao.id, acao.planoAcaoId))
    .innerJoin(projetoTema, eq(projetoTema.id, planoAcao.projetoTemaId))
    .where(eq(acao.iniciativaId, iniciativaId))
    .orderBy(asc(acao.codigo));
}

/** Ações de que uma pessoa ou instituição é responsável (na versão vigente) ou com que se relaciona. */
export async function acoesDoStakeholder(banco: Executor, stakeholderId: string, visiveis: ProjetosVisiveis = "todos") {
  return banco
    .select({
      id: acao.id,
      codigo: acao.codigo,
      projetoNome: projetoTema.nome,
      titulo: sql<string | null>`(
        select ap.titulo from acao_planejamento ap join plano_acao_versao v on v.id = ap.plano_acao_versao_id
        where ap.acao_id = acao.id and ap.arquivado_em is null and v.arquivado_em is null
        order by (v.situacao = 'aprovada') desc, v.numero_versao desc limit 1
      )`,
      situacao: sql<SituacaoAcao | null>`${situacaoAtual(sql`acao.id`)}`,
    })
    .from(acao)
    .innerJoin(planoAcao, eq(planoAcao.id, acao.planoAcaoId))
    .innerJoin(projetoTema, eq(projetoTema.id, planoAcao.projetoTemaId))
    .where(
      and(
        projetoVisivel(sql`${planoAcao.projetoTemaId}`, visiveis),
        or(
          sql`exists (select 1 from acao_stakeholder s where s.acao_id = acao.id and s.stakeholder_id = ${stakeholderId} and s.arquivado_em is null)`,
          sql`exists (
            select 1 from acao_planejamento ap join plano_acao_versao v on v.id = ap.plano_acao_versao_id
            where ap.acao_id = acao.id and ap.arquivado_em is null and v.situacao = 'aprovada'
              and ap.responsavel_stakeholder_id = ${stakeholderId}
          )`,
        ),
      ),
    )
    .orderBy(asc(acao.codigo));
}

// --- Histórico ---------------------------------------------------------------

const camposHistorico = {
  id: registroAuditoria.id,
  tabela: registroAuditoria.tabela,
  operacao: registroAuditoria.operacao,
  dadosAnteriores: registroAuditoria.dadosAnteriores,
  dadosNovos: registroAuditoria.dadosNovos,
  ocorridoEm: registroAuditoria.ocorridoEm,
  usuarioNome: usuario.nome,
};
const dadosAuditados = sql`coalesce(${registroAuditoria.dadosNovos}, ${registroAuditoria.dadosAnteriores})`;

/** Trilha de auditoria do plano, dos pilares ou eixos e das versões. */
export async function historicoDoPlano(banco: Executor, planoId: string) {
  return banco
    .select(camposHistorico)
    .from(registroAuditoria)
    .leftJoin(usuario, eq(usuario.id, registroAuditoria.usuarioId))
    .where(
      or(
        and(eq(registroAuditoria.tabela, "plano_acao"), eq(registroAuditoria.registroId, planoId)),
        and(
          inArray(registroAuditoria.tabela, ["plano_eixo", "plano_acao_versao"]),
          sql`${dadosAuditados} ->> 'plano_acao_id' = ${planoId}`,
        ),
      ),
    )
    .orderBy(desc(registroAuditoria.ocorridoEm), desc(registroAuditoria.id))
    .limit(200);
}

/** Trilha de auditoria da ação: identidade, planejamento por versão, marcos, acompanhamento e stakeholders. */
export async function historicoDaAcao(banco: Executor, acaoId: string) {
  return banco
    .select(camposHistorico)
    .from(registroAuditoria)
    .leftJoin(usuario, eq(usuario.id, registroAuditoria.usuarioId))
    .where(
      or(
        and(eq(registroAuditoria.tabela, "acao"), eq(registroAuditoria.registroId, acaoId)),
        and(
          inArray(registroAuditoria.tabela, ["acao_planejamento", "acao_marco", "acao_acompanhamento", "acao_stakeholder"]),
          sql`${dadosAuditados} ->> 'acao_id' = ${acaoId}`,
        ),
        and(
          eq(registroAuditoria.tabela, "marco_planejamento"),
          sql`(${dadosAuditados} ->> 'marco_id')::uuid in (select id from acao_marco where acao_id = ${acaoId})`,
        ),
      ),
    )
    .orderBy(desc(registroAuditoria.ocorridoEm), desc(registroAuditoria.id))
    .limit(300);
}
