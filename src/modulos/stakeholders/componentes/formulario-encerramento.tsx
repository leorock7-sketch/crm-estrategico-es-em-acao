"use client";

import { useActionState } from "react";
import { classeBotaoSecundario, classeEntrada } from "@/componentes/estilos";
import { encerrarVinculoPessoa, type EstadoFormulario } from "../acoes";

const ESTADO_INICIAL: EstadoFormulario = {};

/** Encerra um vínculo vigente, informando a data de término. */
export function FormularioEncerramento({ vinculoId }: { vinculoId: string }) {
  const [estado, acao, enviando] = useActionState(encerrarVinculoPessoa, ESTADO_INICIAL);
  const idCampo = `encerrar-${vinculoId}`;
  const erro = estado.erros?.dataFim?.join(" ") ?? estado.mensagem;

  return (
    <form action={acao} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="vinculoId" value={vinculoId} />
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
