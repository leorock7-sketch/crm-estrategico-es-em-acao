/**
 * Relatórios R1 a R5 (D-079). Quem exporta o quê, sempre decidido no servidor:
 *
 * - Administrador: todos os projetos e temas.
 * - Gestor e colaborador: só os projetos e temas em que têm esse perfil, com permissão válida.
 *   Num projeto em que a mesma pessoa é leitora, nada é exportado.
 * - Leitor: nada; consulta os painéis na tela.
 * - Avaliações nominais (R5): só administrador e gestor do projeto ou tema; o colaborador recebe as
 *   contagens. Nunca há textos de justificativa, evidências, contatos pessoais nem observações.
 *
 * Os relatórios são montados só com o que as regras de acesso entregam ao usuário.
 */
import { sql } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import { ehAdministrador } from "@/modulos/acesso/capacidades";
import type { FichaParaMatriz } from "@/modulos/avaliacoes/matriz";
import {
  ROTULO_RESSALVAS_NAO_SE_APLICA,
  ROTULOS_NATUREZA_POSICIONAMENTO,
  ROTULOS_NIVEL,
  ROTULOS_POSICIONAMENTO,
  ROTULOS_SITUACAO_RESSALVAS,
} from "@/modulos/avaliacoes/rotulos";
import { ROTULOS_SITUACAO_COMPROMISSO, ROTULOS_SITUACAO_PRAZO, situacaoDoPrazo } from "@/modulos/interacoes/rotulos";
import { marcoAtrasado, ROTULOS_SITUACAO_ACAO, ROTULOS_SITUACAO_VERSAO } from "@/modulos/plano-acao/rotulos";
import { FAIXAS, ROTULOS_SITUACAO_RISCO } from "@/modulos/riscos/rotulos";
import type { DadosDoPainel } from "./dados";
import { dentroDoPeriodo, type FiltrosPainel } from "./filtros";
import {
  acoesDoEscopo,
  avaliacoesAtuais,
  calcularPanorama,
  classificacoesDoEscopo,
  compromissosDoEscopo,
  type LinhaPanorama,
  naoAvaliadoComManifestacao,
  planosDoEscopo,
  projetosNoEscopo,
  riscosDoEscopo,
} from "./indicadores";
import type { AbaRelatorio, ArquivoRelatorio, Celula } from "./xlsx";

export const RELATORIOS = {
  R1: { titulo: "R1 — Panorama por comitê", descricao: "Os números da visão executiva, por comitê, com o total geral.", arquivo: "panorama-por-comite" },
  R2: { titulo: "R2 — Compromissos", descricao: "Compromissos com responsável, prazo e situação; pendentes sem prazo são indicados.", arquivo: "compromissos" },
  R3: { titulo: "R3 — Plano de Ação", descricao: "Ações e marcos da versão vigente; versões não aprovadas em aba própria.", arquivo: "plano-de-acao" },
  R4: { titulo: "R4 — Riscos", descricao: "Criticidade inerente e residual, em pontos e faixas, status e revisão.", arquivo: "riscos" },
  R5: { titulo: "R5 — Stakeholders", descricao: "Contagens por projeto ou tema; avaliações nominais só para administrador e gestor do projeto ou tema.", arquivo: "stakeholders" },
} as const;

export type CodigoRelatorio = keyof typeof RELATORIOS;
export const CODIGOS_RELATORIO = Object.keys(RELATORIOS) as CodigoRelatorio[];

export function ehCodigoRelatorio(valor: string): valor is CodigoRelatorio {
  return (CODIGOS_RELATORIO as string[]).includes(valor);
}

export type EscopoExportacao = {
  podeExportar: boolean;
  /** Projetos e temas exportáveis. */
  projetos: "todos" | ReadonlySet<string>;
  /** Projetos e temas com avaliações nominais exportáveis. */
  nominais: "todos" | ReadonlySet<string>;
};

