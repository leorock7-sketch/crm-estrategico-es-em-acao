import {
  type NaturezaPosicionamento,
  type Posicionamento,
  posicionamentoDaEscalaAnterior,
  posicionamentoPreliminar,
  ROTULO_NAO_AVALIADO,
  ROTULOS_POSICIONAMENTO,
} from "../rotulos";

/** Cor de cada categoria (variáveis definidas em globals.css, com versão para o modo escuro). */
export const COR_POSICIONAMENTO: Record<Posicionamento, string> = {
  favoravel: "var(--posicao-favoravel)",
  parcialmente_favoravel: "var(--posicao-parcialmente-favoravel)",
  neutro: "var(--posicao-neutro)",
  parcialmente_contrario: "var(--posicao-parcialmente-contrario)",
  contrario: "var(--posicao-contrario)",
};

/** Símbolo de cada categoria, para que a leitura não dependa só da cor (T-5). */
export const SIMBOLO_POSICIONAMENTO: Record<Posicionamento, string> = {
  favoravel: "▲",
  parcialmente_favoravel: "△",
  neutro: "■",
  parcialmente_contrario: "▽",
  contrario: "▼",
};

export const SIMBOLO_NAO_AVALIADO = "○";

/**
 * Posicionamento com marcador de cor, símbolo e nome; "não avaliado" aparece
 * vazado e tracejado. As categorias parciais são marcadas como escala anterior
 * (D-059) e o posicionamento sem manifestação formal, como preliminar (D-068).
 */
export function SeloPosicionamento({
  posicionamento,
  natureza = null,
}: {
  posicionamento: Posicionamento | null;
  natureza?: NaturezaPosicionamento | null;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-sm">
      <span
        aria-hidden="true"
        className="inline-block size-3 rounded-full border"
        style={
          posicionamento
            ? { background: COR_POSICIONAMENTO[posicionamento], borderColor: "var(--texto-secundario)" }
            : { borderStyle: "dashed", borderColor: "var(--texto-secundario)" }
        }
      />
      <span aria-hidden="true" className="text-xs text-texto-secundario">
        {posicionamento ? SIMBOLO_POSICIONAMENTO[posicionamento] : SIMBOLO_NAO_AVALIADO}
      </span>
      {posicionamento ? ROTULOS_POSICIONAMENTO[posicionamento] : ROTULO_NAO_AVALIADO}
      {posicionamentoDaEscalaAnterior(posicionamento) && (
        <span className="text-xs text-texto-secundario">(escala anterior)</span>
      )}
      {posicionamentoPreliminar(posicionamento, natureza) && <SeloPreliminar />}
    </span>
  );
}

/** Avaliação preliminar: informação informal ou percepção, não posição oficial confirmada. */
export function SeloPreliminar() {
  return (
    <span
      className="rounded border border-dashed px-1 text-xs font-medium"
      style={{ borderColor: "var(--alerta-revisao)", color: "var(--alerta-revisao)" }}
      title="Avaliação preliminar: informação informal ou percepção do consultor, não posição oficial confirmada."
    >
      preliminar
    </span>
  );
}
