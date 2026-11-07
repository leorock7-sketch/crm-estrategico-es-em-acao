/**
 * Indicadores dos painéis (D-078, D-079). Só contagens, datas e situações registradas: nenhum índice
 * sintético, ranking, estimativa ou percentual calculado. Sem dependência do banco.
 *
 * - Cada indicador diz qual data usou (`dataUsada`), ou que é a situação de hoje, sem período.
 * - Ausência é contada à parte: sem avaliação, sem prazo e sem responsável não viram outro valor.
 * - Execução do plano: só a versão vigente; versões não aprovadas ficam em grupo próprio.
 * - Cada registro conta uma vez no total, ainda que ligado a mais de um projeto ou comitê.
 */
import { formatarData } from "@/lib/formatacao";
import {
  classificarParaMatriz,
  type ClassificacaoMatriz,
  type FichaAvaliada,
} from "@/modulos/avaliacoes/matriz";
import {
  ROTULO_RESSALVAS_NAO_SE_APLICA,
  ROTULOS_NATUREZA_POSICIONAMENTO,
  ROTULOS_NIVEL,
  ROTULOS_POSICIONAMENTO,
  ROTULOS_SITUACAO_RESSALVAS,
} from "@/modulos/avaliacoes/rotulos";
import {
  ROTULOS_PRIORIDADE_INICIATIVA,
  ROTULOS_SITUACAO_INICIATIVA,
  ROTULOS_TIPO_INICIATIVA,
  SITUACOES_INICIATIVA,
  SITUACOES_INICIATIVA_EM_CURSO,
  TIPOS_INICIATIVA,
} from "@/modulos/iniciativas/rotulos";
import {
  ROTULOS_SITUACAO_COMPROMISSO,
  ROTULOS_SITUACAO_INTERACAO,
  ROTULOS_TIPO_INTERACAO,
  SITUACOES_COMPROMISSO_PENDENTES,
  SITUACOES_INTERACAO,
  TIPOS_INTERACAO,
} from "@/modulos/interacoes/rotulos";
import { marcoAtrasado, ROTULOS_SITUACAO_ACAO, SITUACOES_ACAO } from "@/modulos/plano-acao/rotulos";
import { CLASSIFICACOES, FAIXAS, ROTULOS_SITUACAO_RISCO, SITUACOES_RISCO } from "@/modulos/riscos/rotulos";
import {
  ROTULOS_SITUACAO_PROJETO_TEMA,
  SITUACOES_PROJETO_TEMA,
} from "@/modulos/projetos-temas/rotulos";
import type { AcaoDoPainel, DadosDoPainel, IniciativaDoPainel, RiscoDoPainel } from "./dados";
import { dentroDoPeriodo, type FiltrosPainel } from "./filtros";

export const SITUACAO_ATUAL = "Situação atual, sem período";

export type Indicador = {
  rotulo: string;
  valor: number | string;
  /** Data usada na apuração, ou que é a situação de hoje. */
  dataUsada: string;
  /** Chama a atenção na tela, sem julgar o desempenho. */
  atencao?: boolean;
  nota?: string;
};

export type GrupoIndicadores = { titulo: string; indicadores: Indicador[] };
export type Bloco = { id: string; titulo: string; descricao?: string; grupos: GrupoIndicadores[] };

type Contexto = {
  dados: DadosDoPainel;
  /** Projetos e temas considerados. */
  escopo: ReadonlySet<string>;
  filtros: FiltrosPainel;
  hoje: string;
};

const noEscopo = (projetos: readonly string[], escopo: ReadonlySet<string>) => projetos.some((id) => escopo.has(id));

/** Soma dias a uma data AAAA-MM-DD, sem depender do fuso do computador. */
function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Janela de "a vencer": parâmetro provisório (P-061), ainda não homologado. É o único ponto a ajustar. */
export const DIAS_A_VENCER = 30;

// --- Seleção dos registros ---------------------------------------------------

export function projetosNoEscopo(dados: DadosDoPainel, filtros: FiltrosPainel, limite?: ReadonlySet<string>): Set<string> {
  return new Set(
    dados.projetos
      .filter(
        (p) =>
          (!limite || limite.has(p.id)) &&
          (!filtros.projetoTemaId || p.id === filtros.projetoTemaId) &&
          (!filtros.comiteId || p.comiteId === filtros.comiteId || p.participantes.includes(filtros.comiteId)),
      )
      .map((p) => p.id),
  );
}

