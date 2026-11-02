import { describe, expect, test } from "vitest";
import {
  dimensaoCriterio,
  dimensaoRubrica,
  escalaPoderInteresse,
  escalaPosicionamento,
  grauConfianca,
  naturezaAlteracao,
  naturezaPosicionamento,
  nivelAvaliacao,
  perfilContexto,
  posicionamento,
  situacaoMetodologia,
  situacaoRessalvas,
  situacaoVersaoAvaliacao,
  tipoEvidencia,
} from "@/lib/banco/esquema";
import { formatarNumero, hojeEmBrasilia } from "@/lib/formatacao";
import { calcularAlertas, type DadosParaAlertas } from "@/modulos/avaliacoes/alertas";
import {
  calcularDimensao,
  calcularResultado,
  type LigacaoMetodologia,
  metodologiasComparaveis,
  tendenciaDoPosicionamento,
} from "@/modulos/avaliacoes/calculo";
import { errosDaEscala, esquemaEvidencia, esquemaRascunho, notasDoFormulario } from "@/modulos/avaliacoes/esquemas";
import {
  agruparPorCelula,
  classificarParaMatriz,
  type FichaAvaliada,
  type FichaParaMatriz,
  nomeDaCelula,
} from "@/modulos/avaliacoes/matriz";
import {
  DIMENSOES,
  DIMENSOES_RUBRICA,
  ESCALAS_PODER_INTERESSE,
  ESCALAS_POSICIONAMENTO,
  GRAUS_CONFIANCA,
  NATUREZAS_ALTERACAO,
  NATUREZAS_POSICIONAMENTO,
  NIVEIS,
  PERFIS_CONTEXTO,
  POSICIONAMENTOS,
  POSICIONAMENTOS_VIGENTES,
  posicionamentoPreliminar,
  SITUACOES_METODOLOGIA,
  SITUACOES_RESSALVAS,
  SITUACOES_VERSAO,
  TIPOS_EVIDENCIA,
} from "@/modulos/avaliacoes/rotulos";

const ID_VERSAO = "5e1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const C3 = "33333333-3333-4333-8333-333333333333";
const CRITERIOS = [
  { id: C1, dimensao: "poder" as const, escalaMinima: 1, escalaMaxima: 5, peso: 2 },
  { id: C2, dimensao: "poder" as const, escalaMinima: 1, escalaMaxima: 5, peso: null },
  { id: C3, dimensao: "interesse" as const, escalaMinima: 0, escalaMaxima: 4, peso: null },
];

