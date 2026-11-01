import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PaginaInicial from "@/app/page";

afterEach(cleanup);

describe("Página inicial", () => {
  test("exibe o nome do sistema como título principal", () => {
    render(<PaginaInicial />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "CRM Estratégico — ES em Ação",
      }),
    ).toBeDefined();
  });

  test("informa que a aplicação está em desenvolvimento", () => {
    render(<PaginaInicial />);

    expect(screen.getByText("Em desenvolvimento")).toBeDefined();
    expect(screen.getByText(/Esta aplicação está em desenvolvimento/)).toBeDefined();
  });
});