export function iniciativasDoEscopo({ dados, escopo, filtros }: Contexto) {
  return dados.iniciativas.filter(
    (i) => noEscopo(i.projetos, escopo) && (!filtros.responsavelId || i.responsavelId === filtros.responsavelId),
  );
}

export function interacoesDoEscopo({ dados, escopo, filtros }: Contexto) {
  return dados.interacoes.filter(
    (i) => noEscopo(i.projetos, escopo) && (!filtros.responsavelId || i.participantesInternos.includes(filtros.responsavelId)),
  );
}

export function compromissosDoEscopo({ dados, escopo, filtros }: Contexto) {
  return dados.compromissos.filter(
    (c) => noEscopo(c.projetos, escopo) && (!filtros.responsavelId || c.responsavelUsuarioId === filtros.responsavelId),
  );
}

export function planosDoEscopo({ dados, escopo }: Contexto) {
  return dados.planos.filter((p) => escopo.has(p.projetoTemaId));
}

/** Ações da versão vigente: é o único universo dos indicadores de execução. */
export function acoesDoEscopo(contexto: Contexto): (AcaoDoPainel & { planoId: string; projetoTemaId: string })[] {
  const { filtros } = contexto;
  return planosDoEscopo(contexto).flatMap((p) =>
    p.acoes
      .filter((a) => !filtros.responsavelId || a.responsavelUsuarioId === filtros.responsavelId)
      .map((a) => ({ ...a, planoId: p.id, projetoTemaId: p.projetoTemaId })),
  );
}

export function riscosDoEscopo({ dados, escopo, filtros }: Contexto): RiscoDoPainel[] {
  return dados.riscos.filter(
    (r) => escopo.has(r.projetoTemaId) && (!filtros.responsavelId || r.responsavelId === filtros.responsavelId),
  );
}

/** Com filtro de responsável, só as avaliações registradas por essa pessoa (P-062). */
export function fichasDoEscopo({ dados, escopo, filtros }: Contexto) {
  const noEscopoAtual = dados.fichas.filter((f) => escopo.has(f.projetoTemaId));
  if (!filtros.responsavelId) return noEscopoAtual;
  return noEscopoAtual.map((f) => ({ ...f, fichas: f.fichas.filter((ficha) => ficha.vigente?.avaliadorId === filtros.responsavelId) }));
}

// --- Regras comuns -----------------------------------------------------------

const contar = <T>(lista: readonly T[], condicao: (item: T) => boolean) => lista.filter(condicao).length;

const iniciativaEmCurso = (i: IniciativaDoPainel) => SITUACOES_INICIATIVA_EM_CURSO.includes(i.situacao);
const compromissoPendente = (situacao: (typeof SITUACOES_COMPROMISSO_PENDENTES)[number]) =>
  SITUACOES_COMPROMISSO_PENDENTES.includes(situacao);

const rotuloPeriodo = (filtros: FiltrosPainel) => (filtros.de || filtros.ate ? "no período" : "(todo o histórico)");

// --- Blocos ------------------------------------------------------------------

export function blocoProjetos(contexto: Contexto): Bloco {
  const projetos = contexto.dados.projetos.filter((p) => contexto.escopo.has(p.id));
  return {
    id: "comites",
    titulo: "Projetos e temas",
    grupos: [
      {
        titulo: "Por situação",
        indicadores: [
          { rotulo: "Projetos e temas", valor: projetos.length, dataUsada: SITUACAO_ATUAL },
          ...SITUACOES_PROJETO_TEMA.map((s) => ({
            rotulo: ROTULOS_SITUACAO_PROJETO_TEMA[s],
            valor: contar(projetos, (p) => p.situacao === s),
            dataUsada: SITUACAO_ATUAL,
          })),
        ],
      },
    ],
  };
}

