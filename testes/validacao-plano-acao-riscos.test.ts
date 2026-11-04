/**
 * Validações no servidor, listas e regras puras da Etapa 4 (Plano de Ação e
 * Matriz de Riscos), sem banco de dados: escalas e faixas da matriz 5 × 5,
 * atraso, códigos, comparação entre versões e entre inerente e residual.
 */
import { describe, expect, test } from "vitest";
import {
  decisaoPlano,
  estrategiaResposta,
  periodicidadeAcao,
  situacaoAcao,
  situacaoResposta,
  situacaoRisco,
  situacaoVersaoPlano,
  tipoAvaliacaoRisco,
} from "@/lib/banco/esquema";
import { type AcaoComparavel, diferencasEntreVersoes } from "@/modulos/plano-acao/diferencas";
import {
  esquemaAcaoPlanejada,
  esquemaAcompanhamentoAcao,
  esquemaDecisao,
  esquemaNovoPlano,
} from "@/modulos/plano-acao/esquemas";
import {
  acaoAtrasada,
  DECISOES_PLANO,
  marcoAtrasado,
  PERIODICIDADES,
  PILARES_REFERENCIA_INFRAESTRUTURA,
  proximoCodigo,
  SITUACOES_ACAO,
  SITUACOES_VERSAO_PLANO,
} from "@/modulos/plano-acao/rotulos";
import {
  type AvaliacaoResumo,
  avaliacaoVigente,
  compararInerenteResidual,
  distribuicaoNaMatriz,
  motivosReavaliacao,
  ultimasAvaliacoes,
} from "@/modulos/riscos/analise";
import { esquemaAvaliacao, esquemaNovoRisco, esquemaRegistroGatilho, esquemaResposta } from "@/modulos/riscos/esquemas";
import {
  CLASSIFICACOES,
  classificar,
  criticidade,
  ESTRATEGIAS_RESPOSTA,
  FAIXAS,
  IMPACTOS,
  NIVEIS_5,
  PROBABILIDADES,
  SITUACOES_RESPOSTA,
  SITUACOES_RISCO,
  TIPOS_AVALIACAO,
} from "@/modulos/riscos/rotulos";

const ID_A = "0b1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const ID_B = "1b1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";

function errosDe(resultado: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const erros: Record<string, string> = {};
  for (const issue of resultado.error?.issues ?? []) {
    const campo = String(issue.path[0] ?? "");
    erros[campo] ??= issue.message;
  }
  return erros;
}

test("as listas das telas coincidem com as do banco", () => {
  expect([...SITUACOES_VERSAO_PLANO]).toEqual(situacaoVersaoPlano.enumValues);
  expect([...DECISOES_PLANO]).toEqual(decisaoPlano.enumValues);
  expect([...PERIODICIDADES]).toEqual(periodicidadeAcao.enumValues);
  expect([...SITUACOES_ACAO]).toEqual(situacaoAcao.enumValues);
  expect([...SITUACOES_RISCO]).toEqual(situacaoRisco.enumValues);
  expect([...TIPOS_AVALIACAO]).toEqual(tipoAvaliacaoRisco.enumValues);
  expect([...ESTRATEGIAS_RESPOSTA]).toEqual(estrategiaResposta.enumValues);
  expect([...SITUACOES_RESPOSTA]).toEqual(situacaoResposta.enumValues);
});

