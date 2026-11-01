import { describe, expect, test } from "vitest";
import { descreverPeriodo, formatarData, formatarDataHora } from "@/lib/formatacao";
import {
  identificacaoInstituicaoMudou,
  identificacaoPessoaMudou,
} from "@/modulos/stakeholders/duplicidade";
import { alteracoesEntre, formatarValor } from "@/modulos/stakeholders/historico";

describe("Descrição do histórico", () => {
  test("lista apenas os campos que mudaram, com nomes legíveis", () => {
    const antes = { id: "x", nome_completo: "Ana Exemplo", telefone: null, atualizado_em: "a" };
    const depois = { id: "x", nome_completo: "Ana Exemplo", telefone: "(27) 90000-0001", atualizado_em: "b" };
    expect(alteracoesEntre(antes, depois)).toEqual([
      { campo: "telefone", rotulo: "Telefone", antes: "—", depois: "(27) 90000-0001" },
    ]);
  });

  test("na inclusão, mostra os campos preenchidos e omite os técnicos", () => {
    const alteracoes = alteracoesEntre(null, {
      id: "x",
      nome_normalizado: "porto modelo",
      criado_por: "u",
      nome: "Porto Modelo",
      natureza: "empresa",
      sigla: null,
    });
    expect(alteracoes.map((a) => [a.rotulo, a.depois])).toEqual([
      ["Nome", "Porto Modelo"],
      ["Natureza", "Empresa"],
    ]);
  });

  test("troca identificadores por nomes e formata datas, CNPJ e valores lógicos", () => {
    const nomes = new Map([["id-1", "Secretaria Exemplo"]]);
    expect(formatarValor("instituicao_id", "id-1", nomes)).toBe("Secretaria Exemplo");
    expect(formatarValor("instituicao_id", "id-2", nomes)).toBe("registro não identificado");
    expect(formatarValor("data_inicio", "2026-02-01", nomes)).toBe("01/02/2026");
    expect(formatarValor("cnpj", "12ABC34501DE35", nomes)).toBe("12.ABC.345/01DE-35");
    expect(formatarValor("principal", true, nomes)).toBe("Sim");
  });
});

describe("Formatação de datas", () => {
  test("data simples e data e hora no fuso de Brasília", () => {
    expect(formatarData("2026-10-31")).toBe("31/10/2026");
    expect(formatarData(null)).toBe("—");
    expect(formatarDataHora("2026-11-01T00:30:00Z")).toBe("31/10/2026, 21:30");
  });

  test("descreve o período de um vínculo com ou sem datas", () => {
    expect(descreverPeriodo("2025-02-01", "2026-10-31")).toBe("De 01/02/2025 até 31/10/2026");
    expect(descreverPeriodo("2025-02-01", null)).toBe("Desde 01/02/2025");
    expect(descreverPeriodo(null, "2026-10-31")).toBe("Até 31/10/2026");
    expect(descreverPeriodo(null, null)).toBe("Período não informado");
  });
});

describe("Verificação de duplicidade na edição", () => {
  const pessoaAtual = { nomeNormalizado: "ana souza", email: "ana@exemplo.org" };

  test("pessoa: só verifica de novo se o nome ou o e-mail mudarem", () => {
    expect(identificacaoPessoaMudou(pessoaAtual, { nomeCompleto: "Ana Souza", email: "ANA@exemplo.org" })).toBe(false);
    expect(identificacaoPessoaMudou(pessoaAtual, { nomeCompleto: "Ana Souza Lima", email: "ana@exemplo.org" })).toBe(true);
    expect(identificacaoPessoaMudou(pessoaAtual, { nomeCompleto: "Ana Souza" })).toBe(true);
  });

  test("instituição: só verifica de novo se o nome, a sigla ou o CNPJ mudarem", () => {
    const atual = { nomeNormalizado: "porto modelo s a", sigla: "PMSA", cnpj: null };
    expect(identificacaoInstituicaoMudou(atual, { nome: "Porto Modelo S.A.", sigla: "pmsa" })).toBe(false);
    expect(identificacaoInstituicaoMudou(atual, { nome: "Porto Modelo S.A.", sigla: "PMSA", cnpj: "11222333000181" })).toBe(true);
  });
});
