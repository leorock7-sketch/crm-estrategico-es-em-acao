import { classeLink } from "@/componentes/estilos";
import { formatarData } from "@/lib/formatacao";
import { removerEvidenciaAcao } from "../acoes";
import type { VersaoDaFicha } from "../consultas";
import { ROTULOS_TIPO_EVIDENCIA } from "../rotulos";

/** Evidências de uma versão; no rascunho, cada uma pode ser retirada (arquivada). */
export function ListaEvidencias({
  evidencias,
  editavel = false,
}: {
  evidencias: VersaoDaFicha["evidencias"];
  editavel?: boolean;
}) {
  if (evidencias.length === 0) {
    return <p className="text-sm text-texto-secundario">Nenhuma evidência registrada.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-borda text-sm">
      {evidencias.map((e) => (
        <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-texto-secundario">
              {ROTULOS_TIPO_EVIDENCIA[e.tipo]}
            </span>
            <p className="whitespace-pre-line break-words">{e.descricao}</p>
            <p className="text-xs text-texto-secundario">
              {[e.fonte && `Fonte: ${e.fonte}`, e.dataEvidencia && formatarData(e.dataEvidencia)].filter(Boolean).join(" · ")}
            </p>
            {e.url && (
              <a href={e.url} target="_blank" rel="noopener noreferrer" className={`${classeLink} break-all text-xs`}>
                {e.url}
              </a>
            )}
          </div>
          {editavel && (
            <form action={removerEvidenciaAcao.bind(null, e.id)}>
              <button type="submit" className="text-xs text-texto-secundario underline hover:text-texto">
                Retirar
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
