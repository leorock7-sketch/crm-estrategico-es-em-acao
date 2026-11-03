import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

// As ações do servidor são substituídas por simulações: o registro da interação
// devolve um alerta de reunião possivelmente repetida; a nova iniciativa, um erro de campo.
vi.mock("@/modulos/interacoes/acoes", () => {
  const valores = (formData: FormData) => {
    const resultado: Record<string, string> = {};
    for (const campo of new Set(formData.keys())) {
      if (!campo.startsWith("$")) resultado[campo] = formData.getAll(campo).join(",");
    }
    return resultado;
  };
  return {
    salvarInteracao: vi.fn(async (_estado: unknown, formData: FormData) => ({
      duplicidades: [
        { id: "9b1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b", nome: "Reunião fictícia (01/11/2026, 10:00)", motivo: "Mesmo assunto, em data próxima", arquivado: false, caminho: "/interacoes" },
      ],
      valores: valores(formData),
    })),
    salvarCompromisso: vi.fn(),
    registrarAcompanhamentoAcao: vi.fn(),
  };
});
vi.mock("@/modulos/iniciativas/acoes", () => ({
  salvarIniciativa: vi.fn(async (_estado: unknown, formData: FormData) => ({
    erros: { projetos: ["Selecione pelo menos um projeto ou tema."] },
    valores: { titulo: String(formData.get("titulo") ?? ""), projetos: "" },
  })),
}));

const { FormularioInteracao } = await import("@/modulos/interacoes/componentes/formulario-interacao");
const { FormularioIniciativa } = await import("@/modulos/iniciativas/componentes/formulario-iniciativa");
const { ListaCompromissos } = await import("@/modulos/interacoes/componentes/lista-compromissos");

afterEach(cleanup);

const PROJETOS = [
  { id: "a0000000-0000-4000-8000-000000000001", nome: "Projeto Fictício A", tipo: "projeto" as const, comiteNome: "Comitê X" },
  { id: "a0000000-0000-4000-8000-000000000002", nome: "Tema Fictício B", tipo: "tema" as const, comiteNome: "Comitê Y" },
];
const INICIATIVAS = [
  { id: "b0000000-0000-4000-8000-000000000001", titulo: "Iniciativa Fictícia 1", tipo: "demanda" as const },
  { id: "b0000000-0000-4000-8000-000000000002", titulo: "Iniciativa Fictícia 2", tipo: "reuniao_relevante" as const },
];

describe("Registro de interação", () => {
  test("uma reunião é marcada para várias iniciativas de uma vez, com a iniciativa de origem já selecionada", () => {
    render(
      <FormularioInteracao
        inicial={{ situacao: "realizada", iniciativas: INICIATIVAS[1].id }}
        projetos={PROJETOS}
        iniciativas={INICIATIVAS}
        pessoas={[{ id: "c0000000-0000-4000-8000-000000000001", nome: "Pessoa Fictícia" }]}
        instituicoes={[{ id: "c0000000-0000-4000-8000-000000000002", nome: "Instituição Fictícia" }]}
        usuarios={[{ id: "d0000000-0000-4000-8000-000000000001", nome: "Equipe Fictícia" }]}
      />,
    );
    const grupo = screen.getByRole("group", { name: "Iniciativas" });
    expect((within(grupo).getByRole("checkbox", { name: /Iniciativa Fictícia 2/ }) as HTMLInputElement).checked).toBe(true);
    expect((within(grupo).getByRole("checkbox", { name: /Iniciativa Fictícia 1/ }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("group", { name: "Participantes externos" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Participantes da equipe" })).toBeDefined();
  });

  test("possível reunião repetida: alerta com o registro parecido e confirmação expressa, mantendo o que foi digitado", async () => {
    const { container } = render(
      <FormularioInteracao inicial={{ situacao: "realizada" }} projetos={PROJETOS} iniciativas={INICIATIVAS} pessoas={[]} instituicoes={[]} usuarios={[]} />,
    );
    fireEvent.change(screen.getByLabelText(/Assunto/), { target: { value: "Reunião fictícia" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Iniciativa Fictícia 1/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Iniciativa Fictícia 2/ }));
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByText("Possível interação já registrada")).toBeDefined();
    expect(screen.getByRole("link", { name: "Reunião fictícia (01/11/2026, 10:00)" }).getAttribute("href")).toBe(
      "/interacoes/9b1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
    );
    expect(screen.getByRole("checkbox", { name: /não se trata da mesma interação/ })).toBeDefined();
    expect(screen.getByRole("button", { name: "Salvar mesmo assim" })).toBeDefined();
    expect((screen.getByLabelText(/Assunto/) as HTMLInputElement).value).toBe("Reunião fictícia");
    // As duas iniciativas continuam marcadas: a reunião será registrada uma única vez para ambas.
    expect((screen.getByRole("checkbox", { name: /Iniciativa Fictícia 1/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Iniciativa Fictícia 2/ }) as HTMLInputElement).checked).toBe(true);
  });
});

describe("Nova iniciativa", () => {
  test("projetos e temas em grupos, com o erro de “pelo menos um” exibido no grupo", async () => {
    const { container } = render(<FormularioIniciativa inicial={{ situacao: "registrada", dataAbertura: "2026-11-03" }} projetos={PROJETOS} usuarios={[]} />);
    const grupo = screen.getByRole("group", { name: /Projetos e temas/ });
    expect(within(grupo).getByText("Projetos")).toBeDefined();
    expect(within(grupo).getByText("Temas")).toBeDefined();
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(await screen.findByText("Selecione pelo menos um projeto ou tema.")).toBeDefined();
  });
});

describe("Lista de compromissos", () => {
  const compromisso = {
    id: "e0000000-0000-4000-8000-000000000001",
    descricao: "Enviar nota técnica fictícia",
    prazo: "2026-11-01",
    situacao: "aberto" as const,
    concluidoEm: null,
    arquivadoEm: null,
    interacaoId: "f0000000-0000-4000-8000-000000000001",
    interacaoAssunto: "Reunião fictícia",
    iniciativaId: null,
    iniciativaTitulo: null,
    responsavelUsuarioId: "d0000000-0000-4000-8000-000000000001",
    responsavelUsuarioNome: "Equipe Fictícia",
    responsavelStakeholderId: "c0000000-0000-4000-8000-000000000002",
    responsavelStakeholderTipo: "instituicao" as const,
    responsavelStakeholderNome: "Instituição Fictícia",
  };

  test("prazo vencido em destaque, responsáveis interno e externo e origem com link", () => {
    render(<ListaCompromissos compromissos={[compromisso]} hoje="2026-11-03" />);
    expect(screen.getByText("Prazo vencido")).toBeDefined();
    expect(screen.getByText(/Equipe Fictícia/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Instituição Fictícia" }).getAttribute("href")).toBe(
      "/instituicoes/c0000000-0000-4000-8000-000000000002",
    );
    expect(screen.getByRole("link", { name: "Reunião fictícia" }).getAttribute("href")).toBe("/interacoes/f0000000-0000-4000-8000-000000000001");
  });

  test("concluído não aparece como vencido", () => {
    render(<ListaCompromissos compromissos={[{ ...compromisso, situacao: "concluido", concluidoEm: "2026-11-02" }]} hoje="2026-11-03" />);
    expect(screen.queryByText("Prazo vencido")).toBeNull();
    expect(screen.getByText("Concluído")).toBeDefined();
  });
});
