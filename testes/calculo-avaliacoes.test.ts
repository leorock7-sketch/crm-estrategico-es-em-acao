import { describe, expect, test } from "vitest";
import {
  dimensaoCriterio,
  grauConfianca,
  perfilContexto,
  posicionamento,
  situacaoMetodologia,
  situacaoVersaoAvaliacao,
  tipoEvidencia,
} from "@/lib/banco/esquema";
import { formatarNumero, hojeEmBrasilia } from "@/lib/formatacao";
import { calcularDimensao, calcularResultado, tendenciaDoPosicionamento } from "@/modulos/avaliacoes/calculo";
import { esquemaEvidencia, esquemaRascunho, notasDoFormulario } from "@/modulos/avaliacoes/esquemas";
import { classificarParaMatriz, type FichaParaMatriz } from "@/modulos/avaliacoes/matriz";
import {
  DIMENSOES,
  GRAUS_CONFIANCA,
  PERFIS_CONTEXTO,
  POSICIONAMENTOS,
  SITUACOES_METODOLOGIA,
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
});

function ficha(parcial: Partial<FichaParaMatriz> & { stakeholderId: string }): FichaParaMatriz {
  return { nome: parcial.stakeholderId, tipoStakeholder: "pessoa", associado: true, temRascunho: false, vigente: null, ...parcial };
}

const vigente = (metodologiaId: string | null, extra: Partial<NonNullable<FichaParaMatriz["vigente"]>> = {}) => ({
  numeroVersao: 1,
  metodologiaId,
  metodologiaNome: metodologiaId,
  poder: 50,
  interesse: 50,
  posicionamento: null,
  grauConfianca: null,
  dataReferencia: "2026-10-01",
  proximaRevisao: "2027-10-01",
  ...extra,
});

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
});
