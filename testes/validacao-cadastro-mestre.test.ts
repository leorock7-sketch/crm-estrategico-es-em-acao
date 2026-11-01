import { describe, expect, test } from "vitest";
import {
  esferaInstituicao,
  naturezaInstituicao,
} from "@/lib/banco/esquema";
import { escaparLike, normalizarTexto } from "@/lib/texto";
import { cnpjValido, formatarCnpj, limparCnpj } from "@/lib/validacao/cnpj";
import {
  esquemaInstituicao,
  esquemaPessoa,
  esquemaVinculo,
} from "@/modulos/stakeholders/esquemas";
import { ESFERAS, NATUREZAS } from "@/modulos/stakeholders/rotulos";

const ID_PESSOA = "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const ID_INSTITUICAO = "7a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d";

function primeiroErro(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues[0]?.message;
}

describe("Normalização de texto", () => {
  test("remove acentos, pontuação e diferenças de maiúsculas", () => {
    expect(normalizarTexto("  Sônia  D'Ávila-Araújo ")).toBe("sonia d avila araujo");
  });

  test("protege caracteres especiais das buscas", () => {
    expect(escaparLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
});

describe("CNPJ", () => {
  test("valida CNPJ numérico", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
  });

  test("valida o CNPJ alfanumérico do exemplo da Receita Federal", () => {
    expect(cnpjValido("12.ABC.345/01DE-35")).toBe(true);
    expect(cnpjValido("12abc34501de35")).toBe(true);
    expect(cnpjValido("12.ABC.345/01DE-36")).toBe(false);
  });

  test("recusa sequências repetidas e tamanhos errados", () => {
    expect(cnpjValido("00.000.000/0000-00")).toBe(false);
    expect(cnpjValido("1122233300018")).toBe(false);
  });

  test("limpa e formata", () => {
    expect(limparCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("Formulário de pessoa", () => {
  test("aceita dados mínimos e trata campos vazios como ausentes", () => {
    const resultado = esquemaPessoa.parse({
      nomeCompleto: "  Ana Exemplo ",
      nomeTratamento: "",
      email: "",
      telefone: "  ",
      observacoes: "",
    });
    expect(resultado).toEqual({ nomeCompleto: "Ana Exemplo" });
  });

  test("exige o nome e valida o e-mail", () => {
    expect(primeiroErro(esquemaPessoa.safeParse({ nomeCompleto: "" }))).toBe("Nome completo é obrigatório.");
    expect(primeiroErro(esquemaPessoa.safeParse({ nomeCompleto: "Ana", email: "ana@" }))).toBe("E-mail inválido.");
  });
});

describe("Formulário de instituição", () => {
  test("normaliza o CNPJ e aceita campos opcionais vazios", () => {
    const resultado = esquemaInstituicao.parse({
      nome: "Porto Modelo S.A.",
      natureza: "empresa",
      esfera: "",
      cnpj: "12.abc.345/01de-35",
      uf: "",
      site: "",
      instituicaoSuperiorId: "",
    });
    expect(resultado).toEqual({ nome: "Porto Modelo S.A.", natureza: "empresa", cnpj: "12ABC34501DE35" });
  });

  test("recusa natureza ausente, CNPJ inválido e site que não seja http ou https", () => {
    expect(primeiroErro(esquemaInstituicao.safeParse({ nome: "X" }))).toBe("Selecione a natureza da instituição.");
    expect(primeiroErro(esquemaInstituicao.safeParse({ nome: "X", natureza: "empresa", cnpj: "11222333000182" }))).toContain(
      "CNPJ inválido",
    );
    expect(
      esquemaInstituicao.safeParse({ nome: "X", natureza: "empresa", site: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(esquemaInstituicao.safeParse({ nome: "X", natureza: "empresa", site: "https://exemplo.org" }).success).toBe(
      true,
    );
  });
});

describe("Formulário de vínculo", () => {
  test("converte a caixa de seleção e aceita datas coerentes", () => {
    const resultado = esquemaVinculo.parse({
      pessoaId: ID_PESSOA,
      instituicaoId: ID_INSTITUICAO,
      principal: "on",
      dataInicio: "2026-01-01",
      dataFim: "",
    });
    expect(resultado).toMatchObject({ principal: true, dataInicio: "2026-01-01" });
    expect(resultado.dataFim).toBeUndefined();
  });

  test("exige a instituição e recusa término anterior ao início", () => {
    expect(primeiroErro(esquemaVinculo.safeParse({ pessoaId: ID_PESSOA, instituicaoId: "" }))).toBe(
      "Selecione a instituição.",
    );
    const resultado = esquemaVinculo.safeParse({
      pessoaId: ID_PESSOA,
      instituicaoId: ID_INSTITUICAO,
      dataInicio: "2026-05-10",
      dataFim: "2026-05-01",
    });
    expect(primeiroErro(resultado)).toBe("O término não pode ser anterior ao início.");
  });
});

test("as listas da tela coincidem com as do banco de dados", () => {
  expect([...NATUREZAS]).toEqual(naturezaInstituicao.enumValues);
  expect([...ESFERAS]).toEqual(esferaInstituicao.enumValues);
});
