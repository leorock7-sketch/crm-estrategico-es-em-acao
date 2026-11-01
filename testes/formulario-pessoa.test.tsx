import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

// A ação do servidor é substituída por uma simulação que aponta possível duplicidade.
vi.mock("@/modulos/stakeholders/acoes", () => ({
  salvarPessoa: vi.fn(async (_estado: unknown, formData: FormData) => ({
    duplicidades: [
      { id: "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b", nome: "Ana Exemplo Souza", motivo: "Nome semelhante", arquivado: false },
    ],
    valores: { nomeCompleto: String(formData.get("nomeCompleto")) },
  })),
}));

const { FormularioPessoa } = await import("@/modulos/stakeholders/componentes/formulario-pessoa");

afterEach(cleanup);

describe("Formulário de pessoa", () => {
  test("apresenta os campos do cadastro mínimo, com o nome obrigatório", () => {
    render(<FormularioPessoa />);
    expect(screen.getByLabelText(/Nome completo/)).toHaveProperty("required", true);
    for (const rotulo of ["Nome de tratamento", "E-mail", "Telefone", "Observações"]) {
      expect(screen.getByLabelText(rotulo)).toBeDefined();
    }
    expect(screen.queryByLabelText(/CPF/)).toBeNull();
  });

  test("ao detectar possível duplicidade, exige confirmação e mantém o que foi digitado", async () => {
    render(<FormularioPessoa />);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: "Ana Souza" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Possível cadastro repetido")).toBeDefined();
    expect(screen.getByRole("link", { name: "Ana Exemplo Souza" })).toBeDefined();
    expect(screen.getByLabelText(/confirmo que não se trata do mesmo registro/)).toHaveProperty("required", true);
    expect(screen.getByRole("button", { name: "Salvar mesmo assim" })).toBeDefined();
    expect(screen.getByLabelText(/Nome completo/)).toHaveProperty("value", "Ana Souza");
  });
});