describe("Cálculo de demonstração", () => {
  test("converte cada nota para 0–100 e faz a média ponderada (peso vazio conta 1)", () => {
    // Poder: (100 × 2 + 50 × 1) / 3 = 83,33. Interesse: 1 na escala 0–4 = 25.
    expect(calcularResultado(CRITERIOS, new Map([[C1, 5], [C2, 3], [C3, 1]]))).toEqual({ poder: 83.33, interesse: 25 });
  });

  test("nota mínima vale 0, mas nota ausente deixa a dimensão sem pontuação", () => {
    expect(calcularDimensao(CRITERIOS, new Map([[C1, 1], [C2, 1]]), "poder")).toBe(0);
    expect(calcularDimensao(CRITERIOS, new Map([[C1, 5]]), "poder")).toBeNull();
    expect(calcularDimensao(CRITERIOS, new Map(), "interesse")).toBeNull();
  });

  test("dimensão sem critérios ou com todos os pesos zerados fica sem pontuação", () => {
    expect(calcularDimensao([], new Map(), "poder")).toBeNull();
    const zerados = CRITERIOS.map((c) => ({ ...c, peso: 0 }));
    expect(calcularDimensao(zerados, new Map([[C1, 5], [C2, 5]]), "poder")).toBeNull();
  });

  test("tendência compara posicionamentos e ignora “não avaliado”", () => {
    expect(tendenciaDoPosicionamento("favoravel", "neutro")).toBe("mais_favoravel");
    expect(tendenciaDoPosicionamento("contrario", "parcialmente_contrario")).toBe("menos_favoravel");
    expect(tendenciaDoPosicionamento("neutro", "neutro")).toBe("estavel");
    expect(tendenciaDoPosicionamento(null, "neutro")).toBeNull();
    expect(tendenciaDoPosicionamento("neutro", null)).toBeNull();
  });

  test("entre metodologias não comparáveis, a tendência é “não comparável” (T-6)", () => {
    expect(tendenciaDoPosicionamento("favoravel", "neutro", false)).toBe("nao_comparavel");
    expect(tendenciaDoPosicionamento(null, "neutro", false)).toBeNull();
  });

  test("comparáveis: mesma metodologia, cadeia de alterações editoriais ou equivalência declarada; a mesma escala não basta", () => {
    const ligacoes = new Map<string, LigacaoMetodologia>([
      ["a", { anteriorId: null, naturezaAlteracao: null, equivalentePosicionamentoA: null }],
      ["b", { anteriorId: "a", naturezaAlteracao: "editorial", equivalentePosicionamentoA: null }],
      ["c", { anteriorId: "b", naturezaAlteracao: "editorial", equivalentePosicionamentoA: null }],
      ["d", { anteriorId: "c", naturezaAlteracao: "substantiva", equivalentePosicionamentoA: null }],
      ["e", { anteriorId: "d", naturezaAlteracao: "substantiva", equivalentePosicionamentoA: "d" }],
      ["x", { anteriorId: null, naturezaAlteracao: null, equivalentePosicionamentoA: null }],
    ]);
    expect(metodologiasComparaveis("a", "a", ligacoes)).toBe(true);
    expect(metodologiasComparaveis("c", "a", ligacoes)).toBe(true);
    expect(metodologiasComparaveis("d", "c", ligacoes)).toBe(false);
    expect(metodologiasComparaveis("d", "a", ligacoes)).toBe(false);
    expect(metodologiasComparaveis("e", "d", ligacoes)).toBe(true);
    expect(metodologiasComparaveis("x", "a", ligacoes)).toBe(false);
    expect(metodologiasComparaveis(null, null, ligacoes)).toBe(true);
    expect(metodologiasComparaveis("a", null, ligacoes)).toBe(false);
  });
});

function ficha(parcial: Partial<FichaParaMatriz> & { stakeholderId: string }): FichaParaMatriz {
  return { nome: parcial.stakeholderId, tipoStakeholder: "pessoa", associado: true, temRascunho: false, vigente: null, ...parcial };
}

const vigente = (
  metodologiaId: string | null,
  extra: Partial<NonNullable<FichaParaMatriz["vigente"]>> = {},
): NonNullable<FichaParaMatriz["vigente"]> => ({
  numeroVersao: 1,
  metodologiaId,
  metodologiaNome: metodologiaId,
  poder: 50,
  interesse: 50,
  nivelPoder: null,
  nivelInteresse: null,
  posicionamento: null,
  naturezaPosicionamento: null,
  grauConfianca: null,
  dataReferencia: "2026-10-01",
  proximaRevisao: "2027-10-01",
  ...extra,
});

/** Avaliação na escala V2.2: níveis, sem pontuação. */
const vigenteV22 = (extra: Partial<NonNullable<FichaParaMatriz["vigente"]>> = {}) =>
  vigente("v22", { poder: null, interesse: null, nivelPoder: "alto", nivelInteresse: "alto", ...extra });