describe("Matriz 5 × 5 do Comitê de Infraestrutura (parâmetros do instrumento original)", () => {
  test("escalas de 1 a 5 com os rótulos originais", () => {
    expect(NIVEIS_5.map((n) => PROBABILIDADES[n].rotulo)).toEqual(["Remota", "Baixa", "Média", "Alta", "Muito alta"]);
    expect(NIVEIS_5.map((n) => IMPACTOS[n].rotulo)).toEqual(["Muito baixo", "Baixo", "Médio", "Alto", "Muito alto"]);
  });

  test("faixas contínuas de 1 a 25, com as cores e as prioridades de tratamento originais", () => {
    expect(CLASSIFICACOES.map((c) => [FAIXAS[c].minimo, FAIXAS[c].maximo])).toEqual([
      [1, 4],
      [5, 9],
      [10, 16],
      [17, 25],
    ]);
    expect(CLASSIFICACOES.map((c) => FAIXAS[c].cor)).toEqual(["#E2F0D9", "#FFF2CC", "#FCE4D6", "#F4CCCC"]);
    expect(FAIXAS.critico.prioridade).toBe("Escalonar imediatamente");
  });

  test("criticidade = P × I e classificação de todas as 25 células", () => {
    const contagem: Record<string, number> = { baixo: 0, moderado: 0, alto: 0, critico: 0 };
    for (const p of NIVEIS_5) for (const i of NIVEIS_5) contagem[classificar(criticidade(p, i))]++;
    // Células por faixa: 8 baixas, 7 moderadas, 7 altas e 3 críticas (20, 20 e 25).
    expect(contagem).toEqual({ baixo: 8, moderado: 7, alto: 7, critico: 3 });
    expect(classificar(criticidade(4, 4))).toBe("alto");
    expect(classificar(criticidade(4, 5))).toBe("critico");
  });
});

describe("Riscos: inerente, residual e reavaliação", () => {
  const avaliacao = (tipo: "inerente" | "residual", data: string, p: number, i: number, criadoEm = `${data}T12:00:00Z`): AvaliacaoResumo => ({
    tipo,
    dataAvaliacao: data,
    probabilidade: p,
    impacto: i,
    criticidade: p * i,
    classificacao: classificar(p * i),
    criadoEm,
  });

  test("a vigente é a residual mais recente; sem residual, a inerente — nunca uma redução automática", () => {
    const inerente = avaliacao("inerente", "2026-10-01", 4, 5);
    expect(avaliacaoVigente(ultimasAvaliacoes([inerente]))).toBe(inerente);
    const residual = avaliacao("residual", "2026-10-20", 2, 4);
    const ultimas = ultimasAvaliacoes([inerente, residual, avaliacao("residual", "2026-10-10", 3, 4)]);
    expect(ultimas.residual).toBe(residual);
    expect(avaliacaoVigente(ultimas)).toBe(residual);
  });

  test("comparação em pontos do índice e na faixa, sem percentual", () => {
    const comparacao = compararInerenteResidual(avaliacao("inerente", "2026-10-01", 4, 5), avaliacao("residual", "2026-10-20", 2, 4));
    expect(comparacao).toEqual({ variacaoIndice: -12, mudouClassificacao: true });
    expect(compararInerenteResidual(avaliacao("inerente", "2026-10-01", 4, 5), null)).toBeNull();
  });

  test("gatilho ocorrido depois da última avaliação e revisão vencida sinalizam reavaliação", () => {
    const base = { ultimaAvaliacaoEm: "2026-10-20", gatilhosOcorridosEm: [] as string[], proximaRevisao: null, hoje: "2026-11-03" };
    expect(motivosReavaliacao(base)).toEqual([]);
    expect(motivosReavaliacao({ ...base, gatilhosOcorridosEm: ["2026-10-10"] })).toEqual([]);
    expect(motivosReavaliacao({ ...base, gatilhosOcorridosEm: ["2026-10-25"] })).toEqual(["Gatilho ocorrido depois da última avaliação."]);
    expect(motivosReavaliacao({ ...base, proximaRevisao: "2026-11-01" })).toEqual(["Data de revisão vencida."]);
  });

  test("distribuição na matriz conta os riscos por célula", () => {
    const quantidade = distribuicaoNaMatriz([{ probabilidade: 4, impacto: 5 }, { probabilidade: 4, impacto: 5 }, null, { probabilidade: 1, impacto: 1 }]);
    expect(quantidade(4, 5)).toBe(2);
    expect(quantidade(1, 1)).toBe(1);
    expect(quantidade(3, 3)).toBe(0);
  });

  test("novo risco exige a avaliação inerente completa e fundamentada", () => {
    const resultado = esquemaNovoRisco.safeParse({ projetoTemaId: ID_A, titulo: "Risco fictício", situacao: "aberto", dataAvaliacao: "2026-11-03" });
    expect(resultado.success).toBe(false);
    expect(errosDe(resultado)).toMatchObject({
      probabilidade: "Selecione a probabilidade.",
      impacto: "Selecione o impacto.",
      justificativa: expect.any(String),
      avaliadoPor: "Selecione o responsável pela avaliação.",
    });
    const valido = esquemaNovoRisco.safeParse({
      projetoTemaId: ID_A,
      titulo: "Risco fictício",
      situacao: "aberto",
      dataAvaliacao: "2026-11-03",
      probabilidade: "4",
      impacto: "5",
      justificativa: "Exemplo fictício.",
      avaliadoPor: ID_B,
    });
    expect(valido.success && valido.data.probabilidade * valido.data.impacto).toBe(20);
  });

  test("avaliação fora da escala, gatilho sem resposta e medida sem estratégia são recusados", () => {
    expect(
      errosDe(esquemaAvaliacao.safeParse({ riscoId: ID_A, tipo: "residual", dataAvaliacao: "2026-11-03", probabilidade: "6", impacto: "0", justificativa: "x", avaliadoPor: ID_B })),
    ).toMatchObject({ probabilidade: "Selecione a probabilidade.", impacto: "Selecione o impacto." });
    expect(errosDe(esquemaRegistroGatilho.safeParse({ gatilhoId: ID_A, data: "2026-11-03" }))).toMatchObject({ ocorrido: "Indique se o gatilho ocorreu." });
    expect(errosDe(esquemaResposta.safeParse({ riscoId: ID_A, descricao: "Medida", situacao: "planejada" }))).toMatchObject({
      estrategia: "Selecione a estratégia.",
    });
  });
});

