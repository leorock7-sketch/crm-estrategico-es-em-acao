import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { MatrizTresPorTres } from "@/modulos/avaliacoes/componentes/matriz-tres-por-tres";
import type { ClassificacaoMatriz } from "@/modulos/avaliacoes/matriz";

afterEach(cleanup);

type Ficha = ClassificacaoMatriz["noGrafico"][number];

function ficha(id: string, extra: Partial<Ficha["vigente"]> = {}, revisaoVencida = false): Ficha {
  return {
    stakeholderId: id,
    nome: `Stakeholder fictício ${id}`,
    tipoStakeholder: "instituicao",
    associado: true,
    temRascunho: false,
    revisaoVencida,
    vigente: {
      numeroVersao: 1,
      metodologiaId: "v22",
      metodologiaNome: "V2.2",
      poder: null,
      interesse: null,
      nivelPoder: "alto",
      nivelInteresse: "alto",
      posicionamento: "favoravel",
      naturezaPosicionamento: "manifestacao_formal",
      grauConfianca: "alto",
      dataReferencia: "2026-10-20",
      proximaRevisao: "2027-10-20",
      ...extra,
    },
  };
}

test("grade 3 × 3 com células nomeadas, quantidade, nomes, posicionamento por símbolo e selo “preliminar”; nenhuma conduta (T18, T-5)", () => {
  const { container } = render(
    <MatrizTresPorTres
      fichas={[
        ficha("A"),
        ficha("B", { posicionamento: "contrario" }),
        ficha("C", { nivelPoder: "medio", nivelInteresse: "medio", posicionamento: "neutro", naturezaPosicionamento: "informacao_informal" }),
        ficha("D", { nivelPoder: "baixo", nivelInteresse: "alto", posicionamento: null, naturezaPosicionamento: null }, true),
      ]}
      caminhoFicha={(id) => `/ficha/${id}`}
    />,
  );
  const celulas = container.querySelectorAll("[data-celula]");
  expect(celulas).toHaveLength(9);

  const altoAlto = container.querySelector('[data-celula="alto|alto"]') as HTMLElement;
  expect(within(altoAlto).getByText(/Alto poder \/ alto interesse/)).toBeDefined();
  expect(within(altoAlto).getAllByRole("link").map((l) => l.getAttribute("aria-label"))).toEqual([
    "Stakeholder fictício A",
    "Stakeholder fictício B",
  ]);
  // Na mesma célula, posicionamentos opostos: o posicionamento é cor e símbolo, nunca eixo.
  expect(within(altoAlto).getByText("Favorável", { selector: ".sr-only" })).toBeDefined();
  expect(within(altoAlto).getByText("Contrário", { selector: ".sr-only" })).toBeDefined();

  const central = container.querySelector('[data-celula="medio|medio"]') as HTMLElement;
  expect(within(central).getByText(/Zona intermediária central/)).toBeDefined();
  expect(within(central).getByText("preliminar")).toBeDefined();
  expect(within(central).getByRole("link", { name: "Stakeholder fictício C, avaliação preliminar" })).toBeDefined();

  const baixoAlto = container.querySelector('[data-celula="baixo|alto"]') as HTMLElement;
  expect(within(baixoAlto).getByText("Não avaliado", { selector: ".sr-only" })).toBeDefined();
  expect(within(baixoAlto).getByTitle("Revisão anual vencida")).toBeDefined();

  // Tabela alternativa com os mesmos dados.
  const tabela = screen.getByRole("table", { name: "Avaliações da matriz" }) as HTMLTableElement;
  expect(tabela.tBodies[0].rows).toHaveLength(4);
  expect(screen.queryByText(/priorizar|monitorar|conduta sugerida/i)).toBeNull();
});