/** Decide no servidor, pelas permissões válidas lidas no banco, o que o usuário pode exportar. */
export async function escopoDeExportacao(banco: Executor): Promise<EscopoExportacao> {
  if (await ehAdministrador(banco)) return { podeExportar: true, projetos: "todos", nominais: "todos" };
  const perfis = (await banco.execute(sql`select projeto_tema_id, perfil from perfis_da_sessao()`)).rows as {
    projeto_tema_id: string;
    perfil: "gestor" | "colaborador" | "leitor";
  }[];
  const projetos = new Set(perfis.filter((p) => p.perfil !== "leitor").map((p) => p.projeto_tema_id));
  const nominais = new Set(perfis.filter((p) => p.perfil === "gestor").map((p) => p.projeto_tema_id));
  return { podeExportar: projetos.size > 0, projetos, nominais };
}

const contem = (conjunto: "todos" | ReadonlySet<string>, id: string) => conjunto === "todos" || conjunto.has(id);

const data = (valor: string | null | undefined, ausente = "Sem data") => (valor ? formatarData(valor) : ausente);

type Metadados = { hoje: string; extraidoEm: Date; usuario: string };

function descreverFiltros(dados: DadosDoPainel, filtros: FiltrosPainel): [string, string][] {
  const nomeDe = (lista: readonly { id: string; nome: string }[], id: string | undefined) =>
    id ? (lista.find((i) => i.id === id)?.nome ?? "Não disponível para este perfil") : "Todos";
  return [
    ["Comitê", nomeDe(dados.comites, filtros.comiteId)],
    ["Projeto ou tema", nomeDe(dados.projetos, filtros.projetoTemaId)],
    ["Responsável", nomeDe(dados.usuarios, filtros.responsavelId)],
    ["Período", filtros.de || filtros.ate ? `${filtros.de ? formatarData(filtros.de) : "início"} a ${filtros.ate ? formatarData(filtros.ate) : "hoje"}` : "Todo o histórico"],
  ];
}

function abaDeExtracao(titulo: string, dados: DadosDoPainel, filtros: FiltrosPainel, meta: Metadados, notas: string[]): AbaRelatorio {
  return {
    nome: "Extração",
    cabecalho: ["Informação", "Valor"],
    linhas: [
      ["Relatório", titulo],
      ["Data e hora da extração", formatarDataHora(meta.extraidoEm)],
      ["Usuário responsável", meta.usuario],
      ...descreverFiltros(dados, filtros).map(([nome, valor]): Celula[] => [`Filtro: ${nome}`, valor]),
      ["Alcance", "Somente os projetos e temas que o perfil do usuário permite exportar."],
      ...notas.map((nota, i): Celula[] => [`Nota ${i + 1}`, nota]),
    ],
  };
}

const CABECALHO_PANORAMA = [
  "Comitê", "Projetos e temas (principal)", "Projetos e temas (participante)", "Iniciativas em curso", "Interações no período",
  "Compromissos pendentes", "Compromissos vencidos", "Ações da versão vigente", "Ações atrasadas", "Marcos alcançados",
  "Marcos previstos", "Riscos baixos", "Riscos moderados", "Riscos altos", "Riscos críticos", "Riscos sem avaliação",
  "Riscos a reavaliar (regra provisória P-049)", "Avaliações de stakeholders", "Stakeholders sem avaliação",
];

function linhaPanorama(l: LinhaPanorama): Celula[] {
  return [
    l.comite, l.projetosPrincipais, l.projetosParticipantes, l.iniciativasEmCurso, l.interacoesNoPeriodo,
    l.compromissosPendentes, l.compromissosVencidos, l.acoesVigentes, l.acoesAtrasadas, l.marcosAlcancados,
    l.marcosPrevistos, l.riscosPorClassificacao.baixo, l.riscosPorClassificacao.moderado, l.riscosPorClassificacao.alto,
    l.riscosPorClassificacao.critico, l.riscosSemAvaliacao, l.riscosAReavaliar, l.stakeholdersAvaliados, l.stakeholdersSemAvaliacao,
  ];
}

function nomesDosProjetos(dados: DadosDoPainel, ids: readonly string[], escopo: ReadonlySet<string>): string {
  return dados.projetos.filter((p) => ids.includes(p.id) && escopo.has(p.id)).map((p) => p.nome).join("; ");
}

