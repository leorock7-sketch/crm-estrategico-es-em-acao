"use client";

import { useActionState } from "react";
import { classeBotaoSecundario, classeEntrada } from "@/componentes/estilos";

/** Estado devolvido pelas ações de encerramento (mesmo formato dos demais formulários). */
type EstadoEncerramento = {
  erros?: Record<string, string[] | undefined>;
  mensagem?: string;
  valores?: Record<string, string>;
  sucesso?: boolean;
};

type AcaoEncerramento = (estado: EstadoEncerramento, formData: FormData) => Promise<EstadoEncerramento>;

const ESTADO_INICIAL: EstadoEncerramento = {};

/**
 * Encerra um registro vigente (vínculo, contato, participação ou associação),
 * informando a data de término. A ação do servidor e o nome do campo do
 * identificador são definidos por quem usa o componente.
 */
export function FormularioEncerramento({
  acao: acaoServidor,
  campo,
  id,
}: {
  acao: AcaoEncerramento;
  campo: string;
  id: string;
}) {
  const [estado, acao, enviando] = useActionState(acaoServidor, ESTADO_INICIAL);
  const idCampo = `encerrar-${id}`;
  const erro = estado.erros?.dataFim?.join(" ") ?? estado.mensagem;

  return (
    <form action={acao} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name={campo} value={id} />
      <label htmlFor={idCampo} className="text-xs font-medium">
        Data de término
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={idCampo}
          name="dataFim"
          type="date"
          required
          defaultValue={estado.valores?.dataFim ?? ""}
          className={`${classeEntrada} w-auto`}
          aria-invalid={erro ? true : undefined}
        />
        <button type="submit" disabled={enviando} className={classeBotaoSecundario}>
          {enviando ? "Encerrando…" : "Confirmar encerramento"}
        </button>
      </div>
      {erro && <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>}
    </form>
  );
}
