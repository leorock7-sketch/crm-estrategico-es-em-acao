/**
 * Leitura e gravação das interações (reuniões, contatos e encontros, cada uma
 * registrada uma única vez), dos seus participantes e ligações, e dos
 * compromissos com o seu acompanhamento. As gravações devem ser feitas dentro
 * de comoUsuario(), para a trilha de auditoria. Retirar uma ligação é arquivá-la.
 */
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/lib/banco/conexao";
import {
  compromisso,
  compromissoAcompanhamento as acompanhamento,
  iniciativa,
  instituicao,
  interacao,
  interacaoIniciativa,
  interacaoParticipante as participante,
  interacaoProjetoTema as interacaoProjeto,
  pessoa,
  projetoTema,
  comite,
  registroAuditoria,
  stakeholder,
  usuario,
} from "@/lib/banco/esquema";
import { formatarDataHora } from "@/lib/formatacao";
import { escaparLike, normalizarTexto } from "@/lib/texto";
import { projetoVisivel, type ProjetosVisiveis } from "@/modulos/acesso/visibilidade";
import type { PossivelDuplicidade } from "@/modulos/stakeholders/consultas";
import { inicioDoDia, instanteDeBrasilia } from "./datas";
import type {
  DadosAcompanhamento,
  DadosCompromisso,
  DadosIniciativaDaInteracao,
  DadosInteracao,
  DadosNovaInteracao,
  DadosParticipante,
} from "./esquemas";
import {
  type FiltroCompromisso,
  type PeriodoInteracao,
  presencaInicial,
  type PresencaInteracao,
  type SituacaoInteracao,
  type TipoInteracao,
} from "./rotulos";

// --- Visibilidade ------------------------------------------------------------

/** Projetos e temas da interação (referenciada pelo nome da tabela): diretos e das iniciativas. */
const PROJETOS_DA_INTERACAO = sql.raw(`(
  select ipd.projeto_tema_id from interacao_projeto_tema ipd
  where ipd.interacao_id = interacao.id and ipd.arquivado_em is null
  union
  select inp.projeto_tema_id from interacao_iniciativa iid
  join iniciativa_projeto_tema inp on inp.iniciativa_id = iid.iniciativa_id and inp.arquivado_em is null
  where iid.interacao_id = interacao.id and iid.arquivado_em is null
)`);

/** Projetos e temas do compromisso: da interação de origem (diretos e das iniciativas) e da iniciativa. */
const PROJETOS_DO_COMPROMISSO = sql.raw(`(
  select ipc.projeto_tema_id from interacao_projeto_tema ipc
  where ipc.interacao_id = compromisso.interacao_id and ipc.arquivado_em is null
  union
  select inc.projeto_tema_id from iniciativa_projeto_tema inc
  where inc.iniciativa_id = compromisso.iniciativa_id and inc.arquivado_em is null
  union
  select inc2.projeto_tema_id from interacao_iniciativa iic
  join iniciativa_projeto_tema inc2 on inc2.iniciativa_id = iic.iniciativa_id and inc2.arquivado_em is null
  where iic.interacao_id = compromisso.interacao_id and iic.arquivado_em is null
)`);

function interacaoVisivel(visiveis: ProjetosVisiveis): SQL | undefined {
  if (visiveis === "todos") return undefined;
  return sql`exists (select 1 from ${PROJETOS_DA_INTERACAO} pv(id) where ${projetoVisivel(sql`pv.id`, visiveis)})`;
}

function compromissoVisivel(visiveis: ProjetosVisiveis): SQL | undefined {
  if (visiveis === "todos") return undefined;
  return sql`exists (select 1 from ${PROJETOS_DO_COMPROMISSO} pv(id) where ${projetoVisivel(sql`pv.id`, visiveis)})`;
}

/** Projetos e temas de uma interação (diretos e das iniciativas), para conferir permissões. */
export async function projetosDeUmaInteracao(banco: Executor, interacaoId: string): Promise<string[]> {
  const resultado = await banco.execute(
    sql`select distinct pv.id from interacao cross join lateral ${PROJETOS_DA_INTERACAO} pv(id) where interacao.id = ${interacaoId}`,
  );
  return (resultado.rows as { id: string }[]).map((r) => r.id);
}

