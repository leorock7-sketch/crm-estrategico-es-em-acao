/**
 * Validações no servidor, regras de prazo, datas e listas da Etapa 3
 * (iniciativas, interações e compromissos), sem banco de dados.
 */
import { describe, expect, test } from "vitest";
import {
  papelIniciativa,
  presencaInteracao,
  prioridadeIniciativa,
  situacaoCompromisso,
  situacaoIniciativa,
  situacaoInteracao,
  tipoIniciativa,
  tipoInteracao,
} from "@/lib/banco/esquema";
import { lerFormulario } from "@/lib/formulario";
import { esquemaIniciativa, esquemaNovaIniciativa } from "@/modulos/iniciativas/esquemas";
import {
  PAPEIS_INICIATIVA,
  PRIORIDADES_INICIATIVA,
  SITUACOES_INICIATIVA,
  TIPOS_INICIATIVA,
} from "@/modulos/iniciativas/rotulos";
import { instanteDeBrasilia, valorDataHoraBrasilia } from "@/modulos/interacoes/datas";
import {
  esquemaAcompanhamento,
  esquemaCompromisso,
  esquemaNovaInteracao,
  esquemaParticipante,
} from "@/modulos/interacoes/esquemas";
import {
  presencaInicial,
  PRESENCAS_INTERACAO,
  SITUACOES_COMPROMISSO,
  SITUACOES_INTERACAO,
  situacaoDoPrazo,
  TIPOS_INTERACAO,
} from "@/modulos/interacoes/rotulos";

const ID_A = "0b1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const ID_B = "1b1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";