describe("Classificação para a matriz", () => {
  test("separa metodologia vigente, anterior, sem pontuação, não avaliados e associação encerrada", () => {
    const resultado = classificarParaMatriz(
      [
        ficha({ stakeholderId: "atual", vigente: vigente("m2", { posicionamento: "favoravel" }) }),
        ficha({ stakeholderId: "sem-posicao", vigente: vigente("m2") }),
        ficha({ stakeholderId: "antiga", vigente: vigente("m1") }),
        ficha({ stakeholderId: "incompleta", vigente: vigente("m2", { poder: null }) }),
        ficha({ stakeholderId: "sem-metodologia", vigente: vigente(null, { poder: null, interesse: null }) }),
        ficha({ stakeholderId: "nao-avaliado" }),
        ficha({ stakeholderId: "encerrada", associado: false, vigente: vigente("m2") }),
        ficha({ stakeholderId: "encerrada-sem-avaliacao", associado: false }),
      ],
      "m2",
      "2026-11-01",
    );
    const ids = (lista: { stakeholderId: string }[]) => lista.map((f) => f.stakeholderId);
    expect(ids(resultado.noGrafico)).toEqual(["atual", "sem-posicao"]);
    expect(ids(resultado.metodologiaAnterior)).toEqual(["antiga"]);
    expect(ids(resultado.semPontuacao)).toEqual(["incompleta", "sem-metodologia"]);
    expect(ids(resultado.naoAvaliados)).toEqual(["nao-avaliado"]);
    expect(ids(resultado.associacaoEncerrada)).toEqual(["encerrada"]);
    expect(resultado.exigemReavaliacao.map((r) => [r.ficha.stakeholderId, r.motivo])).toEqual([
      ["antiga", "metodologia_anterior"],
    ]);
  });

  test("revisão anual vencida continua no gráfico, marcada, e entra em “exigem reavaliação”", () => {
    const resultado = classificarParaMatriz(
      [ficha({ stakeholderId: "vencida", vigente: vigente("m2", { proximaRevisao: "2026-06-10" }) })],
      "m2",
      "2026-11-01",
    );
    expect(resultado.noGrafico[0].revisaoVencida).toBe(true);
    expect(resultado.exigemReavaliacao[0].motivo).toBe("revisao_vencida");
  });

  test("sem metodologia vigente, nenhuma pontuação vai para o gráfico", () => {
    const resultado = classificarParaMatriz([ficha({ stakeholderId: "a", vigente: vigente("m1") })], null, "2026-11-01");
    expect(resultado.noGrafico).toHaveLength(0);
    expect(resultado.metodologiaAnterior).toHaveLength(1);
  });

  test("V2.2: os dois níveis classificados vão para a grade; eixo “não avaliado” fica em lista própria; nunca vira Baixo (T17)", () => {
    const resultado = classificarParaMatriz(
      [
        ficha({ stakeholderId: "classificado", vigente: vigenteV22() }),
        ficha({ stakeholderId: "poder-nao-avaliado", vigente: vigenteV22({ nivelPoder: null }) }),
        ficha({ stakeholderId: "demonstracao", vigente: vigente("m1") }),
      ],
      "v22",
      "2026-11-01",
    );
    const ids = (lista: { stakeholderId: string }[]) => lista.map((f) => f.stakeholderId);
    expect(ids(resultado.noGrafico)).toEqual(["classificado"]);
    expect(ids(resultado.semPontuacao)).toEqual(["poder-nao-avaliado"]);
    expect(resultado.semPontuacao[0].vigente.nivelPoder).toBeNull();
    expect(ids(resultado.metodologiaAnterior)).toEqual(["demonstracao"]);
  });

  test("grade 3 × 3: quatro cantos nomeados, cinco células intermediárias e agrupamento por célula (T18)", () => {
    const celulas = NIVEIS.flatMap((p) => NIVEIS.map((i) => nomeDaCelula(p, i)));
    expect(celulas).toHaveLength(9);
    expect(nomeDaCelula("alto", "alto")).toBe("Alto poder / alto interesse");
    expect(nomeDaCelula("alto", "baixo")).toBe("Alto poder / baixo interesse");
    expect(nomeDaCelula("baixo", "alto")).toBe("Baixo poder / alto interesse");
    expect(nomeDaCelula("baixo", "baixo")).toBe("Baixo poder / baixo interesse");
    expect(nomeDaCelula("medio", "medio")).toBe("Zona intermediária central");
    expect(celulas.filter((c) => c === "Zona intermediária")).toHaveLength(4);

    const fichas = [
      ficha({ stakeholderId: "a", vigente: vigenteV22() }),
      ficha({ stakeholderId: "b", vigente: vigenteV22({ posicionamento: "contrario" }) }),
      ficha({ stakeholderId: "c", vigente: vigenteV22({ nivelPoder: "medio", nivelInteresse: "baixo" }) }),
    ] as FichaAvaliada[];
    const grupos = agruparPorCelula(fichas);
    expect(grupos.get("alto|alto")?.map((f) => f.stakeholderId)).toEqual(["a", "b"]);
    expect(grupos.get("medio|baixo")?.map((f) => f.stakeholderId)).toEqual(["c"]);
  });

  test("o posicionamento não altera os níveis de poder e interesse (T19)", () => {
    const [favoravel, contrario] = [vigenteV22({ posicionamento: "favoravel" }), vigenteV22({ posicionamento: "contrario" })];
    expect([favoravel.nivelPoder, favoravel.nivelInteresse]).toEqual([contrario.nivelPoder, contrario.nivelInteresse]);
    const grupos = agruparPorCelula([
      ficha({ stakeholderId: "f", vigente: favoravel }),
      ficha({ stakeholderId: "c", vigente: contrario }),
    ] as FichaAvaliada[]);
    expect(grupos.get("alto|alto")).toHaveLength(2);
  });
});

