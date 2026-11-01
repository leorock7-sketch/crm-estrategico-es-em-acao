"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoPrimario, classeEntrada } from "@/componentes/estilos";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { salvarParticipacao } from "../acoes";
import type { OpcaoComite } from "./formulario-projeto-tema";

const ESTADO_INICIAL: EstadoFormulario = {};

/** Inclusão de comitê participante (D-023). O comitê principal não aparece na lista. */
export function FormularioParticipacao({
  projetoTemaId,
  comites,
}: {
  projetoTemaId: string;
  comites: OpcaoComite[];
}) {
  const [estado, acao, enviando] = useActionState(salvarParticipacao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: string) => estado.valores?.[campo] ?? "";
  const atributosErro = (campo: string) =>
    erros[campo]
      ? { "aria-invalid": true, "aria-describedby": idErroCampo(`participacao-${campo}`) }
      : {};

  if (comites.length === 0) {
    return (
      <p className="text-sm text-texto-secundario">
        Todos os comitês já participam deste projeto ou tema.
      </p>
    );
  }

  return (
    // A chave recria o formulário com os valores enviados (ver formulario-instituicao.tsx).
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="projetoTemaId" value={projetoTemaId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Comitê participante registrado.</Alerta>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="participacao-comiteId" rotulo="Comitê" obrigatorio erros={erros.comiteId}>
          <select
            id="participacao-comiteId"
            name="comiteId"
            required
            defaultValue={valor("comiteId")}
            className={classeEntrada}
            {...atributosErro("comiteId")}
          >
            <option value="">Selecione…</option>
            {comites.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>
                {opcao.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="participacao-dataInicio" rotulo="Início" erros={erros.dataInicio}>
          <input
            id="participacao-dataInicio"
            name="dataInicio"
            type="date"
            defaultValue={valor("dataInicio")}
            className={classeEntrada}
            {...atributosErro("dataInicio")}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="participacao-observacao" rotulo="Observação" erros={erros.observacao}>
            <input
              id="participacao-observacao"
              name="observacao"
              maxLength={500}
              defaultValue={valor("observacao")}
              className={classeEntrada}
              {...atributosErro("observacao")}
            />
          </Campo>
        </div>
      </div>

      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Registrando…" : "Registrar comitê participante"}
        </button>
      </div>
    </form>
  );
}
