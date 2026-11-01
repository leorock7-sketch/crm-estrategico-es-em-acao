"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoPrimario, classeEntrada } from "@/componentes/estilos";
import { type EstadoFormulario, salvarContato } from "../acoes";
import {
  NATUREZAS_CONTATO,
  ROTULOS_NATUREZA_CONTATO,
  ROTULOS_TIPO_CONTATO,
  TIPOS_CONTATO,
} from "../rotulos";
import { AvisoDuplicidades } from "./aviso-duplicidades";

export type OpcaoVinculo = { id: string; rotulo: string };

const ESTADO_INICIAL: EstadoFormulario = {};

/** Inclusão de contato de pessoa ou instituição (decisão D-025). */
export function FormularioContato({
  stakeholderId,
  naturezaPadrao,
  vinculos = [],
}: {
  stakeholderId: string;
  naturezaPadrao: (typeof NATUREZAS_CONTATO)[number];
  /** Vínculos vigentes da pessoa, para contatos funcionais ligados a um cargo. */
  vinculos?: OpcaoVinculo[];
}) {
  const [estado, acao, enviando] = useActionState(salvarContato, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: string) => estado.valores?.[campo] ?? "";
  const atributosErro = (campo: string) =>
    erros[campo]
      ? { "aria-invalid": true, "aria-describedby": idErroCampo(`contato-${campo}`) }
      : {};

  return (
    // A chave recria o formulário com os valores enviados (ver formulario-instituicao.tsx).
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="stakeholderId" value={stakeholderId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Contato registrado.</Alerta>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="contato-tipo" rotulo="Tipo" obrigatorio erros={erros.tipo}>
          <select
            id="contato-tipo"
            name="tipo"
            required
            defaultValue={valor("tipo") || "email"}
            className={classeEntrada}
            {...atributosErro("tipo")}
          >
            {TIPOS_CONTATO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ROTULOS_TIPO_CONTATO[tipo]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="contato-valor" rotulo="Contato" obrigatorio erros={erros.valor}>
          <input
            id="contato-valor"
            name="valor"
            required
            maxLength={300}
            autoComplete="off"
            defaultValue={valor("valor")}
            className={classeEntrada}
            {...atributosErro("valor")}
          />
        </Campo>
        <Campo
          id="contato-natureza"
          rotulo="Natureza"
          obrigatorio
          ajuda="Funcional: e-mail ou telefone do cargo, que pode ser compartilhado ou passar ao sucessor."
          erros={erros.natureza}
        >
          <select
            id="contato-natureza"
            name="natureza"
            required
            defaultValue={valor("natureza") || naturezaPadrao}
            className={classeEntrada}
            {...atributosErro("natureza")}
          >
            {NATUREZAS_CONTATO.map((natureza) => (
              <option key={natureza} value={natureza}>
                {ROTULOS_NATUREZA_CONTATO[natureza]}
              </option>
            ))}
          </select>
        </Campo>
        {vinculos.length > 0 && (
          <Campo
            id="contato-vinculoId"
            rotulo="Ligado ao vínculo (cargo)"
            ajuda="Opcional. Ao encerrar o vínculo, o contato é encerrado junto."
            erros={erros.vinculoId}
          >
            <select
              id="contato-vinculoId"
              name="vinculoId"
              defaultValue={valor("vinculoId")}
              className={classeEntrada}
              {...atributosErro("vinculoId")}
            >
              <option value="">Nenhum</option>
              {vinculos.map((vinculo) => (
                <option key={vinculo.id} value={vinculo.id}>
                  {vinculo.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo id="contato-dataInicio" rotulo="Válido desde" erros={erros.dataInicio}>
          <input
            id="contato-dataInicio"
            name="dataInicio"
            type="date"
            defaultValue={valor("dataInicio")}
            className={classeEntrada}
            {...atributosErro("dataInicio")}
          />
        </Campo>
        <Campo id="contato-observacao" rotulo="Observação" erros={erros.observacao}>
          <input
            id="contato-observacao"
            name="observacao"
            maxLength={500}
            defaultValue={valor("observacao")}
            className={classeEntrada}
            {...atributosErro("observacao")}
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="principal"
          defaultChecked={valor("principal") === "on"}
          className="size-4"
        />
        <span className="font-medium">Contato principal deste tipo</span>
      </label>

      {estado.duplicidades && estado.duplicidades.length > 0 && (
        <AvisoDuplicidades
          duplicidades={estado.duplicidades}
          titulo="Contato já registrado em outro cadastro"
          confirmacao="Confirmo que o contato é compartilhado ou foi transferido, e desejo registrá-lo também aqui."
        />
      )}

      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando
            ? "Registrando…"
            : estado.duplicidades?.length
              ? "Registrar mesmo assim"
              : "Registrar contato"}
        </button>
      </div>
    </form>
  );
}