/** Projetos e temas de um compromisso, para conferir permissões. */
export async function projetosDeUmCompromisso(banco: Executor, compromissoId: string): Promise<string[]> {
  const resultado = await banco.execute(
    sql`select distinct pv.id from compromisso cross join lateral ${PROJETOS_DO_COMPROMISSO} pv(id) where compromisso.id = ${compromissoId}`,
  );
  return (resultado.rows as { id: string }[]).map((r) => r.id);
}

export async function interacaoEhVisivel(banco: Executor, id: string, visiveis: ProjetosVisiveis) {
  if (visiveis === "todos") return true;
  return (await projetosDeUmaInteracao(banco, id)).some((p) => visiveis.includes(p));
}

export async function compromissoEhVisivel(banco: Executor, id: string, visiveis: ProjetosVisiveis) {
  if (visiveis === "todos") return true;
  return (await projetosDeUmCompromisso(banco, id)).some((p) => visiveis.includes(p));
}

// --- Interações --------------------------------------------------------------

function camposInteracao(dados: DadosInteracao) {
  return {
    tipo: dados.tipo,
    assunto: dados.assunto,
    assuntoNormalizado: normalizarTexto(dados.assunto),
    inicio: instanteDeBrasilia(dados.inicio),
    fim: dados.fim ? instanteDeBrasilia(dados.fim) : null,
    local: dados.local ?? null,
    resumo: dados.resumo ?? null,
    situacao: dados.situacao,
  };
}

/**
 * Registra a interação uma única vez, já com as suas ligações a projetos,
 * temas e iniciativas e com os participantes (presença inicial conforme a situação).
 */
export async function criarInteracao(banco: Executor, dados: DadosNovaInteracao): Promise<string> {
  const [nova] = await banco.insert(interacao).values(camposInteracao(dados)).returning({ id: interacao.id });
  for (const projetoTemaId of new Set(dados.projetos)) {
    await banco.insert(interacaoProjeto).values({ interacaoId: nova.id, projetoTemaId });
  }
  for (const iniciativaId of new Set(dados.iniciativas)) {
    await banco.insert(interacaoIniciativa).values({ interacaoId: nova.id, iniciativaId });
  }
  const presenca = presencaInicial(dados.situacao);
  for (const stakeholderId of new Set(dados.participantesExternos)) {
    await banco.insert(participante).values({ interacaoId: nova.id, stakeholderId, presenca });
  }
  for (const usuarioId of new Set(dados.participantesInternos)) {
    await banco.insert(participante).values({ interacaoId: nova.id, usuarioId, presenca });
  }
  return nova.id;
}

export async function atualizarInteracao(banco: Executor, id: string, dados: DadosInteracao) {
  await banco.update(interacao).set(camposInteracao(dados)).where(eq(interacao.id, id));
}

export async function definirArquivamentoInteracao(banco: Executor, id: string, arquivar: boolean) {
  await banco
    .update(interacao)
    .set({ arquivadoEm: arquivar ? sql`now()` : null })
    .where(eq(interacao.id, id));
}

export async function obterInteracao(banco: Executor, id: string) {
  const [encontrada] = await banco.select().from(interacao).where(eq(interacao.id, id));
  return encontrada ?? null;
}

/**
 * Interações com assunto igual ou parecido no mesmo dia (um dia antes ou depois).
 * Alerta, não bloqueio: evita registrar a mesma reunião duas vezes (RF-43).
 */