function relatorioPanorama(dados: DadosDoPainel, escopo: ReadonlySet<string>, filtros: FiltrosPainel, meta: Metadados): AbaRelatorio[] {
  const { linhas, total } = calcularPanorama(dados, escopo, filtros, meta.hoje);
  return [
    abaDeExtracao(RELATORIOS.R1.titulo, dados, filtros, meta, [
      "Projeto ligado a mais de um comitê aparece em cada um; o total geral conta cada registro uma única vez e, por isso, pode ser menor que a soma das linhas.",
      "Interações: data de início. Vencidos e atrasados: prazo do compromisso, fim previsto da ação e prazo do marco, com referência em hoje.",
      "Execução apurada só na versão vigente de cada plano.",
    ]),
    { nome: "Panorama", cabecalho: CABECALHO_PANORAMA, linhas: [...linhas.map(linhaPanorama), linhaPanorama(total)] },
  ];
}

function relatorioCompromissos(dados: DadosDoPainel, escopo: ReadonlySet<string>, filtros: FiltrosPainel, meta: Metadados): AbaRelatorio[] {
  const comPeriodo = Boolean(filtros.de || filtros.ate);
  const lista = compromissosDoEscopo({ dados, escopo, filtros, hoje: meta.hoje })
    .filter((c) => !comPeriodo || dentroDoPeriodo(c.prazo, filtros) || dentroDoPeriodo(c.concluidoEm, filtros) || (!c.prazo && c.situacao !== "concluido" && c.situacao !== "cancelado"))
    .sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
  return [
    abaDeExtracao(RELATORIOS.R2.titulo, dados, filtros, meta, [
      "Com período: compromissos com prazo ou conclusão no período. Pendentes sem prazo continuam listados, para não ficarem ocultos.",
      `Situação do prazo com referência em ${formatarData(meta.hoje)}.`,
    ]),
    {
      nome: "Compromissos",
      cabecalho: ["Compromisso", "Projetos e temas", "Origem", "Responsável", "Tipo de responsável", "Situação", "Prazo", "Situação do prazo", "Concluído em"],
      linhas: lista.map((c) => [
        c.descricao,
        nomesDosProjetos(dados, c.projetos, escopo),
        c.origem === "iniciativa" ? "Iniciativa" : "Interação",
        c.responsavelNome ?? "Sem responsável",
        c.responsavelNome ? (c.responsavelExterno ? "Externo" : "Equipe") : "—",
        ROTULOS_SITUACAO_COMPROMISSO[c.situacao],
        data(c.prazo, "Sem prazo"),
        ROTULOS_SITUACAO_PRAZO[situacaoDoPrazo(c, meta.hoje)],
        c.situacao === "concluido" ? data(c.concluidoEm, "Sem data registrada") : "—",
      ]),
    },
  ];
}