describe("Alertas orientativos (D-067)", () => {
  const SEM_ALERTA: DadosParaAlertas = {
    posicionamento: "favoravel",
    naturezaPosicionamento: "manifestacao_formal",
    origemPosicionamento: "Ofício fictício.",
    situacaoRessalvas: "nao_identificadas",
    descricaoRessalvas: null,
    justificativaPosicionamento: "Apoio formal fictício.",
    grauConfianca: "alto",
  };
  const codigos = (dados: Partial<DadosParaAlertas>) => calcularAlertas({ ...SEM_ALERTA, ...dados }).map((a) => a.codigo);

  test("avaliação consistente não gera alerta", () => {
    expect(codigos({})).toEqual([]);
  });

  test("cada condição detectável gera o alerta correspondente", () => {
    expect(codigos({ posicionamento: "neutro", naturezaPosicionamento: "percepcao_consultor", grauConfianca: "baixo" })).toEqual([
      "neutro_por_percepcao",
    ]);
    expect(codigos({ origemPosicionamento: " " })).toEqual(["origem_nao_informada"]);
    expect(codigos({ situacaoRessalvas: null })).toEqual(["ressalvas_com_manifestacao"]);
    expect(codigos({ situacaoRessalvas: "ha_ressalvas", descricaoRessalvas: null })).toEqual(["ressalvas_sem_descricao"]);
    expect(
      codigos({ posicionamento: null, naturezaPosicionamento: null, situacaoRessalvas: "informacao_insuficiente", justificativaPosicionamento: null }),
    ).toEqual(["indefinicao_sem_justificativa"]);
    expect(codigos({ naturezaPosicionamento: "informacao_informal" })).toEqual(["confianca_alta_nao_confirmada"]);
  });

  test("sem posicionamento nem ressalvas, não há alerta: “não avaliado” é escolha legítima", () => {
    expect(
      codigos({
        posicionamento: null,
        naturezaPosicionamento: null,
        origemPosicionamento: null,
        situacaoRessalvas: null,
        justificativaPosicionamento: null,
        grauConfianca: null,
      }),
    ).toEqual([]);
  });

  test("posicionamento sem manifestação formal é preliminar", () => {
    expect(posicionamentoPreliminar("favoravel", "informacao_informal")).toBe(true);
    expect(posicionamentoPreliminar("neutro", "percepcao_consultor")).toBe(true);
    expect(posicionamentoPreliminar("favoravel", "manifestacao_formal")).toBe(false);
    expect(posicionamentoPreliminar(null, "informacao_informal")).toBe(false);
  });
});