export async function possiveisDuplicidadesInteracao(
  banco: Executor,
  dados: Pick<DadosInteracao, "assunto" | "inicio">,
  ignorarId?: string,
): Promise<PossivelDuplicidade[]> {
  const assunto = normalizarTexto(dados.assunto);
  const inicio = instanteDeBrasilia(dados.inicio);
  const umDia = 24 * 60 * 60 * 1000;
  const criterios: SQL[] = [eq(interacao.assuntoNormalizado, assunto)];
  if (assunto.length >= 8) {
    criterios.push(ilike(interacao.assuntoNormalizado, `%${escaparLike(assunto)}%`));
    criterios.push(sql`${assunto} like '%' || ${interacao.assuntoNormalizado} || '%'`);
  }
  const encontradas = await banco
    .select({
      id: interacao.id,
      assunto: interacao.assunto,
      assuntoNormalizado: interacao.assuntoNormalizado,
      inicio: interacao.inicio,
      arquivadoEm: interacao.arquivadoEm,
    })
    .from(interacao)
    .where(
      and(
        or(...criterios),
        gte(interacao.inicio, new Date(inicio.getTime() - umDia)),
        lt(interacao.inicio, new Date(inicio.getTime() + umDia)),
        ignorarId ? ne(interacao.id, ignorarId) : undefined,
      ),
    )
    .limit(10);
  return encontradas.map((i) => ({
    id: i.id,
    nome: `${i.assunto} (${formatarDataHora(i.inicio)})`,
    motivo: i.assuntoNormalizado === assunto ? "Mesmo assunto, em data próxima" : "Assunto semelhante, em data próxima",
    arquivado: i.arquivadoEm !== null,
    caminho: "/interacoes",
  }));
}

export type FiltroInteracoes = {
  busca?: string;
  tipo?: TipoInteracao;
  situacao?: SituacaoInteracao;
  periodo?: PeriodoInteracao;
  projetoTemaId?: string;
  iniciativaId?: string;
  stakeholderId?: string;
  incluirArquivadas?: boolean;
};

export async function listarInteracoes(
  banco: Executor,
  filtro: FiltroInteracoes = {},
  visiveis: ProjetosVisiveis = "todos",
  hoje?: string,
) {
  const condicoes: (SQL | undefined)[] = [interacaoVisivel(visiveis)];
  if (!filtro.incluirArquivadas) condicoes.push(isNull(interacao.arquivadoEm));
  if (filtro.tipo) condicoes.push(eq(interacao.tipo, filtro.tipo));
  if (filtro.situacao) condicoes.push(eq(interacao.situacao, filtro.situacao));
  if (filtro.periodo && hoje) {
    condicoes.push(
      filtro.periodo === "futuras" ? gte(interacao.inicio, inicioDoDia(hoje)) : lt(interacao.inicio, inicioDoDia(hoje)),
    );
  }
  if (filtro.projetoTemaId) {
    condicoes.push(sql`${filtro.projetoTemaId}::uuid in ${PROJETOS_DA_INTERACAO}`);
  }
  if (filtro.iniciativaId) {
    condicoes.push(sql`exists (
      select 1 from interacao_iniciativa iif
      where iif.interacao_id = interacao.id and iif.arquivado_em is null and iif.iniciativa_id = ${filtro.iniciativaId}
    )`);
  }
  if (filtro.stakeholderId) {
    condicoes.push(sql`exists (
      select 1 from interacao_participante ipf
      where ipf.interacao_id = interacao.id and ipf.arquivado_em is null and ipf.stakeholder_id = ${filtro.stakeholderId}
    )`);
  }
  const termo = normalizarTexto(filtro.busca ?? "");
  if (termo) condicoes.push(ilike(interacao.assuntoNormalizado, `%${escaparLike(termo)}%`));

  return banco
    .select({
      id: interacao.id,
      tipo: interacao.tipo,
      assunto: interacao.assunto,
      inicio: interacao.inicio,
      situacao: interacao.situacao,
      local: interacao.local,
      arquivadoEm: interacao.arquivadoEm,
      projetos: sql<string | null>`(
        select string_agg(pt.nome, ', ' order by pt.nome) from projeto_tema pt
        where pt.id in ${PROJETOS_DA_INTERACAO}
      )`,
      iniciativas: sql<number>`(
        select count(*)::int from interacao_iniciativa ii
        where ii.interacao_id = interacao.id and ii.arquivado_em is null
      )`,
      participantes: sql<number>`(
        select count(*)::int from interacao_participante ip
        where ip.interacao_id = interacao.id and ip.arquivado_em is null
      )`,
      compromissosPendentes: sql<number>`(
        select count(*)::int from compromisso cp
        where cp.interacao_id = interacao.id and cp.arquivado_em is null and cp.situacao in ('aberto', 'em_andamento')
      )`,
    })
    .from(interacao)
    .where(and(...condicoes))
    .orderBy(filtro.periodo === "futuras" ? asc(interacao.inicio) : desc(interacao.inicio))
    .limit(500);
}