function relatorioPlano(dados: DadosDoPainel, escopo: ReadonlySet<string>, filtros: FiltrosPainel, meta: Metadados): AbaRelatorio[] {
  const contexto = { dados, escopo, filtros, hoje: meta.hoje };
  const comPeriodo = Boolean(filtros.de || filtros.ate);
  const planos = planosDoEscopo(contexto);
  const planoPorId = new Map(planos.map((p) => [p.id, p]));
  const nomeProjeto = (id: string) => dados.projetos.find((p) => p.id === id)?.nome ?? "—";
  const acoes = acoesDoEscopo(contexto).filter(
    (a) => !comPeriodo || dentroDoPeriodo(a.fimPrevisto, filtros) || dentroDoPeriodo(a.dataConclusao, filtros) || !a.fimPrevisto,
  );
  return [
    abaDeExtracao(RELATORIOS.R3.titulo, dados, filtros, meta, [
      "Ações e marcos só da versão vigente de cada plano; versões não aprovadas ficam na aba própria e não se somam.",
      "Conclusão da ação: data do acompanhamento que a registrou. Percentual: somente o informado no acompanhamento, sem médias.",
      "Com período: ações com fim previsto ou conclusão no período. Ações sem fim previsto continuam listadas.",
    ]),
    {
      nome: "Ações",
      cabecalho: ["Projeto ou tema", "Plano", "Versão vigente", "Código", "Ação", "Pilar ou eixo", "Responsável", "Início previsto", "Fim previsto", "Situação", "Percentual informado", "Concluída em", "Atrasada"],
      linhas: acoes.map((a) => [
        nomeProjeto(a.projetoTemaId),
        planoPorId.get(a.planoId)?.titulo ?? "—",
        planoPorId.get(a.planoId)?.vigente?.numeroVersao ?? null,
        a.codigo,
        a.titulo,
        a.eixoNome ?? "Sem pilar ou eixo",
        a.responsavelUsuarioNome ?? a.responsavelStakeholderNome ?? "Sem responsável",
        data(a.inicioPrevisto),
        data(a.fimPrevisto, "Sem prazo"),
        a.andamento.situacao ? ROTULOS_SITUACAO_ACAO[a.andamento.situacao] : "Sem situação registrada",
        a.andamento.percentual,
        a.andamento.situacao === "concluida" ? data(a.dataConclusao, "Sem data registrada") : "—",
        a.atrasada ? "Sim" : "Não",
      ]),
    },
    {
      nome: "Marcos",
      cabecalho: ["Projeto ou tema", "Plano", "Ação", "Marco", "Descrição", "Prazo previsto", "Alcançado em", "Atrasado"],
      linhas: acoes.flatMap((a) =>
        a.marcos.map((m): Celula[] => [
          nomeProjeto(a.projetoTemaId),
          planoPorId.get(a.planoId)?.titulo ?? "—",
          a.codigo,
          m.codigo,
          m.descricao,
          data(m.prazoPrevisto, "Sem prazo"),
          m.alcancadoEm ? formatarData(m.alcancadoEm) : "Não alcançado",
          marcoAtrasado(m.alcancadoEm !== null, m.prazoPrevisto, meta.hoje) ? "Sim" : "Não",
        ]),
      ),
    },
    {
      nome: "Versões não aprovadas",
      cabecalho: ["Projeto ou tema", "Plano", "Versão", "Situação", "Ações propostas", "Marcos propostos"],
      linhas: planos.flatMap((p) =>
        p.naoAprovadas.map((v): Celula[] => [nomeProjeto(p.projetoTemaId), p.titulo, v.numeroVersao, v.situacao === "rascunho" ? "Em elaboração (rascunho)" : ROTULOS_SITUACAO_VERSAO[v.situacao], v.acoes, v.marcos]),
      ),
    },
  ];
}

function relatorioRiscos(dados: DadosDoPainel, escopo: ReadonlySet<string>, filtros: FiltrosPainel, meta: Metadados): AbaRelatorio[] {
  const comPeriodo = Boolean(filtros.de || filtros.ate);
  const lista = riscosDoEscopo({ dados, escopo, filtros, hoje: meta.hoje }).filter(
    (r) => !comPeriodo || [r.inerente?.dataAvaliacao, r.residual?.dataAvaliacao, ...r.gatilhosOcorridosEm].some((d) => dentroDoPeriodo(d, filtros)),
  );
  return [
    abaDeExtracao(RELATORIOS.R4.titulo, dados, filtros, meta, [
      "Matriz 5 × 5 do Comitê de Infraestrutura. A comparação é em pontos do índice e em faixas, sem percentuais de redução: o índice é ordinal.",
      '"A reavaliar" segue a regra provisória P-049, ainda não homologada.',
      "Com período: riscos com avaliação ou gatilho ocorrido no período.",
    ]),
    {
      nome: "Riscos",
      cabecalho: [
        "Projeto ou tema", "Código", "Risco", "Dono", "Status",
        "Inerente: probabilidade", "Inerente: impacto", "Inerente: criticidade", "Inerente: faixa", "Inerente: data",
        "Residual: probabilidade", "Residual: impacto", "Residual: criticidade", "Residual: faixa", "Residual: data",
        "Diferença em pontos (residual − inerente)", "Mudou de faixa", "Próxima revisão", "Gatilho ocorrido", "A reavaliar (regra provisória P-049)",
      ],
      linhas: lista.map((r) => [
        r.projetoNome, r.codigo, r.titulo, r.responsavelNome ?? "Sem dono", ROTULOS_SITUACAO_RISCO[r.situacao],
        r.inerente?.probabilidade ?? null, r.inerente?.impacto ?? null, r.inerente?.criticidade ?? null,
        r.inerente ? FAIXAS[r.inerente.classificacao].rotulo : "Sem avaliação", r.inerente ? formatarData(r.inerente.dataAvaliacao) : "—",
        r.residual?.probabilidade ?? null, r.residual?.impacto ?? null, r.residual?.criticidade ?? null,
        r.residual ? FAIXAS[r.residual.classificacao].rotulo : "Sem avaliação residual", r.residual ? formatarData(r.residual.dataAvaliacao) : "—",
        r.inerente && r.residual ? r.residual.criticidade - r.inerente.criticidade : null,
        r.inerente && r.residual ? (r.inerente.classificacao !== r.residual.classificacao ? "Sim" : "Não") : "—",
        data(r.proximaRevisao, "Sem data de revisão"),
        r.gatilhoOcorrido ? "Sim" : "Não",
        r.reavaliacao.length > 0 ? "Sim" : "Não",
      ]),
    },
  ];
}

