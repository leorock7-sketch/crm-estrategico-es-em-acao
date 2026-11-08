/**
 * Dados dos painéis e dos relatórios (D-079). Só lê, e sempre com o banco com identidade: o que as
 * regras de acesso não mostram ao usuário não chega aqui e, portanto, não entra em nenhuma contagem.
 * Não há limite de linhas, para os totais nunca ficarem incompletos. Usa as mesmas funções das telas
 * de cada módulo, para o painel e o registro de origem coincidirem.
 */
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Banco, Executor } from "@/lib/banco/conexao";
import {
  comite,
  compromisso,
  iniciativa,
  iniciativaProjetoTema,
  instituicao,
  interacao,
  interacaoIniciativa,
  interacaoParticipante,
  interacaoProjetoTema,
  pessoa,
  planoAcao,
  planoAcaoVersao,
  projetoTema,
  projetoTemaComite,
  usuario,
} from "@/lib/banco/esquema";
import { fichasDosContextos, metodologiaVigente } from "@/modulos/avaliacoes/consultas";
import type { FichaParaMatriz } from "@/modulos/avaliacoes/matriz";
import {
  type AcaoVigente,
  acompanhamentosDasAcoes,
  andamentoDasLinhas,
  completarAcoesDasVersoes,
  marcosAlcancados,
  planejamentoDasVersoes,
} from "@/modulos/plano-acao/consultas";
import { listarRiscos, type RiscoDaLista } from "@/modulos/riscos/consultas";

export type ProjetoDoPainel = {
  id: string;
  nome: string;
  tipo: "projeto" | "tema";
  situacao: "proposto" | "ativo" | "suspenso" | "concluido" | "cancelado";
  comiteId: string;
  comiteNome: string;
  /** Comitês participantes vigentes, além do principal. */
  participantes: string[];
};

export type IniciativaDoPainel = {
  id: string;
  titulo: string;
  tipo: "demanda" | "reuniao_relevante" | "frente_atuacao";
  situacao: "registrada" | "em_analise" | "em_andamento" | "suspensa" | "concluida" | "cancelada";
  prioridade: "alta" | "media" | "baixa" | null;
  responsavelId: string | null;
  dataAbertura: string;
  dataPrevistaConclusao: string | null;
  dataConclusao: string | null;
  projetos: string[];
};

export type InteracaoDoPainel = {
  id: string;
  tipo: "reuniao_presencial" | "reuniao_virtual" | "ligacao" | "email" | "evento" | "visita" | "outro";
  situacao: "agendada" | "realizada" | "cancelada";
  /** Dia do início, em Brasília. */
  data: string;
  projetos: string[];
  participantesInternos: string[];
};

export type CompromissoDoPainel = {
  id: string;
  descricao: string;
  situacao: "aberto" | "em_andamento" | "concluido" | "cancelado";
  prazo: string | null;
  concluidoEm: string | null;
  responsavelUsuarioId: string | null;
  responsavelNome: string | null;
  responsavelExterno: boolean;
  origem: "iniciativa" | "interacao";
  projetos: string[];
};

export type AcaoDoPainel = AcaoVigente & {
  /** Data do acompanhamento que registrou a conclusão, se a ação está concluída. */
  dataConclusao: string | null;
};

export type PlanoDoPainel = {
  id: string;
  titulo: string;
  projetoTemaId: string;
  vigente: { id: string; numeroVersao: number } | null;
  /** Só da versão vigente: versões não aprovadas nunca entram aqui. */
  acoes: AcaoDoPainel[];
  /** Versões em elaboração ou em aprovação, contadas à parte. */
  naoAprovadas: { numeroVersao: number; situacao: "rascunho" | "em_aprovacao"; acoes: number; marcos: number }[];
};

export type RiscoDoPainel = RiscoDaLista;

export type FichasDoProjeto = { projetoTemaId: string; fichas: FichaParaMatriz[] };

export type DadosDoPainel = {
  comites: { id: string; nome: string }[];
  projetos: ProjetoDoPainel[];
  iniciativas: IniciativaDoPainel[];
  interacoes: InteracaoDoPainel[];
  compromissos: CompromissoDoPainel[];
  planos: PlanoDoPainel[];
  riscos: RiscoDoPainel[];
  fichas: FichasDoProjeto[];
  metodologia: { id: string; nome: string; ordinal: boolean } | null;
  usuarios: { id: string; nome: string }[];
};

function agrupar<T, V>(linhas: readonly T[], chave: (l: T) => string, valor: (l: T) => V): Map<string, V[]> {
  const mapa = new Map<string, V[]>();
  for (const linha of linhas) {
    const lista = mapa.get(chave(linha)) ?? [];
    lista.push(valor(linha));
    mapa.set(chave(linha), lista);
  }
  return mapa;
}

