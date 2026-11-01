import { describe, expect, test } from "vitest";
import {
  esquemaEmailOpcional,
  esquemaIdentificador,
  textoObrigatorio,
} from "@/lib/validacao/comuns";

describe("Texto obrigatório", () => {
  const nome = textoObrigatorio("Nome", 20);

  test("remove espaços nas pontas", () => {
    expect(nome.parse("  Maria Exemplo  ")).toBe("Maria Exemplo");
  });

  test("recusa valor vazio ou só com espaços, com mensagem em português", () => {
    for (const valor of ["", "   "]) {
      const resultado = nome.safeParse(valor);
      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.message).toBe("Nome é obrigatório.");
    }
  });

  test("recusa texto acima do tamanho máximo", () => {
    const resultado = nome.safeParse("x".repeat(21));
    expect(resultado.error?.issues[0]?.message).toBe(
      "Nome deve ter no máximo 20 caracteres.",
    );
  });
});

describe("E-mail opcional", () => {
  test("aceita campo vazio ou ausente", () => {
    expect(esquemaEmailOpcional.parse("")).toBeUndefined();
    expect(esquemaEmailOpcional.parse(undefined)).toBeUndefined();
  });

  test("aceita e-mail válido", () => {
    expect(esquemaEmailOpcional.parse("contato@exemplo.org")).toBe(
      "contato@exemplo.org",
    );
  });

  test("recusa e-mail inválido, com mensagem em português", () => {
    const resultado = esquemaEmailOpcional.safeParse("contato-sem-arroba");
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("E-mail inválido.");
  });
});

describe("Identificador", () => {
  test("aceita UUID válido e recusa texto qualquer", () => {
    expect(esquemaIdentificador.safeParse(crypto.randomUUID()).success).toBe(true);
    expect(esquemaIdentificador.safeParse("123").success).toBe(false);
  });
});
