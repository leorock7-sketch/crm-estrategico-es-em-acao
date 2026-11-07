/**
 * Leitura e gravação da Matriz de Riscos (D-072): riscos por projeto ou tema,
 * avaliações inerente e residual (cada reavaliação é um novo registro),
 * gatilhos com acompanhamento, respostas (que podem apontar para ações do Plano
 * de Ação, sem duplicá-las) e stakeholders. As gravações devem ser feitas dentro
 * de comoUsuario(), para a trilha de auditoria.
 */
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/lib/banco/conexao";
import {
  acao,
  iniciativa,
  instituicao,
  pessoa,
  planoAcao,
  planoEixo,
  projetoTema,
  registroAuditoria,
  risco,
  riscoAvaliacao,
  riscoGatilho,
  riscoGatilhoRegistro,
  riscoResposta,
  riscoStakeholder,
  stakeholder,
  usuario,
} from "@/lib/banco/esquema";
import { projetoVisivel, type ProjetosVisiveis } from "@/modulos/acesso/visibilidade";
import { proximoCodigo } from "@/modulos/plano-acao/rotulos";
import { type AvaliacaoResumo, avaliacaoVigente, motivosReavaliacao, ultimasAvaliacoes } from "./analise";
import type {
  DadosAvaliacao,
  DadosNovoRisco,
  DadosRegistroGatilho,
  DadosResposta,
  DadosRisco,
  DadosStakeholderRisco,
} from "./esquemas";
import type { Classificacao, SituacaoRisco } from "./rotulos";

const avaliador = alias(usuario, "avaliador");
const pessoaResponsavel = alias(pessoa, "pessoa_responsavel");
const instituicaoResponsavel = alias(instituicao, "instituicao_responsavel");
const nomeResponsavelExterno = sql<string | null>`coalesce(${pessoaResponsavel.nomeCompleto}, ${instituicaoResponsavel.nome})`;

/** Título da ação na versão vigente do plano (ou na mais recente). */
const tituloDaAcao = sql<string | null>`(
  select ap.titulo from acao_planejamento ap join plano_acao_versao v on v.id = ap.plano_acao_versao_id
  where ap.acao_id = ${acao.id} and ap.arquivado_em is null and v.arquivado_em is null
  order by (v.situacao = 'aprovada') desc, v.numero_versao desc limit 1
)`;

function camposRisco(dados: DadosRisco) {
  return {
    titulo: dados.titulo,
    descricao: dados.descricao ?? null,
    causa: dados.causa ?? null,
    consequencia: dados.consequencia ?? null,
    controlesExistentes: dados.controlesExistentes ?? null,
    eixoId: dados.eixoId ?? null,
    iniciativaId: dados.iniciativaId ?? null,
    responsavelId: dados.responsavelId ?? null,
    situacao: dados.situacao,
    proximaRevisao: dados.proximaRevisao ?? null,
  };
}

// --- Riscos ------------------------------------------------------------------

/** Cria o risco (código R-01, R-02… por projeto ou tema) com a avaliação do risco inerente. */
export async function criarRisco(banco: Executor, dados: DadosNovoRisco): Promise<string> {
  const codigos = await banco.select({ codigo: risco.codigo }).from(risco).where(eq(risco.projetoTemaId, dados.projetoTemaId));
  const [novo] = await banco
    .insert(risco)
    .values({
      projetoTemaId: dados.projetoTemaId,
      codigo: proximoCodigo(
        codigos.map((c) => c.codigo),
        "R-",
        2,
      ),
      ...camposRisco(dados),
    })
    .returning({ id: risco.id });
  await banco.insert(riscoAvaliacao).values({
    riscoId: novo.id,
    tipo: "inerente",
    dataAvaliacao: dados.dataAvaliacao,
    probabilidade: dados.probabilidade,
    impacto: dados.impacto,
    justificativa: dados.justificativa,
    avaliadoPor: dados.avaliadoPor,
  });
  return novo.id;
}

export async function atualizarRisco(banco: Executor, id: string, dados: DadosRisco) {
  await banco.update(risco).set(camposRisco(dados)).where(eq(risco.id, id));
}

