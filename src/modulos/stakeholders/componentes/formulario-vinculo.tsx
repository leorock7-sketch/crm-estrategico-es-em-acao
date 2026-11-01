"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoPrimario, classeEntrada } from "@/componentes/estilos";
import { type EstadoFormulario, salvarVinculo } from "../acoes";
import type { OpcaoInstituicao } from "./formulario-instituicao";

const ESTADO_INICIAL: EstadoFormulario = {};

/** Inclusão de vínculo de uma pessoa com uma instituição. */
export function FormularioVinculo({
  pessoaId,
  instituicoes,
}: {
  pessoaId: string;
  instituicoes: OpcaoInstituicao[];
}) {
  const [estado, acao, enviando] = useActionState(salvarVinculo, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: string) => estado.valores?.[campo] ?? "";
  const atributosErro = (campo: string) =>
    erros[campo]
      ? { "aria-invalid": true, "aria-describedby": idErroCampo(`vinculo-${campo}`) }
      : {};

  return (
    // A chave recria o formulário com os valores enviados (ver formulario-instituicao.tsx).
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="pessoaId" value={pessoaId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Vínculo registrado.</Alerta>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo
            id="vinculo-instituicaoId"
            rotulo="Instituição"
            obrigatorio
            erros={erros.instituicaoId}
          >
            <select
              id="vinculo-instituicaoId"
              name="instituicaoId"
              required
              defaultValue={valor("instituicaoId")}
              className={classeEntrada}
              {...atributosErro("instituicaoId")}
            >
              <option value="">Selecione…</option>
              {instituicoes.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.sigla ? `${opcao.nome} (${opcao.sigla})` : opcao.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo id="vinculo-cargo" rotulo="Cargo" erros={erros.cargo}>
          <input
            id="vinculo-cargo"
            name="cargo"
            maxLength={150}
            defaultValue={valor("cargo")}
            className={classeEntrada}
            {...atributosErro("cargo")}
          />
        </Campo>
        <Campo id="vinculo-area" rotulo="Área ou unidade" erros={erros.area}>
          <input
            id="vinculo-area"
            name="area"
            maxLength={150}
            defaultValue={valor("area")}
            className={classeEntrada}
            {...atributosErro("area")}
          />
        </Campo>
        <Campo id="vinculo-dataInicio" rotulo="Início" erros={erros.dataInicio}>
          <input
            id="vinculo-dataInicio"
            name="dataInicio"
            type="date"
            defaultValue={valor("dataInicio")}
            className={classeEntrada}
            {...atributosErro("dataInicio")}
          />
        </Campo>
        <Campo
          id="vinculo-dataFim"
          rotulo="Término"
          ajuda="Deixe em branco se o vínculo está vigente."
          erros={erros.dataFim}
        >
          <input
            id="vinculo-dataFim"
            name="dataFim"
            type="date"
            defaultValue={valor("dataFim")}
            className={classeEntrada}
            {...atributosErro("dataFim")}
          />
        </Campo>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="principal"
          defaultChecked={valor("principal") === "on"}
          className="mt-0.5 size-4"
        />
        <span>
          <span className="font-medium">Vínculo principal</span>
          <span className="block text-texto-secundario">
            Usado para exibir o cargo e a instituição nas listas. Cada pessoa pode ter um único
            vínculo principal vigente.
          </span>
        </span>
      </label>

      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Registrando…" : "Registrar vínculo"}
        </button>
      </div>
    </form>
  );
}
