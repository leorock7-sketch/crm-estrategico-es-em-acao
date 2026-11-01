/** Indicação exibida enquanto os dados são carregados. */
export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <p role="status" className="py-8 text-center text-sm text-texto-secundario">
      {texto}
    </p>
  );
}