export async function definirArquivamentoRisco(banco: Executor, id: string, arquivar: boolean) {
  await banco
    .update(risco)
    .set({ arquivadoEm: arquivar ? sql`now()` : null })
    .where(eq(risco.id, id));
}

export async function obterRisco(banco: Executor, id: string) {
  const [encontrado] = await banco
    .select({
      risco,
      projetoNome: projetoTema.nome,
      eixoCodigo: planoEixo.codigo,
      eixoNome: planoEixo.nome,
      iniciativaTitulo: iniciativa.titulo,
      responsavelNome: usuario.nome,
    })
    .from(risco)
    .innerJoin(projetoTema, eq(projetoTema.id, risco.projetoTemaId))
    .leftJoin(planoEixo, eq(planoEixo.id, risco.eixoId))
    .leftJoin(iniciativa, eq(iniciativa.id, risco.iniciativaId))
    .leftJoin(usuario, eq(usuario.id, risco.responsavelId))
    .where(eq(risco.id, id));
  return encontrado
    ? {
        ...encontrado.risco,
        projetoNome: encontrado.projetoNome,
        eixoCodigo: encontrado.eixoCodigo,
        eixoNome: encontrado.eixoNome,
        iniciativaTitulo: encontrado.iniciativaTitulo,
        responsavelNome: encontrado.responsavelNome,
      }
    : null;
}

export async function riscoEhVisivel(banco: Executor, id: string, visiveis: ProjetosVisiveis) {
  const [encontrado] = await banco.select({ projetoTemaId: risco.projetoTemaId }).from(risco).where(eq(risco.id, id));
  if (!encontrado) return false;
  return visiveis === "todos" || visiveis.includes(encontrado.projetoTemaId);
}

export type FiltroRiscos = {
  projetoTemaId?: string;
  classificacao?: Classificacao;
  situacao?: SituacaoRisco;
  responsavelId?: string;
  /** Somente riscos com gatilho cuja última ocorrência registrada foi "ocorreu". */
  gatilhoOcorrido?: boolean;
  arquivados?: boolean;
  /** Painéis: sem o limite da lista, para os totais nunca ficarem incompletos. */
  semLimite?: boolean;
};

/** Avaliações (não arquivadas) dos riscos informados, agrupadas por risco. */
async function avaliacoesPorRisco(banco: Executor, riscoIds: readonly string[]) {
  const mapa = new Map<string, AvaliacaoResumo[]>();
  if (riscoIds.length === 0) return mapa;
  const linhas = await banco
    .select({
      riscoId: riscoAvaliacao.riscoId,
      tipo: riscoAvaliacao.tipo,
      dataAvaliacao: riscoAvaliacao.dataAvaliacao,
      probabilidade: riscoAvaliacao.probabilidade,
      impacto: riscoAvaliacao.impacto,
      criticidade: riscoAvaliacao.criticidade,
      classificacao: riscoAvaliacao.classificacao,
      criadoEm: riscoAvaliacao.criadoEm,
    })
    .from(riscoAvaliacao)
    .where(and(inArray(riscoAvaliacao.riscoId, [...riscoIds]), isNull(riscoAvaliacao.arquivadoEm)));
  for (const { riscoId, ...a } of linhas) {
    const lista = mapa.get(riscoId) ?? [];
    lista.push({ ...a, classificacao: a.classificacao as Classificacao });
    mapa.set(riscoId, lista);
  }
  return mapa;
}