export function blocoIniciativas(contexto: Contexto): Bloco {
  const { filtros, hoje } = contexto;
  const lista = iniciativasDoEscopo(contexto);
  const emCurso = lista.filter(iniciativaEmCurso);
  const periodo = rotuloPeriodo(filtros);
  return {
    id: "iniciativas",
    titulo: "Iniciativas",
    grupos: [
      {
        titulo: "Situação atual",
        indicadores: [
          { rotulo: "Total", valor: lista.length, dataUsada: SITUACAO_ATUAL },
          { rotulo: "Em curso", valor: emCurso.length, dataUsada: SITUACAO_ATUAL },
          ...SITUACOES_INICIATIVA.map((s) => ({
            rotulo: ROTULOS_SITUACAO_INICIATIVA[s],
            valor: contar(lista, (i) => i.situacao === s),
            dataUsada: SITUACAO_ATUAL,
          })),
        ],
      },
      {
        titulo: "Prazos e responsáveis",
        indicadores: [
          {
            rotulo: "Em curso com previsão de conclusão vencida",
            valor: contar(emCurso, (i) => i.dataPrevistaConclusao !== null && i.dataPrevistaConclusao < hoje),
            dataUsada: "Data prevista de conclusão",
            atencao: true,
          },
          { rotulo: "Em curso sem previsão de conclusão", valor: contar(emCurso, (i) => !i.dataPrevistaConclusao), dataUsada: SITUACAO_ATUAL },
          { rotulo: "Sem responsável", valor: contar(lista, (i) => !i.responsavelId), dataUsada: SITUACAO_ATUAL },
        ],
      },
      {
        titulo: "Movimento",
        indicadores: [
          { rotulo: `Abertas ${periodo}`, valor: contar(lista, (i) => dentroDoPeriodo(i.dataAbertura, filtros)), dataUsada: "Data de abertura" },
          {
            rotulo: `Concluídas ${periodo}`,
            valor: contar(lista, (i) => i.situacao === "concluida" && dentroDoPeriodo(i.dataConclusao, filtros)),
            dataUsada: "Data efetiva de conclusão",
          },
          {
            rotulo: "Concluídas sem data registrada",
            valor: contar(lista, (i) => i.situacao === "concluida" && !i.dataConclusao),
            dataUsada: SITUACAO_ATUAL,
            nota: "Não contadas como concluídas em nenhum período.",
          },
        ],
      },
      {
        titulo: "Tipo e prioridade",
        indicadores: [
          ...TIPOS_INICIATIVA.map((t) => ({ rotulo: ROTULOS_TIPO_INICIATIVA[t], valor: contar(lista, (i) => i.tipo === t), dataUsada: SITUACAO_ATUAL })),
          ...(["alta", "media", "baixa"] as const).map((p) => ({
            rotulo: `Prioridade ${ROTULOS_PRIORIDADE_INICIATIVA[p].toLowerCase()}`,
            valor: contar(lista, (i) => i.prioridade === p),
            dataUsada: SITUACAO_ATUAL,
          })),
          { rotulo: "Sem prioridade informada", valor: contar(lista, (i) => !i.prioridade), dataUsada: SITUACAO_ATUAL },
        ],
      },
    ],
  };
}

export function blocoInteracoes(contexto: Contexto): Bloco {
  const { filtros } = contexto;
  const lista = interacoesDoEscopo(contexto);
  const noPeriodo = lista.filter((i) => dentroDoPeriodo(i.data, filtros));
  const periodo = rotuloPeriodo(filtros);
  const realizadas = lista.filter((i) => i.situacao === "realizada").map((i) => i.data).sort();
  return {
    id: "interacoes",
    titulo: "Interações",
    descricao: "O filtro de responsável considera os participantes da equipe interna.",
    grupos: [
      {
        titulo: `Situação ${periodo}`,
        indicadores: SITUACOES_INTERACAO.map((s) => ({
          rotulo: ROTULOS_SITUACAO_INTERACAO[s],
          valor: contar(noPeriodo, (i) => i.situacao === s),
          dataUsada: "Data de início da interação",
        })),
      },
      {
        titulo: `Tipo ${periodo}`,
        indicadores: TIPOS_INTERACAO.map((t) => ({
          rotulo: ROTULOS_TIPO_INTERACAO[t],
          valor: contar(noPeriodo, (i) => i.tipo === t),
          dataUsada: "Data de início da interação",
        })),
      },
      {
        titulo: "Mais recente",
        indicadores: [
          {
            rotulo: "Última interação realizada",
            valor: realizadas.length > 0 ? formatarData(realizadas.at(-1)) : "Nenhuma registrada",
            dataUsada: "Data de início da interação",
          },
        ],
      },
    ],
  };
}