// --- Participantes -----------------------------------------------------------

export async function participantesDaInteracao(banco: Executor, interacaoId: string) {
  return banco
    .select({
      id: participante.id,
      stakeholderId: participante.stakeholderId,
      usuarioId: participante.usuarioId,
      tipoStakeholder: stakeholder.tipo,
      nome: sql<string>`coalesce(${pessoa.nomeCompleto}, ${instituicao.nome}, ${usuario.nome})`,
      presenca: participante.presenca,
    })
    .from(participante)
    .leftJoin(stakeholder, eq(stakeholder.id, participante.stakeholderId))
    .leftJoin(pessoa, eq(pessoa.id, participante.stakeholderId))
    .leftJoin(instituicao, eq(instituicao.id, participante.stakeholderId))
    .leftJoin(usuario, eq(usuario.id, participante.usuarioId))
    .where(and(eq(participante.interacaoId, interacaoId), isNull(participante.arquivadoEm)))
    .orderBy(sql`${participante.usuarioId} is null`, sql`coalesce(${pessoa.nomeCompleto}, ${instituicao.nome}, ${usuario.nome})`);
}

export async function incluirParticipante(banco: Executor, dados: DadosParticipante) {
  const [novo] = await banco
    .insert(participante)
    .values({
      interacaoId: dados.interacaoId,
      stakeholderId: dados.participante.tipo === "stakeholder" ? dados.participante.id : null,
      usuarioId: dados.participante.tipo === "usuario" ? dados.participante.id : null,
      presenca: dados.presenca,
    })
    .returning({ id: participante.id });
  return novo.id;
}

/** Altera a presença. Retorna a interação, ou null se o participante foi retirado. */
export async function alterarPresenca(
  banco: Executor,
  participanteId: string,
  interacaoId: string,
  presenca: PresencaInteracao,
) {
  const [alterado] = await banco
    .update(participante)
    .set({ presenca })
    .where(
      and(eq(participante.id, participanteId), eq(participante.interacaoId, interacaoId), isNull(participante.arquivadoEm)),
    )
    .returning({ interacaoId: participante.interacaoId });
  return alterado?.interacaoId ?? null;
}

export async function retirarParticipante(banco: Executor, participanteId: string, interacaoId: string) {
  const [alterado] = await banco
    .update(participante)
    .set({ arquivadoEm: sql`now()` })
    .where(
      and(eq(participante.id, participanteId), eq(participante.interacaoId, interacaoId), isNull(participante.arquivadoEm)),
    )
    .returning({ interacaoId: participante.interacaoId, stakeholderId: participante.stakeholderId });
  return alterado ?? null;
}

// --- Projetos, temas e iniciativas da interação ------------------------------

export async function projetosDaInteracao(banco: Executor, interacaoId: string) {
  return banco
    .select({
      id: interacaoProjeto.id,
      projetoTemaId: projetoTema.id,
      nome: projetoTema.nome,
      tipo: projetoTema.tipo,
      comiteNome: comite.nome,
    })
    .from(interacaoProjeto)
    .innerJoin(projetoTema, eq(projetoTema.id, interacaoProjeto.projetoTemaId))
    .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
    .where(and(eq(interacaoProjeto.interacaoId, interacaoId), isNull(interacaoProjeto.arquivadoEm)))
    .orderBy(asc(projetoTema.nomeNormalizado));
}

export async function incluirProjetoNaInteracao(banco: Executor, interacaoId: string, projetoTemaId: string) {
  const [nova] = await banco
    .insert(interacaoProjeto)
    .values({ interacaoId, projetoTemaId })
    .returning({ id: interacaoProjeto.id });
  return nova.id;
}