/** Datas das últimas ocorrências "ocorreu" de cada gatilho ativo, por risco. */
async function gatilhosOcorridosPorRisco(banco: Executor, riscoIds: readonly string[]) {
  const mapa = new Map<string, string[]>();
  if (riscoIds.length === 0) return mapa;
  const linhas = await banco
    .select({
      riscoId: riscoGatilho.riscoId,
      gatilhoId: riscoGatilho.id,
      data: riscoGatilhoRegistro.data,
      ocorrido: riscoGatilhoRegistro.ocorrido,
    })
    .from(riscoGatilhoRegistro)
    .innerJoin(riscoGatilho, eq(riscoGatilho.id, riscoGatilhoRegistro.gatilhoId))
    .where(
      and(inArray(riscoGatilho.riscoId, [...riscoIds]), isNull(riscoGatilho.arquivadoEm), isNull(riscoGatilhoRegistro.arquivadoEm)),
    )
    .orderBy(desc(riscoGatilhoRegistro.data), desc(riscoGatilhoRegistro.criadoEm));
  const vistos = new Set<string>();
  for (const l of linhas) {
    if (vistos.has(l.gatilhoId)) continue;
    vistos.add(l.gatilhoId);
    if (!l.ocorrido) continue;
    const lista = mapa.get(l.riscoId) ?? [];
    lista.push(l.data);
    mapa.set(l.riscoId, lista);
  }
  return mapa;
}

/** Riscos com as últimas avaliações inerente e residual, a vigente e os sinais de reavaliação. */
export async function listarRiscos(
  banco: Executor,
  filtro: FiltroRiscos,
  hoje: string,
  visiveis: ProjetosVisiveis = "todos",
) {
  const linhas = await banco
    .select({
      id: risco.id,
      codigo: risco.codigo,
      titulo: risco.titulo,
      situacao: risco.situacao,
      proximaRevisao: risco.proximaRevisao,
      projetoTemaId: risco.projetoTemaId,
      projetoNome: projetoTema.nome,
      eixoCodigo: planoEixo.codigo,
      eixoNome: planoEixo.nome,
      responsavelId: risco.responsavelId,
      responsavelNome: usuario.nome,
      arquivadoEm: risco.arquivadoEm,
    })
    .from(risco)
    .innerJoin(projetoTema, eq(projetoTema.id, risco.projetoTemaId))
    .leftJoin(planoEixo, eq(planoEixo.id, risco.eixoId))
    .leftJoin(usuario, eq(usuario.id, risco.responsavelId))
    .where(
      and(
        filtro.arquivados ? undefined : isNull(risco.arquivadoEm),
        projetoVisivel(sql`${risco.projetoTemaId}`, visiveis),
        filtro.projetoTemaId ? eq(risco.projetoTemaId, filtro.projetoTemaId) : undefined,
        filtro.situacao ? eq(risco.situacao, filtro.situacao) : undefined,
        filtro.responsavelId ? eq(risco.responsavelId, filtro.responsavelId) : undefined,
      ),
    )
    .orderBy(asc(projetoTema.nomeNormalizado), asc(risco.codigo))
    .limit(filtro.semLimite ? 1_000_000 : 500);
  const ids = linhas.map((l) => l.id);
  const [avaliacoes, gatilhos] = await Promise.all([avaliacoesPorRisco(banco, ids), gatilhosOcorridosPorRisco(banco, ids)]);
  const resultado = linhas.map((l) => {
    const ultimas = ultimasAvaliacoes(avaliacoes.get(l.id) ?? []);
    const vigente = avaliacaoVigente(ultimas);
    const ocorridos = gatilhos.get(l.id) ?? [];
    const ultimaAvaliacaoEm =
      [ultimas.inerente?.dataAvaliacao, ultimas.residual?.dataAvaliacao].filter((d): d is string => !!d).sort().at(-1) ?? null;
    return {
      ...l,
      inerente: ultimas.inerente,
      residual: ultimas.residual,
      vigente,
      gatilhoOcorrido: ocorridos.length > 0,
      gatilhosOcorridosEm: ocorridos,
      reavaliacao: motivosReavaliacao({ ultimaAvaliacaoEm, gatilhosOcorridosEm: ocorridos, proximaRevisao: l.proximaRevisao, hoje }),
    };
  });
  return resultado.filter(
    (r) =>
      (!filtro.classificacao || r.vigente?.classificacao === filtro.classificacao) &&
      (filtro.gatilhoOcorrido === undefined || r.gatilhoOcorrido === filtro.gatilhoOcorrido),
  );
}