export function blocoCompromissos(contexto: Contexto): Bloco {
  const { filtros, hoje } = contexto;
  const lista = compromissosDoEscopo(contexto);
  const pendentes = lista.filter((c) => compromissoPendente(c.situacao));
  const limite = somarDias(hoje, DIAS_A_VENCER);
  const periodo = rotuloPeriodo(filtros);
  return {
    id: "compromissos",
    titulo: "Compromissos",
    grupos: [
      {
        titulo: "Situação atual",
        indicadores: [
          { rotulo: "Pendentes", valor: pendentes.length, dataUsada: SITUACAO_ATUAL },
          { rotulo: "Vencidos", valor: contar(pendentes, (c) => c.prazo !== null && c.prazo < hoje), dataUsada: "Prazo do compromisso", atencao: true },
          { rotulo: `A vencer em ${DIAS_A_VENCER} dias`, valor: contar(pendentes, (c) => c.prazo !== null && c.prazo >= hoje && c.prazo <= limite), dataUsada: "Prazo do compromisso", nota: "Janela provisória (P-061), ainda não homologada." },
          { rotulo: "Pendentes sem prazo", valor: contar(pendentes, (c) => !c.prazo), dataUsada: SITUACAO_ATUAL, nota: "Sem prazo não significa em dia." },
          { rotulo: "Pendentes com responsável externo", valor: contar(pendentes, (c) => c.responsavelExterno), dataUsada: SITUACAO_ATUAL },
          { rotulo: "Pendentes sem responsável", valor: contar(pendentes, (c) => !c.responsavelNome), dataUsada: SITUACAO_ATUAL },
        ],
      },
      {
        titulo: "Movimento",
        indicadores: [
          { rotulo: `Com prazo ${periodo}`, valor: contar(lista, (c) => dentroDoPeriodo(c.prazo, filtros)), dataUsada: "Prazo do compromisso" },
          { rotulo: `Concluídos ${periodo}`, valor: contar(lista, (c) => c.situacao === "concluido" && dentroDoPeriodo(c.concluidoEm, filtros)), dataUsada: "Data efetiva de conclusão" },
          { rotulo: "Concluídos sem data registrada", valor: contar(lista, (c) => c.situacao === "concluido" && !c.concluidoEm), dataUsada: SITUACAO_ATUAL, nota: "Não contados como concluídos em nenhum período." },
          { rotulo: ROTULOS_SITUACAO_COMPROMISSO.cancelado, valor: contar(lista, (c) => c.situacao === "cancelado"), dataUsada: SITUACAO_ATUAL },
        ],
      },
    ],
  };
}

/** Marcos da versão vigente das ações informadas. */
export function marcosDasAcoes(acoes: readonly AcaoDoPainel[]) {
  return acoes.flatMap((a) => a.marcos.map((m) => ({ ...m, acaoCodigo: a.codigo, acaoTitulo: a.titulo })));
}