export async function retirarProjetoDaInteracao(banco: Executor, ligacaoId: string, interacaoId: string) {
  const [alterada] = await banco
    .update(interacaoProjeto)
    .set({ arquivadoEm: sql`now()` })
    .where(
      and(
        eq(interacaoProjeto.id, ligacaoId),
        eq(interacaoProjeto.interacaoId, interacaoId),
        isNull(interacaoProjeto.arquivadoEm),
      ),
    )
    .returning({ interacaoId: interacaoProjeto.interacaoId, projetoTemaId: interacaoProjeto.projetoTemaId });
  return alterada ?? null;
}

export async function iniciativasDaInteracao(banco: Executor, interacaoId: string) {
  return banco
    .select({
      id: interacaoIniciativa.id,
      iniciativaId: iniciativa.id,
      titulo: iniciativa.titulo,
      tipo: iniciativa.tipo,
      situacao: iniciativa.situacao,
      contribuicao: interacaoIniciativa.contribuicao,
    })
    .from(interacaoIniciativa)
    .innerJoin(iniciativa, eq(iniciativa.id, interacaoIniciativa.iniciativaId))
    .where(and(eq(interacaoIniciativa.interacaoId, interacaoId), isNull(interacaoIniciativa.arquivadoEm)))
    .orderBy(asc(iniciativa.tituloNormalizado));
}

export async function incluirIniciativaNaInteracao(banco: Executor, dados: DadosIniciativaDaInteracao) {
  const [nova] = await banco
    .insert(interacaoIniciativa)
    .values({ interacaoId: dados.interacaoId, iniciativaId: dados.iniciativaId, contribuicao: dados.contribuicao ?? null })
    .returning({ id: interacaoIniciativa.id });
  return nova.id;
}

export async function retirarIniciativaDaInteracao(banco: Executor, ligacaoId: string, interacaoId: string) {
  const [alterada] = await banco
    .update(interacaoIniciativa)
    .set({ arquivadoEm: sql`now()` })
    .where(
      and(
        eq(interacaoIniciativa.id, ligacaoId),
        eq(interacaoIniciativa.interacaoId, interacaoId),
        isNull(interacaoIniciativa.arquivadoEm),
      ),
    )
    .returning({ interacaoId: interacaoIniciativa.interacaoId, iniciativaId: interacaoIniciativa.iniciativaId });
  return alterada ?? null;
}

/** Interações que contribuíram para uma iniciativa, com a contribuição registrada. */
export async function interacoesDaIniciativa(banco: Executor, iniciativaId: string) {
  return banco
    .select({
      id: interacao.id,
      tipo: interacao.tipo,
      assunto: interacao.assunto,
      inicio: interacao.inicio,
      situacao: interacao.situacao,
      contribuicao: interacaoIniciativa.contribuicao,
    })
    .from(interacaoIniciativa)
    .innerJoin(interacao, eq(interacao.id, interacaoIniciativa.interacaoId))
    .where(
      and(
        eq(interacaoIniciativa.iniciativaId, iniciativaId),
        isNull(interacaoIniciativa.arquivadoEm),
        isNull(interacao.arquivadoEm),
      ),
    )
    .orderBy(desc(interacao.inicio));
}

/** Interações de que uma pessoa ou instituição participou ou foi convidada. */
export async function interacoesDoStakeholder(
  banco: Executor,
  stakeholderId: string,
  visiveis: ProjetosVisiveis = "todos",
) {
  return banco
    .select({
      id: interacao.id,
      tipo: interacao.tipo,
      assunto: interacao.assunto,
      inicio: interacao.inicio,
      situacao: interacao.situacao,
      presenca: participante.presenca,
    })
    .from(participante)
    .innerJoin(interacao, eq(interacao.id, participante.interacaoId))
    .where(
      and(
        eq(participante.stakeholderId, stakeholderId),
        isNull(participante.arquivadoEm),
        isNull(interacao.arquivadoEm),
        interacaoVisivel(visiveis),
      ),
    )
    .orderBy(desc(interacao.inicio))
    .limit(100);
}

// --- Compromissos ------------------------------------------------------------

function camposCompromisso(dados: DadosCompromisso) {
  return {
    descricao: dados.descricao,
    interacaoId: dados.interacaoId ?? null,
    iniciativaId: dados.iniciativaId ?? null,
    responsavelUsuarioId: dados.responsavelUsuarioId ?? null,
    responsavelStakeholderId: dados.responsavelStakeholderId ?? null,
    prazo: dados.prazo ?? null,
  };
}

