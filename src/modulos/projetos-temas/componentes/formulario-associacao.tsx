"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoPrimario, classeEntrada } from "@/componentes/estilos";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { salvarAssociacao } from "../acoes";
import { ROTULOS_TIPO_RELACAO, TIPOS_RELACAO } from "../rotulos";

type OpcaoStakeholder = { id: string; nome: string };

const ESTADO_INICIAL: EstadoFormulario = {};

/**
 * Associação de pessoa ou instituição ao projeto ou tema, com o tipo de relação
 * e uma descrição livre. Não registra poder, interesse nem posicionamento (D-030).
 */
export function FormularioAssociacao({
  projetoTemaId,
  pessoas,
  instituicoes,
}: {
  projetoTemaId: string;
  pessoas: OpcaoStakeholder[];
  instituicoes: OpcaoStakeholder[];
}) {
  const [estado, acao, enviando] = useActionState(salvarAssociacao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: string) => estado.valores?.[campo] ?? "";
  const atributosErro = (campo: string) =>
    erros[campo]
      ? { "aria-invalid": true, "aria-describedby": idErroCampo(`associacao-${campo}`) }
      : {};

  return (
    // A chave recria o formulário com os valores enviados (ver formulario-instituicao.tsx).
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="projetoTemaId" value={projetoTemaId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Stakeholder associado.</Alerta>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo
            id="associacao-stakeholderId"
            rotulo="Pessoa ou instituição"
            obrigatorio
            erros={erros.stakeholderId}
          >
            <select
              id="associacao-stakeholderId"
              name="stakeholderId"
              required
              defaultValue={valor("stakeholderId")}
              className={classeEntrada}
              {...atributosErro("stakeholderId")}
            >
              <option value="">Selecione…</option>
              <optgroup label="Instituições">
                {instituicoes.map((opcao) => (
                  <option key={opcao.id} value={opcao.id}>
                    {opcao.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Pessoas">
                {pessoas.map((opcao) => (
                  <option key={opcao.id} value={opcao.id}>
                    {opcao.nome}
                  </option>
                ))}
              </optgroup>
            </select>
          </Campo>
        </div>
        <Campo
          id="associacao-tipoRelacao"
          rotulo="Tipo de relação"
          obrigatorio
          erros={erros.tipoRelacao}
        >
          <select
            id="associacao-tipoRelacao"
            name="tipoRelacao"
            required
            defaultValue={valor("tipoRelacao")}
            className={classeEntrada}
            {...atributosErro("tipoRelacao")}
          >
            <option value="">Selecione…</option>
            {TIPOS_RELACAO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ROTULOS_TIPO_RELACAO[tipo]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="associacao-dataInicio" rotulo="Início" erros={erros.dataInicio}>
          <input
            id="associacao-dataInicio"
            name="dataInicio"
            type="date"
            defaultValue={valor("dataInicio")}
            className={classeEntrada}
            {...atributosErro("dataInicio")}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo
            id="associacao-descricao"
            rotulo="Descrição da relação"
            ajuda="Texto livre, por exemplo: “responsável pelo licenciamento ambiental”."
            erros={erros.descricao}
          >
            <textarea
              id="associacao-descricao"
              name="descricao"
              rows={2}
              maxLength={500}
              defaultValue={valor("descricao")}
              className={classeEntrada}
              {...atributosErro("descricao")}
            />
          </Campo>
        </div>
      </div>

      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Associando…" : "Associar stakeholder"}
        </button>
      </div>
    </form>
  );
}