export function blocoPlanos(contexto: Contexto): Bloco {
  const { filtros, hoje } = contexto;
  const planos = planosDoEscopo(contexto);
  const acoes = acoesDoEscopo(contexto);
  const marcos = marcosDasAcoes(acoes);
  const periodo = rotuloPeriodo(filtros);
  const naoAprovadas = planos.flatMap((p) => p.naoAprovadas);
  return {
    id: "planos",
    titulo: "Planos, ações e marcos",
    descricao: "Execução apurada só na versão vigente de cada plano. Versões não aprovadas aparecem à parte e não se somam às vigentes.",
    grupos: [
      {
        titulo: "Planos",
        indicadores: [
          { rotulo: "Planos", valor: planos.length, dataUsada: SITUACAO_ATUAL },
          { rotulo: "Com versão vigente", valor: contar(planos, (p) => p.vigente !== null), dataUsada: SITUACAO_ATUAL },
          { rotulo: "Sem versão vigente", valor: contar(planos, (p) => p.vigente === null), dataUsada: SITUACAO_ATUAL },
        ],
      },
      {
        titulo: "Ações da versão vigente",
        indicadores: [
          { rotulo: "Ações", valor: acoes.length, dataUsada: SITUACAO_ATUAL },
          ...SITUACOES_ACAO.map((s) => ({
            rotulo: ROTULOS_SITUACAO_ACAO[s],
            valor: contar(acoes, (a) => a.andamento.situacao === s),
            dataUsada: "Último acompanhamento com situação",
          })),
          { rotulo: "Sem situação registrada", valor: contar(acoes, (a) => a.andamento.situacao === null), dataUsada: SITUACAO_ATUAL, nota: "Não é o mesmo que não iniciada." },
          { rotulo: "Atrasadas", valor: contar(acoes, (a) => a.atrasada), dataUsada: "Fim previsto da ação", atencao: true },
          { rotulo: "Sem fim previsto", valor: contar(acoes, (a) => !a.fimPrevisto), dataUsada: SITUACAO_ATUAL, nota: "Sem prazo não significa em dia." },
          { rotulo: "Com responsável externo", valor: contar(acoes, (a) => !a.responsavelUsuarioId && Boolean(a.responsavelStakeholderId)), dataUsada: SITUACAO_ATUAL },
          { rotulo: `Fim previsto ${periodo}`, valor: contar(acoes, (a) => dentroDoPeriodo(a.fimPrevisto, filtros)), dataUsada: "Fim previsto da ação" },
          {
            rotulo: `Concluídas ${periodo}`,
            valor: contar(acoes, (a) => a.andamento.situacao === "concluida" && dentroDoPeriodo(a.dataConclusao, filtros)),
            dataUsada: "Data do acompanhamento que registrou a conclusão",
          },
          {
            rotulo: "Concluídas sem data registrada",
            valor: contar(acoes, (a) => a.andamento.situacao === "concluida" && !a.dataConclusao),
            dataUsada: SITUACAO_ATUAL,
            nota: "Não contadas como concluídas em nenhum período.",
          },
        ],
      },
      {
        titulo: "Marcos da versão vigente",
        indicadores: [
          { rotulo: "Alcançados", valor: `${contar(marcos, (m) => m.alcancadoEm !== null)} de ${marcos.length}`, dataUsada: SITUACAO_ATUAL },
          { rotulo: "Atrasados", valor: contar(marcos, (m) => marcoAtrasado(m.alcancadoEm !== null, m.prazoPrevisto, hoje)), dataUsada: "Prazo previsto do marco", atencao: true },
          { rotulo: "Sem prazo", valor: contar(marcos, (m) => !m.prazoPrevisto), dataUsada: SITUACAO_ATUAL },
          { rotulo: `Alcançados ${periodo}`, valor: contar(marcos, (m) => dentroDoPeriodo(m.alcancadoEm, filtros)), dataUsada: "Data do acompanhamento que registrou o marco" },
        ],
      },
      {
        titulo: "Versões ainda não aprovadas (não somadas acima)",
        indicadores: [
          { rotulo: "Em elaboração (rascunho)", valor: contar(naoAprovadas, (v) => v.situacao === "rascunho"), dataUsada: SITUACAO_ATUAL },
          { rotulo: "Em aprovação", valor: contar(naoAprovadas, (v) => v.situacao === "em_aprovacao"), dataUsada: SITUACAO_ATUAL },
          { rotulo: "Ações nessas versões", valor: naoAprovadas.reduce((s, v) => s + v.acoes, 0), dataUsada: SITUACAO_ATUAL },
          { rotulo: "Marcos nessas versões", valor: naoAprovadas.reduce((s, v) => s + v.marcos, 0), dataUsada: SITUACAO_ATUAL },
        ],
      },
    ],
  };
}

export function blocoRiscos(contexto: Contexto): Bloco {
  const { filtros, hoje } = contexto;
  const lista = riscosDoEscopo(contexto);
  const periodo = rotuloPeriodo(filtros);
  const comAmbas = lista.filter((r) => r.inerente && r.residual);
  return {
    id: "riscos",
    titulo: "Riscos",
    descricao: "Matriz 5 × 5 do Comitê de Infraestrutura. A comparação entre inerente e residual é feita em pontos e faixas, sem percentuais.",
    grupos: [
      {
        titulo: "Classificação vigente",
        indicadores: [
          { rotulo: "Riscos", valor: lista.length, dataUsada: SITUACAO_ATUAL },
          ...CLASSIFICACOES.map((c) => ({
            rotulo: FAIXAS[c].rotulo,
            valor: contar(lista, (r) => r.vigente?.classificacao === c),
            dataUsada: "Última avaliação do risco",
          })),
          { rotulo: "Sem avaliação", valor: contar(lista, (r) => !r.vigente), dataUsada: SITUACAO_ATUAL, nota: "Sem avaliação não significa risco baixo." },
        ],
      },
      {
        titulo: "Inerente e residual",
        indicadores: [
          { rotulo: "Só com avaliação inerente", valor: contar(lista, (r) => Boolean(r.inerente) && !r.residual), dataUsada: "Última avaliação do risco" },
          { rotulo: "Com avaliação residual", valor: comAmbas.length, dataUsada: "Última avaliação do risco" },
          { rotulo: "Mudaram de faixa", valor: contar(comAmbas, (r) => r.inerente?.classificacao !== r.residual?.classificacao), dataUsada: "Última avaliação do risco" },
          { rotulo: "Mantiveram a faixa", valor: contar(comAmbas, (r) => r.inerente?.classificacao === r.residual?.classificacao), dataUsada: "Última avaliação do risco" },
        ],
      },
      {
        titulo: "Status",
        indicadores: SITUACOES_RISCO.map((s) => ({
          rotulo: ROTULOS_SITUACAO_RISCO[s],
          valor: contar(lista, (r) => r.situacao === s),
          dataUsada: SITUACAO_ATUAL,
        })),
      },
      {
        titulo: "Acompanhamento",
        indicadores: [
          {
            rotulo: "A reavaliar",
            valor: contar(lista, (r) => r.reavaliacao.length > 0),
            dataUsada: "Último gatilho, última avaliação e próxima revisão",
            atencao: true,
            nota: "Regra provisória P-049, ainda não homologada.",
          },
          { rotulo: "Revisão vencida", valor: contar(lista, (r) => r.proximaRevisao !== null && r.proximaRevisao < hoje), dataUsada: "Próxima revisão", atencao: true },
          { rotulo: "Sem data de revisão", valor: contar(lista, (r) => !r.proximaRevisao), dataUsada: SITUACAO_ATUAL },
          { rotulo: "Sem dono", valor: contar(lista, (r) => !r.responsavelId), dataUsada: SITUACAO_ATUAL },
          { rotulo: `Com gatilho ocorrido ${periodo}`, valor: contar(lista, (r) => r.gatilhosOcorridosEm.some((d) => dentroDoPeriodo(d, filtros))), dataUsada: "Data do registro do gatilho" },
          { rotulo: `Com avaliação ${periodo}`, valor: contar(lista, (r) => [r.inerente?.dataAvaliacao, r.residual?.dataAvaliacao].some((d) => dentroDoPeriodo(d, filtros))), dataUsada: "Data da avaliação" },
        ],
      },
    ],
  };
}