export type RiscoDaLista = Awaited<ReturnType<typeof listarRiscos>>[number];

// --- Avaliações --------------------------------------------------------------

/** Histórico das avaliações do risco, da mais recente para a mais antiga. */
export async function avaliacoesDoRisco(banco: Executor, riscoId: string) {
  const linhas = await banco
    .select({
      id: riscoAvaliacao.id,
      tipo: riscoAvaliacao.tipo,
      dataAvaliacao: riscoAvaliacao.dataAvaliacao,
      probabilidade: riscoAvaliacao.probabilidade,
      impacto: riscoAvaliacao.impacto,
      criticidade: riscoAvaliacao.criticidade,
      classificacao: riscoAvaliacao.classificacao,
      justificativa: riscoAvaliacao.justificativa,
      avaliadoPorNome: avaliador.nome,
      registradoPorNome: usuario.nome,
      criadoEm: riscoAvaliacao.criadoEm,
    })
    .from(riscoAvaliacao)
    .innerJoin(avaliador, eq(avaliador.id, riscoAvaliacao.avaliadoPor))
    .leftJoin(usuario, eq(usuario.id, riscoAvaliacao.criadoPor))
    .where(and(eq(riscoAvaliacao.riscoId, riscoId), isNull(riscoAvaliacao.arquivadoEm)))
    .orderBy(desc(riscoAvaliacao.dataAvaliacao), desc(riscoAvaliacao.criadoEm));
  return linhas.map((l) => ({ ...l, classificacao: l.classificacao as Classificacao }));
}

export type AvaliacaoDoRisco = Awaited<ReturnType<typeof avaliacoesDoRisco>>[number];

/** Registra uma avaliação (ou reavaliação) fundamentada; as anteriores ficam no histórico. */
export async function registrarAvaliacao(banco: Executor, dados: DadosAvaliacao) {
  await banco.insert(riscoAvaliacao).values({
    riscoId: dados.riscoId,
    tipo: dados.tipo,
    dataAvaliacao: dados.dataAvaliacao,
    probabilidade: dados.probabilidade,
    impacto: dados.impacto,
    justificativa: dados.justificativa,
    avaliadoPor: dados.avaliadoPor,
  });
}

// --- Gatilhos ----------------------------------------------------------------

/** Gatilhos do risco com o acompanhamento (mais recente primeiro). */
export async function gatilhosDoRisco(banco: Executor, riscoId: string) {
  const gatilhos = await banco
    .select({ id: riscoGatilho.id, descricao: riscoGatilho.descricao, criadoEm: riscoGatilho.criadoEm })
    .from(riscoGatilho)
    .where(and(eq(riscoGatilho.riscoId, riscoId), isNull(riscoGatilho.arquivadoEm)))
    .orderBy(asc(riscoGatilho.criadoEm));
  const registros = gatilhos.length
    ? await banco
        .select({
          id: riscoGatilhoRegistro.id,
          gatilhoId: riscoGatilhoRegistro.gatilhoId,
          data: riscoGatilhoRegistro.data,
          ocorrido: riscoGatilhoRegistro.ocorrido,
          observacao: riscoGatilhoRegistro.observacao,
          autorNome: usuario.nome,
          criadoEm: riscoGatilhoRegistro.criadoEm,
        })
        .from(riscoGatilhoRegistro)
        .leftJoin(usuario, eq(usuario.id, riscoGatilhoRegistro.criadoPor))
        .where(
          and(
            inArray(
              riscoGatilhoRegistro.gatilhoId,
              gatilhos.map((g) => g.id),
            ),
            isNull(riscoGatilhoRegistro.arquivadoEm),
          ),
        )
        .orderBy(desc(riscoGatilhoRegistro.data), desc(riscoGatilhoRegistro.criadoEm))
    : [];
  return gatilhos.map((g) => {
    const doGatilho = registros.filter((r) => r.gatilhoId === g.id);
    return { ...g, registros: doGatilho, ultimo: doGatilho[0] ?? null };
  });
}

export type GatilhoDoRisco = Awaited<ReturnType<typeof gatilhosDoRisco>>[number];

