"use client";

import { useActionState } from "react";
import { classeBotaoSecundario, classeEntrada } from "@/componentes/estilos";
import { encerrarContatoAcao, encerrarVinculoPessoa, type EstadoFormulario } from "../acoes";

const ESTADO_INICIAL: EstadoFormulario = {};

const CONFIGURACAO = {
  vinculo: { acao: encerrarVinculoPessoa, campo: "vinculoId" },
  contato: { acao: encerrarContatoAcao, campo: "contatoId" },
} as const;

/** Encerra um vínculo ou contato vigente, informando a data de término. */
export function FormularioEncerramento({ id, alvo }: { id: string; alvo: keyof typeof CONFIGURACAO }) {
  const { acao: acaoServidor, campo } = CONFIGURACAO[alvo];
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