/** Situação das avaliações de stakeholders, por projeto ou tema, na metodologia vigente. */
export function classificacoesDoEscopo(contexto: Contexto): { projetoTemaId: string; matriz: ClassificacaoMatriz }[] {
  const { dados, hoje } = contexto;
  return fichasDoEscopo(contexto).map((f) => ({
    projetoTemaId: f.projetoTemaId,
    matriz: classificarParaMatriz(f.fichas, dados.metodologia?.id ?? null, hoje),
  }));
}

/**
 * Situação específica H5 da metodologia (P-064), e não classificação de stakeholder: posicionamento não
 * avaliado, mas com manifestação registrada, indicada pela situação das ressalvas ou pela natureza formal
 * ou informal da informação.
 */
export function naoAvaliadoComManifestacao(v: FichaAvaliada["vigente"]): boolean {
  return v.posicionamento === null && (Boolean(v.situacaoRessalvas) || v.naturezaPosicionamento === "manifestacao_formal" || v.naturezaPosicionamento === "informacao_informal");
}

/** Avaliações vigentes na metodologia atual: as que entram na leitura de níveis. */
export function avaliacoesAtuais(matriz: ClassificacaoMatriz): FichaAvaliada[] {
  return [...matriz.noGrafico, ...matriz.semPontuacao];
}