export async function criarGatilho(banco: Executor, riscoId: string, descricao: string) {
  await banco.insert(riscoGatilho).values({ riscoId, descricao });
}

export async function atualizarGatilho(banco: Executor, gatilhoId: string, descricao: string) {
  await banco.update(riscoGatilho).set({ descricao }).where(eq(riscoGatilho.id, gatilhoId));
}

export async function arquivarGatilho(banco: Executor, gatilhoId: string) {
  await banco
    .update(riscoGatilho)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(riscoGatilho.id, gatilhoId), isNull(riscoGatilho.arquivadoEm)));
}

/** Registra se o gatilho ocorreu. Não altera a avaliação do risco: sinaliza reavaliação. */
export async function registrarOcorrenciaGatilho(banco: Executor, dados: DadosRegistroGatilho) {
  await banco.insert(riscoGatilhoRegistro).values({
    gatilhoId: dados.gatilhoId,
    data: dados.data,
    ocorrido: dados.ocorrido,
    observacao: dados.observacao ?? null,
  });
}

export async function riscoDoGatilho(banco: Executor, gatilhoId: string): Promise<string | null> {
  const [g] = await banco.select({ riscoId: riscoGatilho.riscoId }).from(riscoGatilho).where(eq(riscoGatilho.id, gatilhoId));
  return g?.riscoId ?? null;
}

// --- Respostas ---------------------------------------------------------------

export async function respostasDoRisco(banco: Executor, riscoId: string) {
  return banco
    .select({
      id: riscoResposta.id,
      estrategia: riscoResposta.estrategia,
      descricao: riscoResposta.descricao,
      responsavelUsuarioId: riscoResposta.responsavelUsuarioId,
      responsavelUsuarioNome: usuario.nome,
      responsavelStakeholderId: riscoResposta.responsavelStakeholderId,
      responsavelStakeholderNome: nomeResponsavelExterno,
      prazo: riscoResposta.prazo,
      situacao: riscoResposta.situacao,
      acaoId: riscoResposta.acaoId,
      acaoCodigo: acao.codigo,
      acaoTitulo: tituloDaAcao,
      acaoPlanoId: acao.planoAcaoId,
    })
    .from(riscoResposta)
    .leftJoin(usuario, eq(usuario.id, riscoResposta.responsavelUsuarioId))
    .leftJoin(pessoaResponsavel, eq(pessoaResponsavel.id, riscoResposta.responsavelStakeholderId))
    .leftJoin(instituicaoResponsavel, eq(instituicaoResponsavel.id, riscoResposta.responsavelStakeholderId))
    .leftJoin(acao, eq(acao.id, riscoResposta.acaoId))
    .where(and(eq(riscoResposta.riscoId, riscoId), isNull(riscoResposta.arquivadoEm)))
    .orderBy(asc(riscoResposta.criadoEm));
}

export type RespostaDoRisco = Awaited<ReturnType<typeof respostasDoRisco>>[number];

function camposResposta(dados: DadosResposta) {
  return {
    estrategia: dados.estrategia,
    descricao: dados.descricao,
    responsavelUsuarioId: dados.responsavelUsuarioId ?? null,
    responsavelStakeholderId: dados.responsavelStakeholderId ?? null,
    prazo: dados.prazo ?? null,
    situacao: dados.situacao,
    acaoId: dados.acaoId ?? null,
  };
}

export async function criarResposta(banco: Executor, dados: DadosResposta) {
  await banco.insert(riscoResposta).values({ riscoId: dados.riscoId, ...camposResposta(dados) });
}

export async function atualizarResposta(banco: Executor, respostaId: string, dados: DadosResposta) {
  await banco
    .update(riscoResposta)
    .set(camposResposta(dados))
    .where(and(eq(riscoResposta.id, respostaId), eq(riscoResposta.riscoId, dados.riscoId)));
}

export async function arquivarResposta(banco: Executor, respostaId: string, riscoId: string) {
  await banco
    .update(riscoResposta)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(riscoResposta.id, respostaId), eq(riscoResposta.riscoId, riscoId), isNull(riscoResposta.arquivadoEm)));
}