const errosDe = (resultado: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  // Primeira mensagem de cada campo.
  Object.fromEntries((resultado.error?.issues ?? []).toReversed().map((i) => [String(i.path[0]), i.message]));

test("as listas das telas coincidem com as do banco", () => {
  expect([...TIPOS_INICIATIVA]).toEqual(tipoIniciativa.enumValues);
  expect([...SITUACOES_INICIATIVA]).toEqual(situacaoIniciativa.enumValues);
  expect([...PRIORIDADES_INICIATIVA]).toEqual(prioridadeIniciativa.enumValues);
  expect([...PAPEIS_INICIATIVA]).toEqual(papelIniciativa.enumValues);
  expect([...TIPOS_INTERACAO]).toEqual(tipoInteracao.enumValues);
  expect([...SITUACOES_INTERACAO]).toEqual(situacaoInteracao.enumValues);
  expect([...PRESENCAS_INTERACAO]).toEqual(presencaInteracao.enumValues);
  expect([...SITUACOES_COMPROMISSO]).toEqual(situacaoCompromisso.enumValues);
});

describe("Iniciativa", () => {
  const base = { tipo: "demanda", titulo: "Demanda fictícia", situacao: "registrada", dataAbertura: "2026-10-01" };

  test("nova iniciativa exige pelo menos um projeto ou tema; campos opcionais vazios são aceitos", () => {
    expect(errosDe(esquemaNovaIniciativa.safeParse({ ...base, projetos: [] })).projetos).toBe(
      "Selecione pelo menos um projeto ou tema.",
    );
    const ok = esquemaNovaIniciativa.safeParse({ ...base, projetos: [ID_A, ID_B], prioridade: "", responsavelId: "", descricao: " " });
    expect(ok.success).toBe(true);
    expect(ok.data).toMatchObject({ projetos: [ID_A, ID_B], prioridade: undefined, responsavelId: undefined, descricao: undefined });
  });

  test("datas coerentes e conclusão datada", () => {
    expect(errosDe(esquemaIniciativa.safeParse({ ...base, situacao: "concluida" })).dataConclusao).toBe("Informe a data de conclusão.");
    expect(errosDe(esquemaIniciativa.safeParse({ ...base, dataConclusao: "2026-09-01" })).dataConclusao).toBe(
      "A conclusão não pode ser anterior à abertura.",
    );
    expect(errosDe(esquemaIniciativa.safeParse({ ...base, dataPrevistaConclusao: "2026-09-30" })).dataPrevistaConclusao).toBe(
      "A previsão não pode ser anterior à abertura.",
    );
    expect(errosDe(esquemaIniciativa.safeParse({ ...base, titulo: "  " })).titulo).toBe("Título é obrigatório.");
    expect(errosDe(esquemaIniciativa.safeParse({ ...base, tipo: "outro" })).tipo).toBe("Selecione o tipo da iniciativa.");
  });
});

describe("Interação", () => {
  const base = { tipo: "reuniao_presencial", assunto: "Reunião fictícia", inicio: "2026-11-05T14:30", situacao: "realizada" };

  test("registrada com pelo menos um projeto, tema ou iniciativa; término não anterior ao início", () => {
    expect(errosDe(esquemaNovaInteracao.safeParse({ ...base, projetos: [], iniciativas: [] })).projetos).toBe(
      "Ligue a interação a pelo menos um projeto, tema ou iniciativa.",
    );
    expect(esquemaNovaInteracao.safeParse({ ...base, iniciativas: [ID_A, ID_B] }).success).toBe(true);
    expect(errosDe(esquemaNovaInteracao.safeParse({ ...base, projetos: [ID_A], fim: "2026-11-05T14:00" })).fim).toBe(
      "O término não pode ser anterior ao início.",
    );
    expect(errosDe(esquemaNovaInteracao.safeParse({ ...base, projetos: [ID_A], inicio: "05/11/2026" })).inicio).toBe(
      "Informe a data e a hora de início.",
    );
  });

  test("participante externo (s:) ou da equipe (u:), com presença; presença inicial conforme a situação", () => {
    const externo = esquemaParticipante.safeParse({ interacaoId: ID_A, participante: `s:${ID_B}`, presenca: "presente" });
    expect(externo.data?.participante).toEqual({ tipo: "stakeholder", id: ID_B });
    const interno = esquemaParticipante.safeParse({ interacaoId: ID_A, participante: `u:${ID_B}`, presenca: "convidado" });
    expect(interno.data?.participante).toEqual({ tipo: "usuario", id: ID_B });
    expect(esquemaParticipante.safeParse({ interacaoId: ID_A, participante: ID_B, presenca: "presente" }).success).toBe(false);
    expect(presencaInicial("realizada")).toBe("presente");
    expect(presencaInicial("agendada")).toBe("convidado");
  });

  test("data e hora no horário de Brasília, nos dois sentidos", () => {
    const instante = instanteDeBrasilia("2026-11-05T14:30");
    expect(instante.toISOString()).toBe("2026-11-05T17:30:00.000Z");
    expect(valorDataHoraBrasilia(instante)).toBe("2026-11-05T14:30");
  });
});

describe("Compromisso", () => {
  test("exige origem (interação ou iniciativa) e pelo menos um responsável", () => {
    expect(errosDe(esquemaCompromisso.safeParse({ descricao: "Enviar nota", responsavelUsuarioId: ID_A })).iniciativaId).toBe(
      "Ligue o compromisso a uma interação ou a uma iniciativa.",
    );
    expect(errosDe(esquemaCompromisso.safeParse({ descricao: "Enviar nota", interacaoId: ID_A })).responsavelUsuarioId).toBe(
      "Indique o responsável, da equipe ou externo.",
    );
    expect(esquemaCompromisso.safeParse({ descricao: "Enviar nota", iniciativaId: ID_A, responsavelStakeholderId: ID_B, prazo: "" }).success).toBe(true);
  });

  test("acompanhamento exige data e registro; a nova situação é opcional", () => {
    expect(esquemaAcompanhamento.safeParse({ compromissoId: ID_A, data: "2026-11-03", registro: "Feito", situacao: "" }).data?.situacao).toBeUndefined();
    expect(errosDe(esquemaAcompanhamento.safeParse({ compromissoId: ID_A, data: "", registro: "" }))).toMatchObject({
      data: "Informe a data do acompanhamento.",
      registro: "Registro é obrigatório.",
    });
  });

  test("prazo: vencido só para compromisso pendente com prazo anterior a hoje", () => {
    const hoje = "2026-11-03";
    expect(situacaoDoPrazo({ situacao: "aberto", prazo: "2026-11-02" }, hoje)).toBe("vencido");
    expect(situacaoDoPrazo({ situacao: "em_andamento", prazo: "2026-11-03" }, hoje)).toBe("vence_hoje");
    expect(situacaoDoPrazo({ situacao: "aberto", prazo: "2026-11-10" }, hoje)).toBe("no_prazo");
    expect(situacaoDoPrazo({ situacao: "aberto", prazo: null }, hoje)).toBe("sem_prazo");
    expect(situacaoDoPrazo({ situacao: "concluido", prazo: "2026-10-01" }, hoje)).toBe("encerrado");
    expect(situacaoDoPrazo({ situacao: "cancelado", prazo: "2026-10-01" }, hoje)).toBe("encerrado");
  });
});

test("leitura do formulário: caixas de seleção múltipla viram listas", () => {
  const formData = new FormData();
  formData.append("titulo", "Exemplo");
  formData.append("projetos", ID_A);
  formData.append("projetos", ID_B);
  formData.append("$ACTION_KEY", "interno");
  const { valores, dados } = lerFormulario(formData, ["projetos", "iniciativas"]);
  expect(dados).toEqual({ titulo: "Exemplo", projetos: [ID_A, ID_B], iniciativas: [] });
  expect(valores).toEqual({ titulo: "Exemplo", projetos: `${ID_A},${ID_B}`, iniciativas: "" });
});
