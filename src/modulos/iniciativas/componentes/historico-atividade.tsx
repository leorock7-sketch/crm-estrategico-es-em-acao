import { formatarDataHora } from "@/lib/formatacao";
import {
  alteracoesDaAtividade,
  descreverRegistroAtividade,
  type RegistroAtividade,
  rotuloDaOperacao,
} from "../historico";

/** Trilha de auditoria de iniciativas, interações e compromissos: quem fez, quando e o que mudou. */
export function HistoricoAtividade({ registros, nomes }: { registros: RegistroAtividade[]; nomes: Map<string, string> }) {
  if (registros.length === 0) {
    return <p className="text-sm text-texto-secundario">Nenhum registro no histórico.</p>;
  }
  return (
    <ol className="flex flex-col gap-4">
      {registros.map((registro) => {
        const alteracoes = alteracoesDaAtividade(registro, nomes);
        return (
          <li key={registro.id} className="border-l-2 border-borda pl-4">
            <p className="text-sm">
              <span className="font-medium">{rotuloDaOperacao(registro)}</span>
              {" · "}
              {descreverRegistroAtividade(registro, nomes)}
            </p>
            <p className="text-xs text-texto-secundario">
              {formatarDataHora(registro.ocorridoEm)} · {registro.usuarioNome ?? "carga inicial"}
            </p>
            {alteracoes.length > 0 && (
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
                {alteracoes.map((alteracao) => (
                  <div key={alteracao.campo} className="contents">
                    <dt className="text-texto-secundario">{alteracao.rotulo}</dt>
                    <dd className="break-words">
                      {registro.operacao === "inclusao" ? (
                        alteracao.depois
                      ) : (
                        <>
                          <span className="line-through decoration-texto-secundario/60">{alteracao.antes}</span> →{" "}
                          {alteracao.depois}
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ol>
  );
}