export async function criarCompromisso(banco: Executor, dados: DadosCompromisso): Promise<string> {
  const [novo] = await banco.insert(compromisso).values(camposCompromisso(dados)).returning({ id: compromisso.id });
  return novo.id;
}

/** Altera descrição, ligações, responsáveis e prazo; a situação muda só pelo acompanhamento. */
export async function atualizarCompromisso(banco: Executor, id: string, dados: DadosCompromisso) {
  await banco.update(compromisso).set(camposCompromisso(dados)).where(eq(compromisso.id, id));
}

export async function definirArquivamentoCompromisso(banco: Executor, id: string, arquivar: boolean) {
  await banco
    .update(compromisso)
    .set({ arquivadoEm: arquivar ? sql`now()` : null })
    .where(eq(compromisso.id, id));
}

const responsavelExterno = alias(stakeholder, "responsavel_externo");
const pessoaResponsavel = alias(pessoa, "pessoa_responsavel");
const instituicaoResponsavel = alias(instituicao, "instituicao_responsavel");

/** Campos comuns das listas de compromissos, com os nomes dos responsáveis e das origens. */
const camposListaCompromisso = {
  id: compromisso.id,
  descricao: compromisso.descricao,
  prazo: compromisso.prazo,
  situacao: compromisso.situacao,
  concluidoEm: compromisso.concluidoEm,
  arquivadoEm: compromisso.arquivadoEm,
  interacaoId: compromisso.interacaoId,
  interacaoAssunto: interacao.assunto,
  iniciativaId: compromisso.iniciativaId,
  iniciativaTitulo: iniciativa.titulo,
  responsavelUsuarioId: compromisso.responsavelUsuarioId,
  responsavelUsuarioNome: usuario.nome,
  responsavelStakeholderId: compromisso.responsavelStakeholderId,
  responsavelStakeholderTipo: responsavelExterno.tipo,
  responsavelStakeholderNome: sql<string | null>`coalesce(${pessoaResponsavel.nomeCompleto}, ${instituicaoResponsavel.nome})`,
};

function consultaCompromissos(banco: Executor) {
  return banco
    .select(camposListaCompromisso)
    .from(compromisso)
    .leftJoin(interacao, eq(interacao.id, compromisso.interacaoId))
    .leftJoin(iniciativa, eq(iniciativa.id, compromisso.iniciativaId))
    .leftJoin(usuario, eq(usuario.id, compromisso.responsavelUsuarioId))
    .leftJoin(responsavelExterno, eq(responsavelExterno.id, compromisso.responsavelStakeholderId))
    .leftJoin(pessoaResponsavel, eq(pessoaResponsavel.id, compromisso.responsavelStakeholderId))
    .leftJoin(instituicaoResponsavel, eq(instituicaoResponsavel.id, compromisso.responsavelStakeholderId));
}

export type CompromissoDaLista = Awaited<ReturnType<typeof listarCompromissos>>[number];

export async function obterCompromisso(banco: Executor, id: string) {
  const [encontrado] = await consultaCompromissos(banco).where(eq(compromisso.id, id));
  return encontrado ?? null;
}

export type FiltroCompromissos = {
  prazo?: FiltroCompromisso;
  /** Responsável: "u:<id>" (equipe) ou "s:<id>" (pessoa ou instituição). */
  responsavel?: string;
  projetoTemaId?: string;
  iniciativaId?: string;
  busca?: string;
  incluirArquivados?: boolean;
};

