"use client";

import { classeBotaoSecundario } from "@/componentes/estilos";

/** Impressão e PDF pelos recursos do próprio navegador (D-079). */
export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className={`${classeBotaoSecundario} whitespace-nowrap print:hidden`}>
      Imprimir ou salvar em PDF
    </button>
  );
}