async function carregarProjetos(tx: Executor): Promise<ProjetoDoPainel[]> {
  const [projetos, participacoes] = await Promise.all([
    tx
      .select({
        id: projetoTema.id,
        nome: projetoTema.nome,
        tipo: projetoTema.tipo,
        situacao: projetoTema.situacao,
        comiteId: projetoTema.comiteId,
        comiteNome: comite.nome,
      })
      .from(projetoTema)
      .innerJoin(comite, eq(comite.id, projetoTema.comiteId))
      .where(isNull(projetoTema.arquivadoEm))
      .orderBy(asc(projetoTema.nomeNormalizado)),
    tx
      .select({ projetoTemaId: projetoTemaComite.projetoTemaId, comiteId: projetoTemaComite.comiteId })
      .from(projetoTemaComite)
      .where(and(isNull(projetoTemaComite.arquivadoEm), isNull(projetoTemaComite.dataFim))),
  ]);
  const porProjeto = agrupar(participacoes, (p) => p.projetoTemaId, (p) => p.comiteId);
  return projetos.map((p) => ({ ...p, participantes: porProjeto.get(p.id) ?? [] }));
}

async function carregarIniciativas(tx: Executor): Promise<IniciativaDoPainel[]> {
  const [linhas, ligacoes] = await Promise.all([
    tx
      .select({
        id: iniciativa.id,
        titulo: iniciativa.titulo,
        tipo: iniciativa.tipo,
        situacao: iniciativa.situacao,
        prioridade: iniciativa.prioridade,
        responsavelId: iniciativa.responsavelId,
        dataAbertura: iniciativa.dataAbertura,
        dataPrevistaConclusao: iniciativa.dataPrevistaConclusao,
        dataConclusao: iniciativa.dataConclusao,
      })
      .from(iniciativa)
      .where(isNull(iniciativa.arquivadoEm)),
    tx
      .select({ iniciativaId: iniciativaProjetoTema.iniciativaId, projetoTemaId: iniciativaProjetoTema.projetoTemaId })
      .from(iniciativaProjetoTema)
      .where(isNull(iniciativaProjetoTema.arquivadoEm)),
  ]);
  const porIniciativa = agrupar(ligacoes, (l) => l.iniciativaId, (l) => l.projetoTemaId);
  return linhas.map((l) => ({ ...l, projetos: porIniciativa.get(l.id) ?? [] }));
}