const nivelOuAusente = (nivel: "alto" | "medio" | "baixo" | null) => (nivel ? ROTULOS_NIVEL[nivel] : "Não avaliado");

function linhaNominal(projeto: string, ficha: FichaParaMatriz, situacao: string): Celula[] {
  const v = ficha.vigente;
  return [
    projeto,
    ficha.nome,
    ficha.tipoStakeholder === "pessoa" ? "Pessoa" : "Instituição",
    situacao,
    v?.numeroVersao ?? null,
    v ? formatarData(v.dataReferencia) : "—",
    v ? nivelOuAusente(v.nivelPoder) : "Sem avaliação",
    v ? nivelOuAusente(v.nivelInteresse) : "Sem avaliação",
    v ? (v.posicionamento ? ROTULOS_POSICIONAMENTO[v.posicionamento] : "Não avaliado") : "Sem avaliação",
    v ? (v.naturezaPosicionamento ? ROTULOS_NATUREZA_POSICIONAMENTO[v.naturezaPosicionamento] : "Não informada") : "—",
    v ? (v.situacaoRessalvas ? ROTULOS_SITUACAO_RESSALVAS[v.situacaoRessalvas] : ROTULO_RESSALVAS_NAO_SE_APLICA) : "—",
    v ? formatarData(v.proximaRevisao) : "—",
  ];
}

