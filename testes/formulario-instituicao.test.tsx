import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

// A ação do servidor é substituída por uma simulação que recusa o CNPJ.
vi.mock("@/modulos/stakeholders/acoes", () => ({
  salvarInstituicao: vi.fn(async (_estado: unknown, formData: FormData) => ({
    erros: { cnpj: ["CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores."] },
    valores: Object.fromEntries(
      [...formData.entries()].filter(([campo]) => !campo.startsWith("$")),
    ) as Record<string, string>,
  })),
}));

const { FormularioInstituicao } = await import(
  "@/modulos/stakeholders/componentes/formulario-instituicao"
);

afterEach(cleanup);

const SUPERIOR = { id: "7a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d", nome: "Governo Exemplo", sigla: null };

test("após um erro, mantém o texto digitado e as opções escolhidas nas listas", async () => {
  render(<FormularioInstituicao opcoesSuperior={[SUPERIOR]} />);
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Cooperativa Exemplo" } });
  fireEvent.change(screen.getByLabelText(/^Natureza/), { target: { value: "empresa" } });
  fireEvent.change(screen.getByLabelText("UF"), { target: { value: "ES" } });
  fireEvent.change(screen.getByLabelText("Instituição superior"), { target: { value: SUPERIOR.id } });
  fireEvent.change(screen.getByLabelText("CNPJ"), { target: { value: "11.222.333/0001-82" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

  expect(await screen.findByText(/CNPJ inválido/)).toBeDefined();
  expect(screen.getByLabelText(/^Nome/)).toHaveProperty("value", "Cooperativa Exemplo");
  expect(screen.getByLabelText(/^Natureza/)).toHaveProperty("value", "empresa");
  expect(screen.getByLabelText("UF")).toHaveProperty("value", "ES");
  expect(screen.getByLabelText("Instituição superior")).toHaveProperty("value", SUPERIOR.id);
  expect(screen.getByLabelText("CNPJ")).toHaveProperty("value", "11.222.333/0001-82");
});
