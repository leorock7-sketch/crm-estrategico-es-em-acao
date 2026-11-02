import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

// As ações do servidor são substituídas por simulações: o cadastro devolve um
// alerta de nome parecido e a associação recusa a relação repetida.
vi.mock("@/modulos/projetos-temas/acoes", () => {
  const valores = (formData: FormData) =>
    Object.fromEntries([...formData.entries()].filter(([campo]) => !campo.startsWith("$"))) as Record<
      string,
      string
    >;
  return {
    salvarProjetoTema: vi.fn(async (_estado: unknown, formData: FormData) => ({
      duplicidades: [
        { id: "9b1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b", nome: "Porto Exemplo (Infraestrutura)", motivo: "Mesmo nome", arquivado: false },
      ],
      valores: valores(formData),
    })),
    salvarAssociacao: vi.fn(async (_estado: unknown, formData: FormData) => ({
      mensagem: "Este stakeholder já está associado a este projeto ou tema com o mesmo tipo de relação.",
      valores: valores(formData),
    })),
  };
});

const { FormularioProjetoTema } = await import("@/modulos/projetos-temas/componentes/formulario-projeto-tema");
const { FormularioAssociacao } = await import("@/modulos/projetos-temas/componentes/formulario-associacao");

afterEach(cleanup);

const COMITE = { id: "0c000000-0000-4000-8000-000000000002", nome: "Comitê Temático de Infraestrutura" };
const PROJETO = "5e1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const PESSOA = { id: "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b", nome: "Ana Exemplo Souza" };
const INSTITUICAO = { id: "7a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d", nome: "Porto Modelo S.A." };

test("nome parecido exige confirmação e mantém as opções escolhidas", async () => {
  render(<FormularioProjetoTema opcoesComites={[COMITE]} />);
  fireEvent.change(screen.getByLabelText(/^Tipo/), { target: { value: "projeto" } });
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Porto Exemplo" } });
  fireEvent.change(screen.getByLabelText(/^Comitê principal/), { target: { value: COMITE.id } });
  fireEvent.change(screen.getByLabelText(/^Situação/), { target: { value: "ativo" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

  expect(await screen.findByText("Possível projeto ou tema repetido")).toBeDefined();
  expect(screen.getByRole("link", { name: "Porto Exemplo (Infraestrutura)" }).getAttribute("href")).toBe(
    "/projetos-temas/9b1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
  );
  expect(screen.getByLabelText(/Conferi e confirmo/)).toHaveProperty("required", true);
  expect(screen.getByRole("button", { name: "Salvar mesmo assim" })).toBeDefined();
  expect(screen.getByLabelText(/^Tipo/)).toHaveProperty("value", "projeto");
  expect(screen.getByLabelText(/^Comitê principal/)).toHaveProperty("value", COMITE.id);
  expect(screen.getByLabelText(/^Situação/)).toHaveProperty("value", "ativo");
});

test("a associação oferece pessoas e instituições e só tipos de relação neutros", async () => {
  render(<FormularioAssociacao projetoTemaId={PROJETO} pessoas={[PESSOA]} instituicoes={[INSTITUICAO]} />);

  const tipos = [...(screen.getByLabelText(/^Tipo de relação/) as HTMLSelectElement).options].map((o) => o.text);
  expect(tipos).toEqual([
    "Selecione…",
    "Órgão competente ou regulador",
    "Parceiro",
    "Financiador ou investidor",
    "Executor",
    "Beneficiário ou afetado",
    "Representação setorial",
    "Outro",
  ]);
  expect(screen.queryByText(/poder|interesse/i)).toBeNull();

  fireEvent.change(screen.getByLabelText(/^Pessoa ou instituição/), { target: { value: PESSOA.id } });
  fireEvent.change(screen.getByLabelText(/^Tipo de relação/), { target: { value: "parceiro" } });
  fireEvent.click(screen.getByRole("button", { name: "Associar stakeholder" }));

  expect(await screen.findByText(/já está associado/)).toBeDefined();
  expect(screen.getByLabelText(/^Pessoa ou instituição/)).toHaveProperty("value", PESSOA.id);
  expect(screen.getByLabelText(/^Tipo de relação/)).toHaveProperty("value", "parceiro");
});