/** Compromissos ordenados pelo prazo (vencidos primeiro), com filtros por situação, responsável e projeto. */
export async function listarCompromissos(
  banco: Executor,
  filtro: FiltroCompromissos,
  hoje: string,
  visiveis: ProjetosVisiveis = "todos",
) {
  const condicoes: (SQL | undefined)[] = [compromissoVisivel(visiveis)];
  if (!filtro.incluirArquivados) condicoes.push(isNull(compromisso.arquivadoEm));
  const pendente = inArray(compromisso.situacao, ["aberto", "em_andamento"]);
  switch (filtro.prazo ?? "pendentes") {
    case "pendentes":
      condicoes.push(pendente);
      break;
    case "vencidos":
      condicoes.push(pendente, lt(compromisso.prazo, hoje));
      break;
    case "concluidos":
      condicoes.push(eq(compromisso.situacao, "concluido"));
      break;
    case "cancelados":
      condicoes.push(eq(compromisso.situacao, "cancelado"));
      break;
  }
  const responsavel = /^([su]):([0-9a-f-]{36})$/i.exec(filtro.responsavel ?? "");
  if (responsavel) {
    condicoes.push(
      responsavel[1] === "u"
        ? eq(compromisso.responsavelUsuarioId, responsavel[2])
        : eq(compromisso.responsavelStakeholderId, responsavel[2]),
    );
  }
  if (filtro.projetoTemaId) condicoes.push(sql`${filtro.projetoTemaId}::uuid in ${PROJETOS_DO_COMPROMISSO}`);
  if (filtro.iniciativaId) {
    condicoes.push(
      or(
        eq(compromisso.iniciativaId, filtro.iniciativaId),
        // Sem iniciativa definida, o compromisso vale para todas as iniciativas da interação de origem.
        sql`${compromisso.iniciativaId} is null and ${compromisso.interacaoId} in (
          select ii.interacao_id from interacao_iniciativa ii
          where ii.iniciativa_id = ${filtro.iniciativaId} and ii.arquivado_em is null
        )`,
      ),
    );
  }
  const busca = (filtro.busca ?? "").trim();
  if (busca) condicoes.push(ilike(compromisso.descricao, `%${escaparLike(busca)}%`));

  return consultaCompromissos(banco)
    .where(and(...condicoes))
    .orderBy(sql`${compromisso.prazo} is null`, asc(compromisso.prazo), desc(compromisso.criadoEm))
    .limit(500);
}

/** Compromissos gerados por uma interação. */
export async function compromissosDaInteracao(banco: Executor, interacaoId: string) {
  return consultaCompromissos(banco)
    .where(and(eq(compromisso.interacaoId, interacaoId), isNull(compromisso.arquivadoEm)))
    .orderBy(sql`${compromisso.prazo} is null`, asc(compromisso.prazo));
}

/**
 * Compromissos da iniciativa: ligados a ela ou, sem iniciativa definida, gerados
 * por interações que contribuíram para ela.
 */
export async function compromissosDaIniciativa(banco: Executor, iniciativaId: string) {
  return consultaCompromissos(banco)
    .where(
      and(
        isNull(compromisso.arquivadoEm),
        or(
          eq(compromisso.iniciativaId, iniciativaId),
          sql`${compromisso.iniciativaId} is null and ${compromisso.interacaoId} in (
            select ii.interacao_id from interacao_iniciativa ii
            where ii.iniciativa_id = ${iniciativaId} and ii.arquivado_em is null
          )`,
        ),
      ),
    )
    .orderBy(sql`${compromisso.prazo} is null`, asc(compromisso.prazo));
}

/** Compromissos sob responsabilidade de uma pessoa ou instituição. */
export async function compromissosDoStakeholder(banco: Executor, stakeholderId: string) {
  return consultaCompromissos(banco)
    .where(and(eq(compromisso.responsavelStakeholderId, stakeholderId), isNull(compromisso.arquivadoEm)))
    .orderBy(sql`${compromisso.prazo} is null`, asc(compromisso.prazo));
}

/** Totais para a página do projeto ou tema: interações, compromissos pendentes e vencidos. */
export async function resumoDoProjetoTema(banco: Executor, projetoTemaId: string, hoje: string) {
  const resultado = await banco.execute(sql`
    select
      (select count(*)::int from interacao where interacao.arquivado_em is null
         and ${projetoTemaId}::uuid in ${PROJETOS_DA_INTERACAO}) as interacoes,
      (select count(*)::int from compromisso where compromisso.arquivado_em is null
         and compromisso.situacao in ('aberto', 'em_andamento')
         and ${projetoTemaId}::uuid in ${PROJETOS_DO_COMPROMISSO}) as pendentes,
      (select count(*)::int from compromisso where compromisso.arquivado_em is null
         and compromisso.situacao in ('aberto', 'em_andamento') and compromisso.prazo < ${hoje}::date
         and ${projetoTemaId}::uuid in ${PROJETOS_DO_COMPROMISSO}) as vencidos
  `);
  return resultado.rows[0] as { interacoes: number; pendentes: number; vencidos: number };
}