export function blocoStakeholders(contexto: Contexto): Bloco {
  const { filtros, dados } = contexto;
  const classificacoes = classificacoesDoEscopo(contexto);
  const atuais = classificacoes.flatMap((c) => avaliacoesAtuais(c.matriz));
  const anteriores = classificacoes.flatMap((c) => c.matriz.metodologiaAnterior);
  const semAvaliacao = classificacoes.flatMap((c) => c.matriz.naoAvaliados);
  const periodo = rotuloPeriodo(filtros);
  const nivel = (eixo: "nivelPoder" | "nivelInteresse") => [
    ...(["alto", "medio", "baixo"] as const).map((n) => ({
      rotulo: ROTULOS_NIVEL[n],
      valor: contar(atuais, (f) => f.vigente[eixo] === n),
      dataUsada: "Versão vigente da avaliação",
    })),
    { rotulo: "Não avaliado", valor: contar(atuais, (f) => f.vigente[eixo] === null), dataUsada: "Versão vigente da avaliação", nota: "Nunca é tratado como baixo." },
  ];
  return {
    id: "stakeholders",
    titulo: "Stakeholders",
    descricao: `Metodologia vigente: ${dados.metodologia?.nome ?? "nenhuma"}. Contagem por projeto ou tema: quem está em dois contextos tem duas avaliações, que não se somam nem se comparam. Com filtro de responsável, só entram as avaliações registradas por essa pessoa; associados sem avaliação saem da contagem.`,
    grupos: [
      {
        titulo: "Cobertura",
        indicadores: [
          { rotulo: "Avaliações na metodologia vigente", valor: atuais.length, dataUsada: "Versão vigente da avaliação" },
          { rotulo: "Associados sem avaliação publicada", valor: semAvaliacao.length, dataUsada: SITUACAO_ATUAL, nota: "Sem avaliação não significa nível baixo." },
          { rotulo: "Avaliados em metodologia anterior", valor: anteriores.length, dataUsada: "Versão vigente da avaliação", nota: "Não comparáveis; exigem reavaliação." },
          { rotulo: "Avaliados com associação encerrada", valor: classificacoes.reduce((s, c) => s + c.matriz.associacaoEncerrada.length, 0), dataUsada: SITUACAO_ATUAL, nota: "Fora das demais contagens." },
          { rotulo: "Revisão vencida", valor: classificacoes.reduce((s, c) => s + c.matriz.exigemReavaliacao.filter((e) => e.motivo === "revisao_vencida").length, 0), dataUsada: "Próxima revisão da avaliação", atencao: true },
          { rotulo: `Com data de referência ${periodo}`, valor: contar(atuais, (f) => dentroDoPeriodo(f.vigente.dataReferencia, filtros)), dataUsada: "Data de referência da avaliação" },
        ],
      },
      { titulo: "Poder", indicadores: nivel("nivelPoder") },
      { titulo: "Interesse", indicadores: nivel("nivelInteresse") },
      {
        titulo: "Posicionamento",
        indicadores: [
          ...(["favoravel", "neutro", "contrario"] as const).map((p) => ({
            rotulo: ROTULOS_POSICIONAMENTO[p],
            valor: contar(atuais, (f) => f.vigente.posicionamento === p),
            dataUsada: "Versão vigente da avaliação",
          })),
          { rotulo: "Não avaliado", valor: contar(atuais, (f) => f.vigente.posicionamento === null), dataUsada: "Versão vigente da avaliação" },
        ],
      },
      {
        titulo: "Situação específica (não é classificação de stakeholder)",
        indicadores: [
          {
            rotulo: "Posicionamento não avaliado, com manifestação registrada",
            valor: contar(atuais, (f) => naoAvaliadoComManifestacao(f.vigente)),
            dataUsada: "Versão vigente da avaliação",
            nota: "Já incluído em Não avaliado, no grupo Posicionamento. Não é nível, posicionamento nem quarta categoria (H5, P-064).",
          },
        ],
      },
      {
        titulo: "Natureza da informação e ressalvas",
        indicadores: [
          ...(["manifestacao_formal", "informacao_informal", "percepcao_consultor"] as const).map((n) => ({
            rotulo: ROTULOS_NATUREZA_POSICIONAMENTO[n],
            valor: contar(atuais, (f) => f.vigente.naturezaPosicionamento === n),
            dataUsada: "Versão vigente da avaliação",
          })),
          { rotulo: "Natureza não informada", valor: contar(atuais, (f) => f.vigente.naturezaPosicionamento === null), dataUsada: "Versão vigente da avaliação" },
          ...(["ha_ressalvas", "nao_identificadas", "informacao_insuficiente"] as const).map((r) => ({
            rotulo: `Ressalvas: ${ROTULOS_SITUACAO_RESSALVAS[r].toLowerCase()}`,
            valor: contar(atuais, (f) => f.vigente.situacaoRessalvas === r),
            dataUsada: "Versão vigente da avaliação",
          })),
          { rotulo: `Ressalvas: ${ROTULO_RESSALVAS_NAO_SE_APLICA.toLowerCase()}`, valor: contar(atuais, (f) => !f.vigente.situacaoRessalvas), dataUsada: "Versão vigente da avaliação" },
        ],
      },
    ],
  };
}

export function calcularBlocos(dados: DadosDoPainel, escopo: ReadonlySet<string>, filtros: FiltrosPainel, hoje: string): Bloco[] {
  const contexto = { dados, escopo, filtros, hoje };
  return [
    blocoProjetos(contexto),
    blocoIniciativas(contexto),
    blocoInteracoes(contexto),
    blocoCompromissos(contexto),
    blocoPlanos(contexto),
    blocoRiscos(contexto),
    blocoStakeholders(contexto),
  ];
}

// --- Panorama por comitê -----------------------------------------------------