/** Leituras das interações; não dependem das iniciativas (que só servem para a montagem). */
async function consultarInteracoes(tx: Executor) {
  return Promise.all([
    tx
      .select({
        id: interacao.id,
        tipo: interacao.tipo,
        situacao: interacao.situacao,
        data: sql<string>`to_char(${interacao.inicio} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
      })
      .from(interacao)
      .where(isNull(interacao.arquivadoEm)),
    tx
      .select({ interacaoId: interacaoProjetoTema.interacaoId, projetoTemaId: interacaoProjetoTema.projetoTemaId })
      .from(interacaoProjetoTema)
      .where(isNull(interacaoProjetoTema.arquivadoEm)),
    tx
      .select({ interacaoId: interacaoIniciativa.interacaoId, iniciativaId: interacaoIniciativa.iniciativaId })
      .from(interacaoIniciativa)
      .where(isNull(interacaoIniciativa.arquivadoEm)),
    tx
      .select({ interacaoId: interacaoParticipante.interacaoId, usuarioId: interacaoParticipante.usuarioId })
      .from(interacaoParticipante)
      .where(isNull(interacaoParticipante.arquivadoEm)),
  ]);
}

function montarInteracoes(
  [linhas, diretas, indiretas, participantes]: Awaited<ReturnType<typeof consultarInteracoes>>,
  iniciativas: readonly IniciativaDoPainel[],
): InteracaoDoPainel[] {
  const projetosDaIniciativa = new Map(iniciativas.map((i) => [i.id, i.projetos]));
  const projetos = new Map<string, Set<string>>();
  const incluir = (interacaoId: string, ids: readonly string[]) => {
    const conjunto = projetos.get(interacaoId) ?? new Set<string>();
    for (const id of ids) conjunto.add(id);
    projetos.set(interacaoId, conjunto);
  };
  for (const d of diretas) incluir(d.interacaoId, [d.projetoTemaId]);
  for (const i of indiretas) incluir(i.interacaoId, projetosDaIniciativa.get(i.iniciativaId) ?? []);
  const internos = agrupar(
    participantes.filter((p) => p.usuarioId),
    (p) => p.interacaoId,
    (p) => p.usuarioId as string,
  );
  return linhas.map((l) => ({
    ...l,
    projetos: [...(projetos.get(l.id) ?? [])],
    participantesInternos: internos.get(l.id) ?? [],
  }));
}

/** Leitura dos compromissos; iniciativas e interações só servem para a montagem. */
function consultarCompromissos(tx: Executor) {
  return tx
    .select({
      id: compromisso.id,
      descricao: compromisso.descricao,
      situacao: compromisso.situacao,
      prazo: compromisso.prazo,
      concluidoEm: compromisso.concluidoEm,
      interacaoId: compromisso.interacaoId,
      iniciativaId: compromisso.iniciativaId,
      responsavelUsuarioId: compromisso.responsavelUsuarioId,
      responsavelStakeholderId: compromisso.responsavelStakeholderId,
      responsavelUsuarioNome: usuario.nome,
      responsavelExternoNome: sql<string | null>`coalesce(${pessoa.nomeCompleto}, ${instituicao.nome})`,
    })
    .from(compromisso)
    .leftJoin(usuario, eq(usuario.id, compromisso.responsavelUsuarioId))
    .leftJoin(pessoa, eq(pessoa.id, compromisso.responsavelStakeholderId))
    .leftJoin(instituicao, eq(instituicao.id, compromisso.responsavelStakeholderId))
    .where(isNull(compromisso.arquivadoEm));
}

function montarCompromissos(
  linhas: Awaited<ReturnType<typeof consultarCompromissos>>,
  iniciativas: readonly IniciativaDoPainel[],
  interacoes: readonly InteracaoDoPainel[],
): CompromissoDoPainel[] {
  const projetosDaIniciativa = new Map(iniciativas.map((i) => [i.id, i.projetos]));
  const projetosDaInteracao = new Map(interacoes.map((i) => [i.id, i.projetos]));
  return linhas.map((l) => ({
    id: l.id,
    descricao: l.descricao,
    situacao: l.situacao,
    prazo: l.prazo,
    concluidoEm: l.concluidoEm,
    responsavelUsuarioId: l.responsavelUsuarioId,
    responsavelNome: l.responsavelUsuarioNome ?? l.responsavelExternoNome,
    responsavelExterno: !l.responsavelUsuarioId && Boolean(l.responsavelStakeholderId),
    origem: l.iniciativaId ? ("iniciativa" as const) : ("interacao" as const),
    projetos: [
      ...new Set([
        ...(l.iniciativaId ? (projetosDaIniciativa.get(l.iniciativaId) ?? []) : []),
        ...(l.interacaoId ? (projetosDaInteracao.get(l.interacaoId) ?? []) : []),
      ]),
    ],
  }));
}

/**
 * Data do acompanhamento mais recente que registrou a conclusão de cada ação concluída. Usa os mesmos
 * acompanhamentos já lidos para o andamento (não arquivados, do mais recente para o mais antigo por
 * data e momento do registro): o resultado é o da antiga consulta própria, sem nova ida ao banco (P-071).
 */
function datasDeConclusao(
  acompanhamentos: Awaited<ReturnType<typeof acompanhamentosDasAcoes>>,
  concluidas: readonly string[],
): Map<string, string> {
  const alvo = new Set(concluidas);
  const mapa = new Map<string, string>();
  for (const l of acompanhamentos) if (alvo.has(l.acaoId) && l.situacao === "concluida" && !mapa.has(l.acaoId)) mapa.set(l.acaoId, l.data);
  return mapa;
}

async function carregarPlanos(tx: Executor, hoje: string): Promise<PlanoDoPainel[]> {
  const [planos, versoes] = await Promise.all([
    tx
      .select({ id: planoAcao.id, titulo: planoAcao.titulo, projetoTemaId: planoAcao.projetoTemaId })
      .from(planoAcao)
      .where(isNull(planoAcao.arquivadoEm)),
    tx
      .select({
        id: planoAcaoVersao.id,
        planoAcaoId: planoAcaoVersao.planoAcaoId,
        numeroVersao: planoAcaoVersao.numeroVersao,
        situacao: planoAcaoVersao.situacao,
      })
      .from(planoAcaoVersao)
      .where(
        or(
          eq(planoAcaoVersao.situacao, "aprovada"),
          and(isNull(planoAcaoVersao.arquivadoEm), inArray(planoAcaoVersao.situacao, ["rascunho", "em_aprovacao"])),
        ),
      ),
  ]);
  const aprovadas = versoes.filter((v) => v.situacao === "aprovada");
  const naoAprovadas = versoes.filter((v) => v.situacao !== "aprovada");
  // Consultas sobre o conjunto, e não uma por plano: o tempo não cresce com o número de planos.
  // P-071: o planejamento de todas as versões numa só leitura, separado depois por versão.
  const planejadas = await planejamentoDasVersoes(tx, versoes.map((v) => v.id));
  const doConjunto = (lista: typeof versoes) => new Map(lista.map((v) => [v.id, planejadas.get(v.id) ?? []]));
  const planejadasAprovadas = doConjunto(aprovadas);
  const planejadasPorVersao = doConjunto(naoAprovadas);
  const todas = [...planejadasAprovadas.values()].flat();
  const [acompanhamentos, alcancados] = await Promise.all([
    acompanhamentosDasAcoes(tx, todas.map((a) => a.acaoId)),
    marcosAlcancados(tx, todas.flatMap((a) => a.marcos.map((m) => m.marcoId))),
  ]);
  const acoesPorVersao = completarAcoesDasVersoes(planejadasAprovadas, andamentoDasLinhas(acompanhamentos), alcancados, hoje);
  const concluidas = [...acoesPorVersao.values()].flat().filter((a) => a.andamento.situacao === "concluida").map((a) => a.acaoId);
  const datas = datasDeConclusao(acompanhamentos, concluidas);
  return planos.map((plano) => {
    const vigente = aprovadas.find((v) => v.planoAcaoId === plano.id);
    return {
      ...plano,
      vigente: vigente ? { id: vigente.id, numeroVersao: vigente.numeroVersao } : null,
      acoes: (vigente ? (acoesPorVersao.get(vigente.id) ?? []) : []).map((a) => ({ ...a, dataConclusao: datas.get(a.acaoId) ?? null })),
      naoAprovadas: naoAprovadas
        .filter((v) => v.planoAcaoId === plano.id)
        .map((v) => {
          const planejadas = planejadasPorVersao.get(v.id) ?? [];
          return {
            numeroVersao: v.numeroVersao,
            situacao: v.situacao as "rascunho" | "em_aprovacao",
            acoes: planejadas.length,
            marcos: planejadas.reduce((soma, a) => soma + a.marcos.length, 0),
          };
        }),
    };
  });
}

export async function carregarDadosDoPainel(banco: Banco, hoje: string): Promise<DadosDoPainel> {
  // P-071, E3: quatro grupos independentes, iniciados juntos, cada um numa transação com a identidade
  // do usuário (as regras de acesso valem em todas as consultas). Numa transação única as consultas com
  // parâmetros não se sobrepõem, e a carga ficava em fila. Conjuntos que se referem uns aos outros
  // continuam lidos na mesma transação (iniciativas, interações e compromissos; projetos e fichas). Como
  // o banco usa READ COMMITTED, cada consulta já via o seu próprio instante também na transação única.
  const [planos, projetosEFichas, atividades, riscos] = await Promise.all([
    banco.transaction((tx) => carregarPlanos(tx, hoje)),
    banco.transaction(async (tx) => {
      const projetos = await carregarProjetos(tx);
      return { projetos, fichasPorProjeto: await fichasDosContextos(tx, projetos.map((p) => p.id)) };
    }),
    banco.transaction(async (tx) => {
      // Leituras sem parâmetros primeiro: o driver as envia em sequência, sem esperar cada resposta.
      const [iniciativas, leiturasDeInteracoes, linhasDeCompromissos, comites, vigente, usuarios] = await Promise.all([
        carregarIniciativas(tx),
        consultarInteracoes(tx),
        consultarCompromissos(tx),
        tx
          .select({ id: comite.id, nome: comite.nome })
          .from(comite)
          .where(isNull(comite.arquivadoEm))
          .orderBy(sql`${comite.tipo} = 'tematico'`, asc(comite.nome)),
        metodologiaVigente(tx),
        tx
          .select({ id: usuario.id, nome: usuario.nome })
          .from(usuario)
          .where(eq(usuario.situacao, "ativo"))
          .orderBy(asc(usuario.nome)),
      ]);
      const interacoes = montarInteracoes(leiturasDeInteracoes, iniciativas);
      const compromissos = montarCompromissos(linhasDeCompromissos, iniciativas, interacoes);
      return { iniciativas, interacoes, compromissos, comites, vigente, usuarios };
    }),
    banco.transaction((tx) => listarRiscos(tx, { semLimite: true }, hoje)),
  ]);
  const { projetos, fichasPorProjeto } = projetosEFichas;
  const { iniciativas, interacoes, compromissos, comites, vigente, usuarios } = atividades;
  const fichas = projetos.map((p): FichasDoProjeto => ({ projetoTemaId: p.id, fichas: fichasPorProjeto.get(p.id) ?? [] }));
  return {
    comites,
    projetos,
    iniciativas,
    interacoes,
    compromissos,
    planos,
    riscos,
    fichas,
    metodologia: vigente
      ? { id: vigente.id, nome: vigente.nome, ordinal: vigente.escalaPoderInteresse === "ordinal_tres_niveis" }
      : null,
    usuarios,
  };
}