describe("Plano de Ação: validações e regras", () => {
  test("pilares de referência do Comitê de Infraestrutura (modelo opcional)", () => {
    expect(PILARES_REFERENCIA_INFRAESTRUTURA.map((p) => p.codigo)).toEqual(["P1", "P2", "P3", "P4", "P5"]);
    const semPilares = esquemaNovoPlano.safeParse({ projetoTemaId: ID_A, titulo: "Plano" });
    expect(semPilares.success && semPilares.data.usarPilaresReferencia).toBe(false);
    const comPilares = esquemaNovoPlano.safeParse({ projetoTemaId: ID_A, titulo: "Plano", usarPilaresReferencia: "sim" });
    expect(comPilares.success && comPilares.data.usarPilaresReferencia).toBe(true);
  });

  test("ação planejada exige responsável e datas coerentes", () => {
    expect(errosDe(esquemaAcaoPlanejada.safeParse({ versaoId: ID_A, titulo: "Ação" }))).toMatchObject({
      responsavelUsuarioId: "Indique o responsável, da equipe ou externo.",
    });
    expect(
      errosDe(esquemaAcaoPlanejada.safeParse({ versaoId: ID_A, titulo: "Ação", responsavelStakeholderId: ID_B, inicioPrevisto: "2026-11-10", fimPrevisto: "2026-11-01" })),
    ).toMatchObject({ fimPrevisto: "O fim previsto não pode ser anterior ao início." });
  });

  test("acompanhamento: percentual opcional (0 a 100) e marco com indicação de alcance", () => {
    expect(esquemaAcompanhamentoAcao.safeParse({ acaoId: ID_A, data: "2026-11-03", observacao: "Só observação." }).success).toBe(true);
    expect(errosDe(esquemaAcompanhamentoAcao.safeParse({ acaoId: ID_A, data: "2026-11-03" }))).toMatchObject({
      observacao: "Informe a situação, o percentual, uma observação ou o marco.",
    });
    expect(errosDe(esquemaAcompanhamentoAcao.safeParse({ acaoId: ID_A, data: "2026-11-03", percentual: "120" }))).toMatchObject({
      percentual: "Use de 0 a 100.",
    });
    expect(errosDe(esquemaAcompanhamentoAcao.safeParse({ acaoId: ID_A, data: "2026-11-03", marcoId: ID_B }))).toMatchObject({
      marcoAlcancado: "Indique se o marco foi alcançado.",
    });
  });

  test("decisão: aprovar, devolver ou rejeitar, com parecer opcional", () => {
    expect(esquemaDecisao.safeParse({ versaoId: ID_A, decisao: "aprovada" }).success).toBe(true);
    expect(errosDe(esquemaDecisao.safeParse({ versaoId: ID_A, decisao: "enviada" }))).toMatchObject({ decisao: "Selecione a decisão." });
  });

  test("atraso de ações e marcos; códigos sequenciais permanentes", () => {
    expect(acaoAtrasada(null, "2026-11-01", "2026-11-03")).toBe(true);
    expect(acaoAtrasada("em_andamento", "2026-11-03", "2026-11-03")).toBe(false);
    expect(acaoAtrasada("concluida", "2026-10-01", "2026-11-03")).toBe(false);
    expect(acaoAtrasada("cancelada", "2026-10-01", "2026-11-03")).toBe(false);
    expect(acaoAtrasada("suspensa", null, "2026-11-03")).toBe(false);
    expect(marcoAtrasado(false, "2026-11-01", "2026-11-03")).toBe(true);
    expect(marcoAtrasado(true, "2026-11-01", "2026-11-03")).toBe(false);
    expect(proximoCodigo([], "A-", 2)).toBe("A-01");
    expect(proximoCodigo(["A-01", "A-03"], "A-", 2)).toBe("A-04");
    expect(proximoCodigo(["M1", "M2", "X9"], "M", 1)).toBe("M3");
  });

  test("comparação entre versões: incluídas, retiradas e alteradas campo a campo, inclusive marcos", () => {
    const base: AcaoComparavel = {
      acaoId: "a1",
      codigo: "A-01",
      titulo: "Ação fictícia",
      eixoCodigo: "P1",
      eixoNome: "Institucional / Governança",
      descricao: null,
      justificativa: null,
      responsavelUsuarioNome: "Equipe Um",
      responsavelStakeholderNome: null,
      inicioPrevisto: null,
      fimPrevisto: "2026-12-01",
      periodicidade: null,
      iniciativaTitulo: null,
      marcos: [
        { marcoId: "m1", codigo: "M1", descricao: "Marco fictício", prazoPrevisto: "2026-11-15" },
        { marcoId: "m2", codigo: "M2", descricao: "Outro marco", prazoPrevisto: null },
      ],
    };
    const alterada: AcaoComparavel = {
      ...base,
      fimPrevisto: "2026-12-20",
      marcos: [{ ...base.marcos[0], prazoPrevisto: "2026-11-30" }, { marcoId: "m3", codigo: "M3", descricao: "Marco novo", prazoPrevisto: null }],
    };
    const retirada: AcaoComparavel = { ...base, acaoId: "a2", codigo: "A-02", titulo: "Ação retirada", marcos: [] };
    const incluida: AcaoComparavel = { ...base, acaoId: "a3", codigo: "A-03", titulo: "Ação nova", marcos: [] };
    const diferencas = diferencasEntreVersoes([base, retirada], [alterada, incluida]);
    expect(diferencas.map((d) => [d.tipo, d.codigo])).toEqual([
      ["alterada", "A-01"],
      ["retirada", "A-02"],
      ["incluida", "A-03"],
    ]);
    const primeira = diferencas[0];
    expect(primeira.tipo === "alterada" && primeira.alteracoes.map((a) => a.campo)).toEqual(["Fim previsto", "Marco M1", "Marco M3 incluído", "Marco M2 retirado"]);
    expect(diferencasEntreVersoes([base], [base])).toEqual([]);
  });
});
