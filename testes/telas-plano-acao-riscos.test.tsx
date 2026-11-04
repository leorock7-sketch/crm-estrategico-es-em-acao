import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

// As ações do servidor são substituídas por simulações (os formulários só são exibidos).
vi.mock("@/modulos/riscos/acoes", () => ({
  salvarRisco: vi.fn(),
  registrarAvaliacaoAcao: vi.fn(),
  salvarGatilho: vi.fn(),
  registrarOcorrenciaGatilhoAcao: vi.fn(),
  salvarResposta: vi.fn(),
}));
vi.mock("@/modulos/plano-acao/acoes", () => ({
  salvarPlano: vi.fn(),
  salvarEixo: vi.fn(),
  salvarAcaoPlanejada: vi.fn(),
  salvarMarco: vi.fn(),
  enviarParaAprovacaoAcao: vi.fn(),
  decidirVersaoAcao: vi.fn(),
  registrarAcompanhamentoDaAcao: vi.fn(),
  alterarIniciativaDaAcao: vi.fn(),
  converterCompromissoAcao: vi.fn(),
}));

const { MatrizRiscos, ComparacaoInerenteResidual, SeloClassificacao } = await import("@/modulos/riscos/componentes/matriz-riscos");
const { FormularioAvaliacao } = await import("@/modulos/riscos/componentes/formularios-risco");
const { DiferencasVersao } = await import("@/modulos/plano-acao/componentes/diferencas-versao");
const { FormularioAcompanhamentoAcao, FormularioPlano } = await import("@/modulos/plano-acao/componentes/formularios-plano");

afterEach(cleanup);

/** Converte "#RRGGBB" na forma que o navegador devolve em style.backgroundColor. */
function rgb(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

describe("Matriz de riscos 5 × 5", () => {
  test("25 células com a criticidade, as cores institucionais e a quantidade de riscos", () => {
    render(<MatrizRiscos titulo="Risco inerente" avaliacoes={[{ probabilidade: 4, impacto: 5 }, { probabilidade: 4, impacto: 5 }, null]} />);
    const tabela = screen.getByRole("table");
    const celulas = within(tabela).getAllByRole("cell");
    expect(celulas).toHaveLength(25);
    const critica = screen.getByLabelText("Probabilidade 4, impacto 5: criticidade 20 (Crítico), 2 riscos");
    expect(critica.style.backgroundColor).toBe(rgb("#F4CCCC"));
    expect(critica.textContent).toContain("2");
    expect(screen.getByLabelText("Probabilidade 1, impacto 1: criticidade 1 (Baixo), 0 riscos").style.backgroundColor).toBe(rgb("#E2F0D9"));
    expect(screen.getByLabelText("Probabilidade 3, impacto 3: criticidade 9 (Moderado), 0 riscos").style.backgroundColor).toBe(rgb("#FFF2CC"));
    expect(screen.getByLabelText("Probabilidade 4, impacto 4: criticidade 16 (Alto), 0 riscos").style.backgroundColor).toBe(rgb("#FCE4D6"));
    expect(screen.getByText(/2 riscos/)).toBeTruthy();
  });

  test("selo da classificação com a cor da faixa e o índice", () => {
    render(<SeloClassificacao classificacao="alto" valor={12} />);
    const selo = screen.getByText("Alto");
    expect(selo.style.backgroundColor).toBe(rgb("#FCE4D6"));
    expect(selo.textContent).toContain("12");
  });

  test("comparação entre inerente e residual em pontos do índice, sem percentual", () => {
    const { container } = render(
      <ComparacaoInerenteResidual inerente={{ criticidade: 20, classificacao: "critico" }} residual={{ criticidade: 8, classificacao: "moderado" }} />,
    );
    expect(container.textContent).toContain("20 → 8");
    expect(container.textContent).toContain("-12 pontos");
    expect(container.textContent).toContain("de crítico para moderado");
    expect(container.textContent).not.toContain("%");
    cleanup();
    render(<ComparacaoInerenteResidual inerente={{ criticidade: 20, classificacao: "critico" }} residual={null} />);
    expect(screen.getByText("Residual ainda não avaliado")).toBeTruthy();
  });

  test("avaliação mostra a criticidade e a faixa calculadas ao escolher probabilidade e impacto", () => {
    render(<FormularioAvaliacao riscoId="0b1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b" hoje="2026-11-03" usuarios={[{ id: "u1", nome: "Equipe Fictícia" }]} />);
    expect(screen.getByText(/Criticidade = probabilidade × impacto/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Probabilidade/), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText(/^Impacto/), { target: { value: "5" } });
    const resumo = screen.getByText(/Criticidade/, { selector: "p" });
    expect(resumo.textContent).toContain("20");
    expect(resumo.textContent).toContain("Crítico");
    expect(resumo.textContent).toContain("Escalonar imediatamente");
    // Residual por padrão, com a definição adotada.
    expect((screen.getByLabelText(/Risco residual/) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Medidas apenas planejadas não contam como controles eficazes/)).toBeTruthy();
  });
});

describe("Plano de Ação", () => {
  test("comparação entre versões destaca incluídas, retiradas e alteradas, com antes e depois", () => {
    render(
      <DiferencasVersao
        vazio="Nada muda."
        diferencas={[
          { tipo: "alterada", codigo: "A-01", titulo: "Ação fictícia", alteracoes: [{ campo: "Fim previsto", antes: "2026-12-01", depois: "2026-12-20" }] },
          { tipo: "incluida", codigo: "A-02", titulo: "Ação nova" },
          { tipo: "retirada", codigo: "A-03", titulo: "Ação retirada" },
        ]}
      />,
    );
    expect(screen.getByText("Alterada")).toBeTruthy();
    expect(screen.getByText("Incluída")).toBeTruthy();
    expect(screen.getByText("Retirada")).toBeTruthy();
    expect(screen.getByText("01/12/2026")).toBeTruthy();
    expect(screen.getByText("20/12/2026")).toBeTruthy();
    cleanup();
    render(<DiferencasVersao vazio="Nada muda." diferencas={[]} />);
    expect(screen.getByText("Nada muda.")).toBeTruthy();
  });

  test("novo plano oferece os pilares de referência, marcados por padrão e não obrigatórios", () => {
    render(<FormularioPlano inicial={{}} projetos={[{ id: "p1", nome: "Projeto Fictício", comiteNome: "Comitê X" }]} usuarios={[]} />);
    const caixa = screen.getByRole("checkbox") as HTMLInputElement;
    expect(caixa.checked).toBe(true);
    expect(screen.getByText(/P5 Comunicação \/ Transparência \/ Licença Social/)).toBeTruthy();
    expect(screen.getByText(/O modelo não é obrigatório/)).toBeTruthy();
  });

  test("acompanhamento: percentual opcional; ao escolher um marco, pergunta se foi alcançado", () => {
    render(
      <FormularioAcompanhamentoAcao
        acaoId="0b1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b"
        hoje="2026-11-03"
        marcos={[{ marcoId: "m1", codigo: "M1", descricao: "Marco fictício", alcancadoEm: null }]}
      />,
    );
    const percentual = screen.getByLabelText(/Percentual de execução/) as HTMLInputElement;
    expect(percentual.required).toBe(false);
    expect(screen.getByText(/Complementar e opcional/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Marco/), { target: { value: "m1" } });
    expect(screen.getByLabelText(/O marco foi alcançado/)).toBeTruthy();
  });
});