// --- Stakeholders do risco ---------------------------------------------------

export async function stakeholdersDoRisco(banco: Executor, riscoId: string) {
  return banco
    .select({
      id: riscoStakeholder.id,
      stakeholderId: stakeholder.id,
      tipoStakeholder: stakeholder.tipo,
      nome: sql<string>`coalesce(${pessoa.nomeCompleto}, ${instituicao.nome})`,
      observacao: riscoStakeholder.observacao,
    })
    .from(riscoStakeholder)
    .innerJoin(stakeholder, eq(stakeholder.id, riscoStakeholder.stakeholderId))
    .leftJoin(pessoa, eq(pessoa.id, stakeholder.id))
    .leftJoin(instituicao, eq(instituicao.id, stakeholder.id))
    .where(and(eq(riscoStakeholder.riscoId, riscoId), isNull(riscoStakeholder.arquivadoEm)));
}

export async function incluirStakeholderNoRisco(banco: Executor, dados: DadosStakeholderRisco) {
  await banco
    .insert(riscoStakeholder)
    .values({ riscoId: dados.riscoId, stakeholderId: dados.stakeholderId, observacao: dados.observacao ?? null });
}

export async function retirarStakeholderDoRisco(banco: Executor, ligacaoId: string, riscoId: string) {
  const [retirada] = await banco
    .update(riscoStakeholder)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(riscoStakeholder.id, ligacaoId), eq(riscoStakeholder.riscoId, riscoId), isNull(riscoStakeholder.arquivadoEm)))
    .returning({ id: riscoStakeholder.id });
  return retirada ?? null;
}

// --- Opções e integrações ----------------------------------------------------

/** Pilares ou eixos do plano de ação do projeto ou tema (para classificar o risco). */
export async function eixosDoProjetoTema(banco: Executor, projetoTemaId: string) {
  return banco
    .select({ id: planoEixo.id, codigo: planoEixo.codigo, nome: planoEixo.nome })
    .from(planoEixo)
    .innerJoin(planoAcao, eq(planoAcao.id, planoEixo.planoAcaoId))
    .where(and(eq(planoAcao.projetoTemaId, projetoTemaId), isNull(planoAcao.arquivadoEm), isNull(planoEixo.arquivadoEm)))
    .orderBy(asc(planoEixo.ordem), asc(planoEixo.codigo));
}

/** Pilares ou eixos de todos os planos visíveis, com o projeto (para formulários com troca de projeto). */
export async function opcoesEixos(banco: Executor, visiveis: ProjetosVisiveis = "todos") {
  return banco
    .select({
      id: planoEixo.id,
      codigo: planoEixo.codigo,
      nome: planoEixo.nome,
      projetoTemaId: planoAcao.projetoTemaId,
      projetoNome: projetoTema.nome,
    })
    .from(planoEixo)
    .innerJoin(planoAcao, eq(planoAcao.id, planoEixo.planoAcaoId))
    .innerJoin(projetoTema, eq(projetoTema.id, planoAcao.projetoTemaId))
    .where(
      and(isNull(planoAcao.arquivadoEm), isNull(planoEixo.arquivadoEm), projetoVisivel(sql`${planoAcao.projetoTemaId}`, visiveis)),
    )
    .orderBy(asc(projetoTema.nomeNormalizado), asc(planoEixo.ordem));
}

type ResumoRisco = {
  id: string;
  codigo: string;
  titulo: string;
  situacao: SituacaoRisco;
  projetoNome: string;
};

async function comAvaliacaoVigente<T extends ResumoRisco>(banco: Executor, riscos: T[]) {
  const avaliacoes = await avaliacoesPorRisco(
    banco,
    riscos.map((r) => r.id),
  );
  return riscos.map((r) => ({ ...r, vigente: avaliacaoVigente(ultimasAvaliacoes(avaliacoes.get(r.id) ?? [])) }));
}

