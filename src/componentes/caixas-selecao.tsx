import { idErroCampo } from "./campo";

export type OpcaoSelecao = { id: string; rotulo: string; detalhe?: string };

type GrupoSelecao = { titulo?: string; opcoes: OpcaoSelecao[] };

/**
 * Seleção múltipla por caixas de marcação, em grupos e com rolagem própria
 * (funciona sem JavaScript; cada item marcado é enviado com o mesmo nome).
 */
export function CaixasSelecao({
  id,
  nome,
  legenda,
  ajuda,
  grupos,
  marcados,
  erros,
  obrigatorio,
}: {
  id: string;
  nome: string;
  legenda: string;
  ajuda?: string;
  grupos: GrupoSelecao[];
  marcados: string[];
  erros?: string[];
  obrigatorio?: boolean;
}) {
  const selecionados = new Set(marcados);
  const vazio = grupos.every((g) => g.opcoes.length === 0);
  return (
    <fieldset
      className="flex flex-col gap-1"
      aria-describedby={erros?.length ? idErroCampo(id) : undefined}
      aria-invalid={erros?.length ? true : undefined}
    >
      <legend className="text-sm font-medium">
        {legenda}
        {obrigatorio && (
          <span className="text-red-700 dark:text-red-400" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </legend>
      {ajuda && <p className="text-xs text-texto-secundario">{ajuda}</p>}
      {vazio ? (
        <p className="text-sm text-texto-secundario">Nenhuma opção disponível.</p>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-borda bg-superficie p-3">
          {grupos
            .filter((g) => g.opcoes.length > 0)
            .map((grupo, posicao) => (
              <div key={grupo.titulo ?? posicao} className="mb-2 last:mb-0">
                {grupo.titulo && (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-texto-secundario">{grupo.titulo}</p>
                )}
                <ul className="flex flex-col gap-1">
                  {grupo.opcoes.map((opcao) => (
                    <li key={opcao.id}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          name={nome}
                          value={opcao.id}
                          defaultChecked={selecionados.has(opcao.id)}
                          className="mt-0.5 size-4 shrink-0"
                        />
                        <span>
                          {opcao.rotulo}
                          {opcao.detalhe && <span className="text-texto-secundario"> · {opcao.detalhe}</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
      {erros && erros.length > 0 && (
        <p id={idErroCampo(id)} className="text-sm text-red-700 dark:text-red-400">
          {erros.join(" ")}
        </p>
      )}
    </fieldset>
  );
}
