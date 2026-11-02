/**
 * Rubricas da metodologia V2.2, resumidas da versão final da Q-66 (1.0,
 * homologada pelo gestor na D-068). São texto de ajuda que orienta o julgamento
 * profissional, sem substituí-lo (D-067). Usadas para cadastrar a metodologia
 * V2.2 na carga de demonstração e nos testes; ficam travadas na tabela
 * rubrica_nivel quando a metodologia entra em vigor.
 */
import type { NovaMetodologia } from "./consultas";

export const RUBRICAS_V22: NonNullable<NovaMetodologia["rubricas"]> = [
  {
    dimensao: "poder",
    nivel: "alto",
    criterioOrientador:
      "Pode, por competência ou posição própria, aprovar, negar, vetar, suspender ou condicionar uma decisão essencial ou um recurso indispensável; ou tem capacidade de influência decisiva sobre decisões estratégicas, viabilidade, continuidade ou condições essenciais do projeto, identificada por fatos específicos ou por avaliação prospectiva fundamentada em elementos concretos do contexto, mesmo sem precedente histórico.",
    basesTipicas:
      "Norma, ato, parecer vinculante, contrato, titularidade; precedente de efeito decisivo; condição de financiador ou licenciador que dependa da sua anuência; elementos concretos que sustentem a avaliação prospectiva.",
  },
  {
    dimensao: "poder",
    nivel: "medio",
    criterioOrientador:
      "Capacidade relevante de influenciar, dificultar, atrasar ou modificar decisões relativas ao projeto, identificada a partir de competências, recursos, relacionamentos, circunstâncias ou indícios específicos, segundo avaliação fundamentada do consultor, sem efeito determinante identificado. Não exige que o efeito já tenha ocorrido.",
    basesTipicas:
      "Voto em colegiado, sem veto; parecer não vinculante; recurso substituível; legitimidade específica para questionar; relacionamento com quem decide; conselho consultivo avaliado pela capacidade efetiva ou plausível de influência.",
  },
  {
    dimensao: "poder",
    nivel: "baixo",
    criterioOrientador:
      "Influência limitada ou marginal — indireta, eventual ou restrita a aspectos acessórios —, sem capacidade relevante identificada, conforme avaliação fundamentada.",
    basesTipicas:
      "Indicação do que foi examinado ou considerado; verificação documental, quando houver. A falta de sinais de Alto não prova Baixo.",
  },
  {
    dimensao: "poder",
    nivel: "nao_avaliado",
    criterioOrientador:
      "Não se conhecem competências, recursos, relações ou circunstâncias suficientes para formar um julgamento. Hipótese meramente abstrata não é poder.",
  },
  {
    dimensao: "interesse",
    nivel: "alto",
    criterioOrientador:
      "O projeto é muito relevante para objetivos centrais, competências, operações, responsabilidades ou prioridades do stakeholder: afeta-os de forma direta e significativa, ou o tema é prioridade formal. Não exige participação.",
    basesTipicas: "Mandato coincidente; estudo de impacto direto; plano ou agenda oficial que cita o tema; manifestação de prioridade.",
  },
  {
    dimensao: "interesse",
    nivel: "medio",
    criterioOrientador: "Relevância parcial, indireta ou condicionada: o tema importa, mas não é central.",
    basesTipicas: "Relação secundária com o mandato; efeitos indiretos; menção pontual.",
  },
  {
    dimensao: "interesse",
    nivel: "baixo",
    criterioOrientador: "Relevância marginal ou remota: o projeto não altera nada importante para o stakeholder.",
    basesTipicas:
      "Comparação entre o escopo do projeto e os objetivos ou competências. Presença ou ausência em reuniões não determina o interesse.",
  },
  {
    dimensao: "interesse",
    nivel: "nao_avaliado",
    criterioOrientador: "Não há informação suficiente sobre a relevância do projeto para o stakeholder.",
  },
  {
    dimensao: "posicionamento",
    nivel: "favoravel",
    criterioOrientador:
      "Orientação predominante de apoio à proposta, identificada em manifestações ou ações, formais ou informais, ou em percepção fundamentada — inclusive quando condicionada, se a orientação for predominantemente favorável; as condições ficam como ressalvas relevantes.",
    basesTipicas: "Ofício, declaração pública ou em reunião, conversa com representante envolvido, voto, adesão, aporte.",
  },
  {
    dimensao: "posicionamento",
    nivel: "neutro",
    criterioOrientador:
      "Manifestação efetivamente neutra ou equidistante, formal ou informal: declara que não apoia nem se opõe, que se mantém imparcial ou que não tomará posição. Silêncio, falta de resposta ou dever de imparcialidade não bastam.",
    basesTipicas: "Nota, ofício, ata, declaração em reunião.",
  },
  {
    dimensao: "posicionamento",
    nivel: "contrario",
    criterioOrientador: "Orientação predominante de oposição à proposta, inclusive condição que descaracteriza a proposta.",
    basesTipicas: "Ofício contrário, voto contrário, ação judicial, campanha, declaração pública.",
  },
  {
    dimensao: "posicionamento",
    nivel: "nao_avaliado",
    criterioOrientador:
      "Sem manifestação nem informação suficiente para formar um julgamento, ou manifestação efetivamente inconclusiva (registre a manifestação, as condições e a razão da indefinição). Não há quarta categoria.",
  },
];

/** Metodologia V2.2 com as rubricas homologadas (Q-66 1.0, D-068). */
export const METODOLOGIA_V22: Omit<NovaMetodologia, "metodologiaAnteriorId"> = {
  nome: "V2.2 — rubricas Q-66 1.0",
  descricao:
    "Metodologia institucional V2.2: poder e interesse em Baixo, Médio e Alto; posicionamento em Favorável, Neutro e Contrário; \"Não avaliado\" à parte. Rubricas homologadas (D-068) como orientação do julgamento profissional, com alertas que não bloqueiam (D-067). Nesta fase, só com dados fictícios.",
  escalaPoderInteresse: "ordinal_tres_niveis",
  escalaPosicionamento: "tres_categorias",
  homologada: true,
  criterios: [],
  rubricas: RUBRICAS_V22,
};
