"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoSecundario, classeEntrada } from "@/componentes/estilos";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { adicionarEvidenciaAcao } from "../acoes";
import { ROTULOS_TIPO_EVIDENCIA, TIPOS_EVIDENCIA } from "../rotulos";

const ESTADO_INICIAL: EstadoFormulario = {};

/** Inclusão de evidência no rascunho (somente informações fictícias nesta etapa). */
export function FormularioEvidencia({ versaoId }: { versaoId: string }) {
  const [estado, acao, enviando] = useActionState(adicionarEvidenciaAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: string) => estado.valores?.[campo] ?? "";
  const atributosErro = (campo: string) =>
    erros[campo] ? { "aria-invalid": true, "aria-describedby": idErroCampo(`evidencia-${campo}`) } : {};

  return (
    // A chave recria o formulário com os valores enviados (ver formulario-instituicao.tsx).
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="versaoId" value={versaoId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Evidência registrada.</Alerta>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="evidencia-tipo" rotulo="Tipo" obrigatorio erros={erros.tipo}>
          <select
            id="evidencia-tipo"
            name="tipo"
            required
            defaultValue={valor("tipo")}
            className={classeEntrada}
            {...atributosErro("tipo")}
          >
            <option value="">Selecione…</option>
            {TIPOS_EVIDENCIA.map((t) => (
              <option key={t} value={t}>
                {ROTULOS_TIPO_EVIDENCIA[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="evidencia-dataEvidencia" rotulo="Data" erros={erros.dataEvidencia}>
          <input
            id="evidencia-dataEvidencia"
            name="dataEvidencia"
            type="date"
            defaultValue={valor("dataEvidencia")}
            className={classeEntrada}
            {...atributosErro("dataEvidencia")}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="evidencia-descricao" rotulo="Descrição" obrigatorio erros={erros.descricao}>
            <textarea
              id="evidencia-descricao"
              name="descricao"
              rows={2}
              required
              maxLength={2000}
              defaultValue={valor("descricao")}
              className={classeEntrada}
              {...atributosErro("descricao")}
            />
          </Campo>
        </div>
        <Campo id="evidencia-fonte" rotulo="Fonte" erros={erros.fonte}>
          <input
            id="evidencia-fonte"
            name="fonte"
            maxLength={300}
            defaultValue={valor("fonte")}
            className={classeEntrada}
            {...atributosErro("fonte")}
          />
        </Campo>
        <Campo id="evidencia-url" rotulo="Endereço (link)" erros={erros.url}>
          <input
            id="evidencia-url"
            name="url"
            type="url"
            placeholder="https://"
            maxLength={500}
            defaultValue={valor("url")}
            className={classeEntrada}
            {...atributosErro("url")}
          />
        </Campo>
      </div>
      <div>
        <button type="submit" disabled={enviando} className={classeBotaoSecundario}>
          {enviando ? "Registrando…" : "Registrar evidência"}
        </button>
      </div>
    </form>
  );
}
