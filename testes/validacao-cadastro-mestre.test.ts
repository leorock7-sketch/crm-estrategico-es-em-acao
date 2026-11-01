import { describe, expect, test } from "vitest";
import {
  esferaInstituicao,
  naturezaContato,
  naturezaInstituicao,
  tipoContato,
} from "@/lib/banco/esquema";
import { escaparLike, normalizarTexto } from "@/lib/texto";
import { cnpjValido, formatarCnpj, limparCnpj } from "@/lib/validacao/cnpj";
import { normalizarContato } from "@/modulos/stakeholders/contatos";
import {
  esquemaContato,
  esquemaInstituicao,
  esquemaPessoa,
  esquemaVinculo,
} from "@/modulos/stakeholders/esquemas";
import { CODIGOS_PAISES, nomePais, opcoesPaises } from "@/modulos/stakeholders/paises";
import { ESFERAS, NATUREZAS, NATUREZAS_CONTATO, TIPOS_CONTATO } from "@/modulos/stakeholders/rotulos";

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
    const resultado = esquemaPessoa.parse({ nomeCompleto: "  Ana Exemplo ", nomeTratamento: "", observacoes: "" });
    expect(resultado).toEqual({ nomeCompleto: "Ana Exemplo" });
  });

  test("exige o nome; e-mail e telefone não fazem mais parte do cadastro da pessoa (D-025)", () => {
    expect(primeiroErro(esquemaPessoa.safeParse({ nomeCompleto: "" }))).toBe("Nome completo é obrigatório.");
    expect(esquemaPessoa.parse({ nomeCompleto: "Ana", email: "ana@exemplo.org" })).toEqual({ nomeCompleto: "Ana" });
  });
});

describe("Formulário de instituição", () => {
  const brasileira = { nome: "Porto Modelo S.A.", natureza: "empresa", uf: "ES" };

  test("normaliza o CNPJ, usa o Brasil como país padrão e aceita campos opcionais vazios", () => {
    const resultado = esquemaInstituicao.parse({
      ...brasileira,
      esfera: "",
      pais: "",
      cnpj: "12.abc.345/01de-35",
      site: "",
      instituicaoSuperiorId: "",
    });
    expect(resultado).toEqual({ ...brasileira, cnpj: "12ABC34501DE35" });
  });

  test("recusa natureza ausente, CNPJ inválido e site que não seja http ou https", () => {
    expect(primeiroErro(esquemaInstituicao.safeParse({ nome: "X" }))).toBe("Selecione a natureza da instituição.");
    expect(primeiroErro(esquemaInstituicao.safeParse({ ...brasileira, cnpj: "11222333000182" }))).toContain("CNPJ inválido");
    expect(esquemaInstituicao.safeParse({ ...brasileira, site: "javascript:alert(1)" }).success).toBe(false);
    expect(esquemaInstituicao.safeParse({ ...brasileira, site: "https://exemplo.org" }).success).toBe(true);
  });

  test("UF obrigatória para instituições do Brasil; UF e CNPJ recusados para as estrangeiras", () => {
    expect(primeiroErro(esquemaInstituicao.safeParse({ nome: "X", natureza: "empresa" }))).toBe("Informe a UF.");
    expect(esquemaInstituicao.parse({ nome: "Agency", natureza: "orgao_publico", pais: "PT" })).toMatchObject({ pais: "PT" });
    expect(primeiroErro(esquemaInstituicao.safeParse({ nome: "Agency", natureza: "orgao_publico", pais: "PT", uf: "ES" }))).toBe(
      "A UF só se aplica a instituições do Brasil.",
    );
    expect(
      primeiroErro(esquemaInstituicao.safeParse({ nome: "Agency", natureza: "orgao_publico", pais: "PT", cnpj: "11222333000181" })),
    ).toBe("O CNPJ só se aplica a instituições do Brasil.");
    expect(primeiroErro(esquemaInstituicao.safeParse({ nome: "X", natureza: "empresa", pais: "XX" }))).toBe("País inválido.");
  });
});

describe("Países", () => {
  test("lista os 249 códigos ISO 3166-1, todos com nome em português, com o Brasil primeiro", () => {
    expect(CODIGOS_PAISES).toHaveLength(249);
    expect(new Set(CODIGOS_PAISES).size).toBe(249);
    const semNome = CODIGOS_PAISES.filter((codigo) => nomePais(codigo) === codigo);
    expect(semNome).toEqual([]);
    expect(opcoesPaises()[0]).toEqual({ codigo: "BR", nome: "Brasil" });
    expect(nomePais("PT")).toBe("Portugal");
  });
});

describe("Contatos (D-025)", () => {
  const base = { stakeholderId: ID_PESSOA, natureza: "funcional" };

  test("normaliza para comparar: e-mail em minúsculas, telefone só com dígitos", () => {
    expect(normalizarContato("email", " Gabinete@Exemplo.ORG ")).toBe("gabinete@exemplo.org");
    expect(normalizarContato("telefone", "(27) 90000-0001")).toBe("27900000001");
    expect(normalizarContato("site", "https://Exemplo.org/")).toBe("https://exemplo.org");
  });

  test("valida o valor conforme o tipo, com mensagens em português", () => {
    expect(primeiroErro(esquemaContato.safeParse({ ...base, tipo: "email", valor: "gabinete@" }))).toBe("E-mail inválido.");
    expect(primeiroErro(esquemaContato.safeParse({ ...base, tipo: "telefone", valor: "1234" }))).toContain("Telefone inválido");
    expect(primeiroErro(esquemaContato.safeParse({ ...base, tipo: "site", valor: "javascript:alert(1)" }))).toContain("Site inválido");
    expect(primeiroErro(esquemaContato.safeParse({ ...base, tipo: "email", valor: "" }))).toBe("Informe o contato.");
  });

  test("aceita contato válido, com vínculo opcional e caixa de seleção de principal", () => {
    const resultado = esquemaContato.parse({
      ...base,
      tipo: "email",
      valor: " gabinete@exemplo.org ",
      vinculoId: "",
      principal: "on",
      dataInicio: "",
    });
    expect(resultado).toEqual({ ...base, tipo: "email", valor: "gabinete@exemplo.org", principal: true });
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
  expect([...TIPOS_CONTATO]).toEqual(tipoContato.enumValues);
  expect([...NATUREZAS_CONTATO]).toEqual(naturezaContato.enumValues);
});