export type LinhaPanorama = {
  comiteId: string | null;
  comite: string;
  projetosPrincipais: number;
  projetosParticipantes: number;
  iniciativasEmCurso: number;
  interacoesNoPeriodo: number;
  compromissosPendentes: number;
  compromissosVencidos: number;
  acoesVigentes: number;
  acoesAtrasadas: number;
  marcosAlcancados: number;
  marcosPrevistos: number;
  riscosPorClassificacao: Record<(typeof CLASSIFICACOES)[number], number>;
  riscosSemAvaliacao: number;
  riscosAReavaliar: number;
  stakeholdersAvaliados: number;
  stakeholdersSemAvaliacao: number;
};

function linhaDoEscopo(
  dados: DadosDoPainel,
  escopo: ReadonlySet<string>,
  filtros: FiltrosPainel,
  hoje: string,
  identificacao: Pick<LinhaPanorama, "comiteId" | "comite" | "projetosPrincipais" | "projetosParticipantes">,
): LinhaPanorama {
  const contexto = { dados, escopo, filtros, hoje };
  const pendentes = compromissosDoEscopo(contexto).filter((c) => compromissoPendente(c.situacao));
  const acoes = acoesDoEscopo(contexto);
  const marcos = marcosDasAcoes(acoes);
  const riscos = riscosDoEscopo(contexto);
  const classificacoes = classificacoesDoEscopo(contexto);
  return {
    ...identificacao,
    iniciativasEmCurso: contar(iniciativasDoEscopo(contexto), iniciativaEmCurso),
    interacoesNoPeriodo: contar(interacoesDoEscopo(contexto), (i) => dentroDoPeriodo(i.data, filtros)),
    compromissosPendentes: pendentes.length,
    compromissosVencidos: contar(pendentes, (c) => c.prazo !== null && c.prazo < hoje),
    acoesVigentes: acoes.length,
    acoesAtrasadas: contar(acoes, (a) => a.atrasada),
    marcosAlcancados: contar(marcos, (m) => m.alcancadoEm !== null),
    marcosPrevistos: marcos.length,
    riscosPorClassificacao: {
      baixo: contar(riscos, (r) => r.vigente?.classificacao === "baixo"),
      moderado: contar(riscos, (r) => r.vigente?.classificacao === "moderado"),
      alto: contar(riscos, (r) => r.vigente?.classificacao === "alto"),
      critico: contar(riscos, (r) => r.vigente?.classificacao === "critico"),
    },
    riscosSemAvaliacao: contar(riscos, (r) => !r.vigente),
    riscosAReavaliar: contar(riscos, (r) => r.reavaliacao.length > 0),
    stakeholdersAvaliados: classificacoes.reduce((s, c) => s + avaliacoesAtuais(c.matriz).length, 0),
    stakeholdersSemAvaliacao: classificacoes.reduce((s, c) => s + c.matriz.naoAvaliados.length, 0),
  };
}

/** Uma linha por projeto ou tema, com as mesmas contagens do panorama. */
export function calcularPorProjeto(dados: DadosDoPainel, escopo: ReadonlySet<string>, filtros: FiltrosPainel, hoje: string): LinhaPanorama[] {
  return dados.projetos
    .filter((p) => escopo.has(p.id))
    .map((p) =>
      linhaDoEscopo(dados, new Set([p.id]), filtros, hoje, { comiteId: p.id, comite: p.nome, projetosPrincipais: 1, projetosParticipantes: 0 }),
    );
}

/**
 * Uma linha por comitê: o projeto aparece no comitê principal e nos participantes. O total geral é
 * calculado de novo sobre o conjunto, e não somando as linhas: cada registro conta uma única vez.
 */
export function calcularPanorama(
  dados: DadosDoPainel,
  escopo: ReadonlySet<string>,
  filtros: FiltrosPainel,
  hoje: string,
): { linhas: LinhaPanorama[]; total: LinhaPanorama } {
  const projetos = dados.projetos.filter((p) => escopo.has(p.id));
  const linhas = dados.comites
    .filter((c) => !filtros.comiteId || c.id === filtros.comiteId)
    .map((c) => {
      const principais = projetos.filter((p) => p.comiteId === c.id);
      const participantes = projetos.filter((p) => p.comiteId !== c.id && p.participantes.includes(c.id));
      return linhaDoEscopo(dados, new Set([...principais, ...participantes].map((p) => p.id)), filtros, hoje, {
        comiteId: c.id,
        comite: c.nome,
        projetosPrincipais: principais.length,
        projetosParticipantes: participantes.length,
      });
    });
  const total = linhaDoEscopo(dados, escopo, filtros, hoje, {
    comiteId: null,
    comite: "Total geral (cada registro conta uma vez)",
    projetosPrincipais: projetos.length,
    projetosParticipantes: 0,
  });
  return { linhas, total };
}
