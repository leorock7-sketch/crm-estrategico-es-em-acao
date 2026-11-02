import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

// A ação do servidor é substituída por uma simulação que recusa a publicação.
vi.mock("@/modulos/avaliacoes/acoes", () => ({
  salvarRascunhoAcao: vi.fn(async (_estado: unknown, formData: FormData) => ({
    mensagem: "Registre pelo menos uma evidência antes de publicar.",
    valores: Object.fromEntries([...formData.entries()].filter(([campo]) => !campo.startsWith("$"))) as Record<
      string,
      string
    >,
  })),
}));

const { FormularioRascunho } = await import("@/modulos/avaliacoes/componentes/formulario-rascunho");

afterEach(cleanup);

const VERSAO = "5e1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const CRITERIO = {
  id: "11111111-1111-4111-8111-111111111111",
  dimensao: "poder" as const,
  nome: "Critério fictício",
  descricao: null,
  escalaMinima: 1,
  escalaMaxima: 5,
};
const VAZIO = {
  posicionamento: null,
  grauConfianca: null,
  justificativaConfianca: null,
  justificativa: null,
  validacaoInstitucional: null,
  dataReferencia: "2026-10-01",
  notas: {},
};

test("“não avaliado” e “sem nota” são as opções padrão, distintas de neutro e de zero", () => {
  render(<FormularioRascunho versaoId={VERSAO} instituicao={false} criterios={[CRITERIO]} inicial={VAZIO} />);
  const posicionamento = screen.getByLabelText("Posicionamento") as HTMLSelectElement;
  expect(posicionamento.value).toBe("");
  expect([...posicionamento.options].map((o) => o.text)).toEqual([
    "Não avaliado",
    "Favorável",
    "Parcialmente favorável",
    "Neutro",
    "Parcialmente contrário",
    "Contrário",
  ]);
  const nota = screen.getByLabelText(/^Critério fictício/) as HTMLSelectElement;
  expect([...nota.options].map((o) => o.text)).toEqual(["Sem nota", "1", "2", "3", "4", "5"]);
  expect(screen.queryByLabelText(/Validação institucional/)).toBeNull();
});

test("para instituição, pede a validação institucional", () => {
  render(<FormularioRascunho versaoId={VERSAO} instituicao criterios={[]} inicial={VAZIO} />);
  expect(screen.getByLabelText(/Validação institucional/)).toBeDefined();
});

test("se a publicação for recusada, mostra o motivo e mantém o que foi preenchido", async () => {
  render(<FormularioRascunho versaoId={VERSAO} instituicao={false} criterios={[CRITERIO]} inicial={VAZIO} />);
  fireEvent.change(screen.getByLabelText("Posicionamento"), { target: { value: "parcialmente_favoravel" } });
  fireEvent.change(screen.getByLabelText("Grau de confiança"), { target: { value: "medio" } });
  fireEvent.change(screen.getByLabelText(/^Critério fictício/), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText(/^Justificativa da avaliação/), { target: { value: "Texto fictício." } });
  fireEvent.click(screen.getByRole("button", { name: "Publicar versão" }));

  expect(await screen.findByText("Registre pelo menos uma evidência antes de publicar.")).toBeDefined();
  expect(screen.getByLabelText("Posicionamento")).toHaveProperty("value", "parcialmente_favoravel");
  expect(screen.getByLabelText("Grau de confiança")).toHaveProperty("value", "medio");
  expect(screen.getByLabelText(/^Critério fictício/)).toHaveProperty("value", "4");
  expect(screen.getByLabelText(/^Justificativa da avaliação/)).toHaveProperty("value", "Texto fictício.");
});

describe("Escala V2.2", () => {
  const RUBRICAS = [
    { dimensao: "poder" as const, nivel: "alto", criterioOrientador: "Orientação fictícia de poder alto.", basesTipicas: null },
  ];

  test("três categorias e “não avaliado”; níveis e ressalvas começam como “não avaliado” e “não se aplica” (T17, T22)", () => {
    render(
      <FormularioRascunho versaoId={VERSAO} instituicao escala="ordinal" rubricas={RUBRICAS} criterios={[]} inicial={VAZIO} />,
    );
    const posicionamento = screen.getByLabelText("Posicionamento") as HTMLSelectElement;
    expect([...posicionamento.options].map((o) => o.text)).toEqual(["Não avaliado", "Favorável", "Neutro", "Contrário"]);
    const poder = screen.getByLabelText("Nível de poder") as HTMLSelectElement;
    expect(poder.value).toBe("");
    expect([...poder.options].map((o) => o.text)).toEqual(["Não avaliado", "Alto", "Médio", "Baixo"]);
    expect((screen.getByLabelText("Ressalvas relevantes") as HTMLSelectElement).selectedOptions[0].text).toMatch(/^Não se aplica/);
    expect([...(screen.getByLabelText("Grau de confiança") as HTMLSelectElement).options].map((o) => o.text)).toEqual([
      "Não informado",
      "Alta",
      "Média",
      "Baixa",
    ]);
    // Sem notas por critério e sem a exigência de validação institucional: a origem é só registrada.
    expect(screen.queryByText(/Notas por critério/)).toBeNull();
    expect(screen.getByLabelText(/^Origem da informação/)).toBeDefined();
    expect(screen.getByText("Rubrica de poder (orientação)")).toBeDefined();
  });

  test("alertas orientativos aparecem ao preencher, sem impedir a publicação (D-067)", async () => {
    render(<FormularioRascunho versaoId={VERSAO} instituicao={false} escala="ordinal" criterios={[]} inicial={VAZIO} />);
    expect(screen.getByText("Alertas orientativos (0)")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Posicionamento"), { target: { value: "neutro" } });
    fireEvent.change(screen.getByLabelText("Natureza da informação"), { target: { value: "percepcao_consultor" } });
    expect(await screen.findByText("Alertas orientativos (1)")).toBeDefined();
    expect(screen.getByText(/Neutro pressupõe manifestação neutra ou equidistante/)).toBeDefined();
    const publicar = screen.getByRole("button", { name: "Publicar mesmo assim" }) as HTMLButtonElement;
    expect(publicar.disabled).toBe(false);
  });
});