describe("Validação dos formulários", () => {
  test("posicionamento vazio é “não avaliado”; valores fora da lista são recusados", () => {
    expect(esquemaRascunho.parse({ versaoId: ID_VERSAO, posicionamento: "" }).posicionamento).toBeUndefined();
    expect(esquemaRascunho.safeParse({ versaoId: ID_VERSAO, posicionamento: "apoiador" }).success).toBe(false);
    expect(esquemaRascunho.safeParse({ versaoId: ID_VERSAO, grauConfianca: "altissimo" }).success).toBe(false);
  });

  test("notas do formulário: vazias ficam de fora; vírgula decimal é aceita", () => {
    const notas = notasDoFormulario({ [`nota_${C1}`]: "4", [`nota_${C2}`]: "", [`nota_${C3}`]: "2,5", outro: "x" });
    expect([...notas]).toEqual([
      [C1, 4],
      [C3, 2.5],
    ]);
    expect(() => notasDoFormulario({ nota_invalido: "3" })).toThrow();
  });

  test("campos da escala V2.2: vazio é “não avaliado” ou “não se aplica”; valores fora da lista são recusados", () => {
    const vazio = esquemaRascunho.parse({ versaoId: ID_VERSAO, nivelPoder: "", situacaoRessalvas: "", naturezaPosicionamento: "" });
    expect([vazio.nivelPoder, vazio.situacaoRessalvas, vazio.naturezaPosicionamento]).toEqual([undefined, undefined, undefined]);
    expect(esquemaRascunho.safeParse({ versaoId: ID_VERSAO, nivelPoder: "altissimo" }).success).toBe(false);
    expect(esquemaRascunho.safeParse({ versaoId: ID_VERSAO, naturezaPosicionamento: "boato" }).success).toBe(false);
    expect(esquemaRascunho.safeParse({ versaoId: ID_VERSAO, situacaoRessalvas: "talvez" }).success).toBe(false);
  });

  test("validação no servidor conforme a escala: parciais recusadas na V2.2 (T22); níveis só na escala ordinal", () => {
    const v22 = { poderInteresse: "ordinal_tres_niveis", posicionamento: "tres_categorias" } as const;
    const demonstracao = { poderInteresse: "demonstracao_numerica", posicionamento: "cinco_categorias" } as const;
    const dados = esquemaRascunho.parse({ versaoId: ID_VERSAO, posicionamento: "parcialmente_favoravel", nivelPoder: "medio" });
    expect(Object.keys(errosDaEscala(dados, v22))).toEqual(["posicionamento"]);
    expect(Object.keys(errosDaEscala(dados, demonstracao))).toEqual(["nivelPoder"]);
    expect(Object.keys(errosDaEscala(dados, { ...v22, poderInteresse: "binaria_historica" }))).toEqual([
      "posicionamento",
      "nivelPoder",
    ]);
    expect(errosDaEscala(esquemaRascunho.parse({ versaoId: ID_VERSAO, posicionamento: "neutro" }), v22)).toEqual({});
  });

  test("evidência do tipo link exige endereço http ou https", () => {
    const base = { versaoId: ID_VERSAO, tipo: "link", descricao: "Página fictícia" };
    expect(esquemaEvidencia.safeParse(base).success).toBe(false);
    expect(esquemaEvidencia.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(false);
    expect(esquemaEvidencia.safeParse({ ...base, url: "https://exemplo.org/noticia" }).success).toBe(true);
  });
});

test("a data de hoje é calculada no fuso de Brasília", () => {
  expect(hojeEmBrasilia(new Date("2026-11-01T02:30:00Z"))).toBe("2026-10-31");
});

test("pontuações são exibidas no padrão brasileiro", () => {
  expect(formatarNumero(87.5)).toBe("87,5");
  expect(formatarNumero(66.6667)).toBe("66,67");
  expect(formatarNumero(100)).toBe("100");
});

test("as listas da tela coincidem com as do banco de dados", () => {
  expect([...POSICIONAMENTOS]).toEqual(posicionamento.enumValues);
  expect([...GRAUS_CONFIANCA]).toEqual(grauConfianca.enumValues);
  expect([...TIPOS_EVIDENCIA]).toEqual(tipoEvidencia.enumValues);
  expect([...DIMENSOES]).toEqual(dimensaoCriterio.enumValues);
  expect([...SITUACOES_METODOLOGIA]).toEqual(situacaoMetodologia.enumValues);
  expect([...SITUACOES_VERSAO]).toEqual(situacaoVersaoAvaliacao.enumValues);
  expect([...PERFIS_CONTEXTO]).toEqual(perfilContexto.enumValues);
  expect([...NIVEIS]).toEqual(nivelAvaliacao.enumValues);
  expect([...SITUACOES_RESSALVAS]).toEqual(situacaoRessalvas.enumValues);
  expect([...NATUREZAS_POSICIONAMENTO]).toEqual(naturezaPosicionamento.enumValues);
  expect([...ESCALAS_PODER_INTERESSE]).toEqual(escalaPoderInteresse.enumValues);
  expect([...ESCALAS_POSICIONAMENTO]).toEqual(escalaPosicionamento.enumValues);
  expect([...NATUREZAS_ALTERACAO]).toEqual(naturezaAlteracao.enumValues);
  expect([...DIMENSOES_RUBRICA]).toEqual(dimensaoRubrica.enumValues);
  // As três categorias vigentes estão na lista do banco, que mantém as cinco por causa do histórico (T24).
  expect(POSICIONAMENTOS_VIGENTES.every((p) => posicionamento.enumValues.includes(p))).toBe(true);
});