function relatorioStakeholders(dados: DadosDoPainel, escopo: ReadonlySet<string>, filtros: FiltrosPainel, meta: Metadados, nominais: EscopoExportacao["nominais"]): AbaRelatorio[] {
  const classificacoes = classificacoesDoEscopo({ dados, escopo, filtros, hoje: meta.hoje });
  const nomeProjeto = (id: string) => dados.projetos.find((p) => p.id === id)?.nome ?? "—";
  const agregado: AbaRelatorio = {
    nome: "Contagens",
    cabecalho: [
      "Projeto ou tema", "Avaliações na metodologia vigente", "Sem avaliação publicada", "Em metodologia anterior", "Revisão vencida",
      "Poder alto", "Poder médio", "Poder baixo", "Poder não avaliado",
      "Interesse alto", "Interesse médio", "Interesse baixo", "Interesse não avaliado",
      "Favoráveis", "Neutros", "Contrários", "Posicionamento não avaliado",
      "Manifestação formal", "Informação informal", "Percepção do consultor", "Natureza não informada",
      "Há ressalvas", "Ressalvas não identificadas", "Informação insuficiente", "Ressalvas: não se aplica (sem manifestação identificada)",
      "Situação específica, não é classificação: posicionamento não avaliado, com manifestação registrada (já incluído em Posicionamento não avaliado)",
    ],
    linhas: classificacoes.map(({ projetoTemaId, matriz }) => {
      const atuais = avaliacoesAtuais(matriz);
      const conta = (condicao: (v: (typeof atuais)[number]["vigente"]) => boolean) => atuais.filter((f) => condicao(f.vigente)).length;
      return [
        nomeProjeto(projetoTemaId), atuais.length, matriz.naoAvaliados.length, matriz.metodologiaAnterior.length,
        matriz.exigemReavaliacao.filter((e) => e.motivo === "revisao_vencida").length,
        conta((v) => v.nivelPoder === "alto"), conta((v) => v.nivelPoder === "medio"), conta((v) => v.nivelPoder === "baixo"), conta((v) => v.nivelPoder === null),
        conta((v) => v.nivelInteresse === "alto"), conta((v) => v.nivelInteresse === "medio"), conta((v) => v.nivelInteresse === "baixo"), conta((v) => v.nivelInteresse === null),
        conta((v) => v.posicionamento === "favoravel"), conta((v) => v.posicionamento === "neutro"), conta((v) => v.posicionamento === "contrario"), conta((v) => v.posicionamento === null),
        conta((v) => v.naturezaPosicionamento === "manifestacao_formal"), conta((v) => v.naturezaPosicionamento === "informacao_informal"), conta((v) => v.naturezaPosicionamento === "percepcao_consultor"), conta((v) => v.naturezaPosicionamento === null),
        conta((v) => v.situacaoRessalvas === "ha_ressalvas"), conta((v) => v.situacaoRessalvas === "nao_identificadas"), conta((v) => v.situacaoRessalvas === "informacao_insuficiente"), conta((v) => !v.situacaoRessalvas),
        conta(naoAvaliadoComManifestacao),
      ];
    }),
  };
  const abas = [
    abaDeExtracao(RELATORIOS.R5.titulo, dados, filtros, meta, [
      `Metodologia vigente: ${dados.metodologia?.nome ?? "nenhuma"}. "Não avaliado" e "sem avaliação" nunca equivalem a nível baixo.`,
      "Avaliações nominais: somente administrador e gestor do projeto ou tema; sem justificativas nem evidências.",
      "Com filtro de responsável, só entram as avaliações registradas por essa pessoa; associados sem avaliação saem da contagem.",
    ]),
    agregado,
  ];
  const nominaisNoEscopo = classificacoes.filter((c) => contem(nominais, c.projetoTemaId));
  if (nominaisNoEscopo.length > 0) {
    abas.push({
      nome: "Avaliações nominais",
      cabecalho: ["Projeto ou tema", "Stakeholder", "Tipo", "Situação da avaliação", "Versão", "Data de referência", "Poder", "Interesse", "Posicionamento", "Natureza da informação", "Ressalvas", "Próxima revisão"],
      linhas: nominaisNoEscopo.flatMap(({ projetoTemaId, matriz }) => {
        const projeto = nomeProjeto(projetoTemaId);
        return [
          ...avaliacoesAtuais(matriz).map((f) => linhaNominal(projeto, f, "Vigente")),
          ...matriz.metodologiaAnterior.map((f) => linhaNominal(projeto, f, "Metodologia anterior: não comparável")),
          ...matriz.naoAvaliados.map((f) => linhaNominal(projeto, f, "Sem avaliação publicada")),
        ];
      }),
    });
  }
  return abas;
}

/** Monta o relatório só com os projetos e temas que o usuário pode exportar. */
export function montarRelatorio(
  codigo: CodigoRelatorio,
  dados: DadosDoPainel,
  escopoExportacao: EscopoExportacao,
  filtros: FiltrosPainel,
  meta: Metadados,
): ArquivoRelatorio {
  if (!escopoExportacao.podeExportar) throw new Error("Este perfil não exporta relatórios.");
  const limite = escopoExportacao.projetos === "todos" ? undefined : escopoExportacao.projetos;
  const escopo = projetosNoEscopo(dados, filtros, limite);
  const abas = {
    R1: () => relatorioPanorama(dados, escopo, filtros, meta),
    R2: () => relatorioCompromissos(dados, escopo, filtros, meta),
    R3: () => relatorioPlano(dados, escopo, filtros, meta),
    R4: () => relatorioRiscos(dados, escopo, filtros, meta),
    R5: () => relatorioStakeholders(dados, escopo, filtros, meta, escopoExportacao.nominais),
  }[codigo]();
  return { nomeArquivo: `crm-${codigo}-${RELATORIOS[codigo].arquivo}-${meta.hoje}.xlsx`, abas };
}

