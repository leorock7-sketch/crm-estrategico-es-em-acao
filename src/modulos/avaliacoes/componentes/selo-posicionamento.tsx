import { type Posicionamento, ROTULO_NAO_AVALIADO, ROTULOS_POSICIONAMENTO } from "../rotulos";

/** Cor de cada nível (variáveis definidas em globals.css, com versão para o modo escuro). */
export const COR_POSICIONAMENTO: Record<Posicionamento, string> = {
  favoravel: "var(--posicao-favoravel)",
  parcialmente_favoravel: "var(--posicao-parcialmente-favoravel)",
  neutro: "var(--posicao-neutro)",
  parcialmente_contrario: "var(--posicao-parcialmente-contrario)",
  contrario: "var(--posicao-contrario)",
};

/** Posicionamento com marcador de cor e nome; "não avaliado" aparece vazado e tracejado. */
export function SeloPosicionamento({ posicionamento }: { posicionamento: Posicionamento | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden="true"
        className="inline-block size-3 rounded-full border"
        style={
          posicionamento
            ? { background: COR_POSICIONAMENTO[posicionamento], borderColor: "var(--texto-secundario)" }
            : { borderStyle: "dashed", borderColor: "var(--texto-secundario)" }
        }
      />
      {posicionamento ? ROTULOS_POSICIONAMENTO[posicionamento] : ROTULO_NAO_AVALIADO}
    </span>
  );
}