/** Interações mais recentes de um projeto ou tema (diretas ou pelas iniciativas). */
export async function interacoesDoProjetoTema(banco: Executor, projetoTemaId: string, limite = 5) {
  return banco
    .select({
      id: interacao.id,
      tipo: interacao.tipo,
      assunto: interacao.assunto,
      inicio: interacao.inicio,
      situacao: interacao.situacao,
    })
    .from(interacao)
    .where(and(isNull(interacao.arquivadoEm), sql`${projetoTemaId}::uuid in ${PROJETOS_DA_INTERACAO}`))
    .orderBy(desc(interacao.inicio))
    .limit(limite);
}

// --- Acompanhamento ----------------------------------------------------------

/**
 * Registra o acompanhamento e, se informada, a nova situação do compromisso
 * (concluído recebe a data do acompanhamento; reaberto perde a data de conclusão).
 */
export async function registrarAcompanhamento(banco: Executor, dados: DadosAcompanhamento) {
  await banco.insert(acompanhamento).values({
    compromissoId: dados.compromissoId,
    data: dados.data,
    registro: dados.registro,
    situacao: dados.situacao ?? null,
  });
  if (dados.situacao) {
    await banco
      .update(compromisso)
      .set({ situacao: dados.situacao, concluidoEm: dados.situacao === "concluido" ? dados.data : null })
      .where(eq(compromisso.id, dados.compromissoId));
  }
}

export async function acompanhamentosDoCompromisso(banco: Executor, compromissoId: string) {
  return banco
    .select({
      id: acompanhamento.id,
      data: acompanhamento.data,
      registro: acompanhamento.registro,
      situacao: acompanhamento.situacao,
      criadoEm: acompanhamento.criadoEm,
      autorNome: usuario.nome,
    })
    .from(acompanhamento)
    .leftJoin(usuario, eq(usuario.id, acompanhamento.criadoPor))
    .where(and(eq(acompanhamento.compromissoId, compromissoId), isNull(acompanhamento.arquivadoEm)))
    .orderBy(desc(acompanhamento.data), desc(acompanhamento.criadoEm));
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

/** Trilha de auditoria da interação, dos seus participantes e das suas ligações. */
export async function historicoDaInteracao(banco: Executor, id: string) {
  return banco
    .select(camposHistorico)
    .from(registroAuditoria)
    .leftJoin(usuario, eq(usuario.id, registroAuditoria.usuarioId))
    .where(
      or(
        and(eq(registroAuditoria.tabela, "interacao"), eq(registroAuditoria.registroId, id)),
        and(
          inArray(registroAuditoria.tabela, ["interacao_participante", "interacao_projeto_tema", "interacao_iniciativa"]),
          sql`${dadosAuditados} ->> 'interacao_id' = ${id}`,
        ),
      ),
    )
    .orderBy(desc(registroAuditoria.ocorridoEm), desc(registroAuditoria.id))
    .limit(200);
}

/** Trilha de auditoria do compromisso e dos seus acompanhamentos. */
export async function historicoDoCompromisso(banco: Executor, id: string) {
  return banco
    .select(camposHistorico)
    .from(registroAuditoria)
    .leftJoin(usuario, eq(usuario.id, registroAuditoria.usuarioId))
    .where(
      or(
        and(eq(registroAuditoria.tabela, "compromisso"), eq(registroAuditoria.registroId, id)),
        and(eq(registroAuditoria.tabela, "compromisso_acompanhamento"), sql`${dadosAuditados} ->> 'compromisso_id' = ${id}`),
      ),
    )
    .orderBy(desc(registroAuditoria.ocorridoEm), desc(registroAuditoria.id))
    .limit(200);
}

