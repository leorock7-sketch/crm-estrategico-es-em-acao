import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FiltrosDoPainel } from "@/modulos/paineis/componentes/blocos";
import type { FiltrosPainel } from "@/modulos/paineis/filtros";

afterEach(cleanup);

const P1 = "00000000-0000-4000-8000-000000000001";
const U1 = "00000000-0000-4000-8000-0000000000a1";
const U2 = "00000000-0000-4000-8000-0000000000a2";
const projetos = [{ id: P1, nome: "Projeto Fictício" }];
const usuarios = [
  { id: U1, nome: "Pessoa Fictícia Um" },
  { id: U2, nome: "Pessoa Fictícia Dois" },
];

const filtrosDoPainel = (filtros: FiltrosPainel) => (
  <FiltrosDoPainel filtros={filtros} comites={[]} projetos={projetos} usuarios={usuarios} caminho="/paineis" periodoInvertido={false} />
);
const valor = (rotulo: string) => (screen.getByLabelText(rotulo) as HTMLSelectElement | HTMLInputElement).value;

describe("Filtros do painel (D-091)", () => {
  test("ao limpar os filtros do endereço sem recarregar a página, os campos voltam a Todos", () => {
    const { rerender } = render(filtrosDoPainel({ projetoTemaId: P1, responsavelId: U1, de: "2026-01-01", ate: "2026-12-31" }));
    expect(valor("Projeto ou tema")).toBe(P1);
    expect(valor("Responsável (equipe)")).toBe(U1);

    // Mesmo efeito do botão "Limpar": a página é redesenhada com o endereço sem filtros.
    rerender(filtrosDoPainel({}));

    expect(valor("Projeto ou tema")).toBe("");
    expect(valor("Responsável (equipe)")).toBe("");
    expect(valor("Período: de")).toBe("");
    expect(valor("Período: até")).toBe("");
  });

  test("ao trocar o filtro aplicado, os campos mostram o novo filtro", () => {
    const { rerender } = render(filtrosDoPainel({ projetoTemaId: P1, responsavelId: U1 }));
    rerender(filtrosDoPainel({ projetoTemaId: P1, responsavelId: U2 }));
    expect(valor("Responsável (equipe)")).toBe(U2);
  });

  test("uma escolha ainda não aplicada não se perde se a página for redesenhada com os mesmos filtros", () => {
    const { rerender } = render(filtrosDoPainel({ projetoTemaId: P1 }));
    fireEvent.change(screen.getByLabelText("Responsável (equipe)"), { target: { value: U2 } });
    rerender(filtrosDoPainel({ projetoTemaId: P1 }));
    expect(valor("Responsável (equipe)")).toBe(U2);
  });
});