const camposResumo = {
  id: risco.id,
  codigo: risco.codigo,
  titulo: risco.titulo,
  situacao: risco.situacao,
  projetoNome: projetoTema.nome,
};

/** Riscos ligados a uma iniciativa. */
export async function riscosDaIniciativa(banco: Executor, iniciativaId: string) {
  const linhas = await banco
    .select(camposResumo)
    .from(risco)
    .innerJoin(projetoTema, eq(projetoTema.id, risco.projetoTemaId))
    .where(and(eq(risco.iniciativaId, iniciativaId), isNull(risco.arquivadoEm)))
    .orderBy(asc(risco.codigo));
  return comAvaliacaoVigente(banco, linhas);
}

/** Riscos de que a ação do plano é resposta. */
export async function riscosDaAcao(banco: Executor, acaoId: string) {
  const linhas = await banco
    .selectDistinct(camposResumo)
    .from(riscoResposta)
    .innerJoin(risco, eq(risco.id, riscoResposta.riscoId))
    .innerJoin(projetoTema, eq(projetoTema.id, risco.projetoTemaId))
    .where(and(eq(riscoResposta.acaoId, acaoId), isNull(riscoResposta.arquivadoEm), isNull(risco.arquivadoEm)))
    .orderBy(asc(risco.codigo));
  return comAvaliacaoVigente(banco, linhas);
}

/** Riscos com que uma pessoa ou instituição se relaciona ou pelos quais responde numa medida. */
export async function riscosDoStakeholder(banco: Executor, stakeholderId: string, visiveis: ProjetosVisiveis = "todos") {
  const linhas = await banco
    .select(camposResumo)
    .from(risco)
    .innerJoin(projetoTema, eq(projetoTema.id, risco.projetoTemaId))
    .where(
      and(
        isNull(risco.arquivadoEm),
        projetoVisivel(sql`${risco.projetoTemaId}`, visiveis),
        or(
          sql`exists (select 1 from risco_stakeholder s where s.risco_id = ${risco.id} and s.stakeholder_id = ${stakeholderId} and s.arquivado_em is null)`,
          sql`exists (select 1 from risco_resposta r where r.risco_id = ${risco.id} and r.responsavel_stakeholder_id = ${stakeholderId} and r.arquivado_em is null)`,
        ),
      ),
    )
    .orderBy(asc(risco.codigo));
  return comAvaliacaoVigente(banco, linhas);
}

/** Quantidade de riscos ativos do projeto ou tema por classificação vigente. */
export async function resumoRiscosDoProjetoTema(banco: Executor, projetoTemaId: string, hoje: string) {
  const riscos = await listarRiscos(banco, { projetoTemaId }, hoje);
  const porClassificacao: Record<Classificacao, number> = { baixo: 0, moderado: 0, alto: 0, critico: 0 };
  for (const r of riscos) if (r.vigente) porClassificacao[r.vigente.classificacao] += 1;
  return {
    total: riscos.length,
    porClassificacao,
    reavaliar: riscos.filter((r) => r.reavaliacao.length > 0).length,
    escalonados: riscos.filter((r) => r.situacao === "escalonado").length,
  };
}

// --- Histórico ---------------------------------------------------------------

/** Trilha de auditoria do risco, das avaliações, dos gatilhos, das respostas e dos stakeholders. */
export async function historicoDoRisco(banco: Executor, riscoId: string) {
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
        and(eq(registroAuditoria.tabela, "risco"), eq(registroAuditoria.registroId, riscoId)),
        and(
          inArray(registroAuditoria.tabela, ["risco_avaliacao", "risco_gatilho", "risco_resposta", "risco_stakeholder"]),
          sql`${dados} ->> 'risco_id' = ${riscoId}`,
        ),
        and(
          eq(registroAuditoria.tabela, "risco_gatilho_registro"),
          sql`(${dados} ->> 'gatilho_id')::uuid in (select id from risco_gatilho where risco_id = ${riscoId})`,
        ),
      ),
    )
    .orderBy(desc(registroAuditoria.ocorridoEm), desc(registroAuditoria.id))
    .limit(300);
}
