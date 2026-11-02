"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoPrimario, classeBotaoSecundario, classeCartao, classeEntrada } from "@/componentes/estilos";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { salvarRascunhoAcao } from "../acoes";
import { campoDaNota } from "../esquemas";
import {
  GRAUS_CONFIANCA,
  POSICIONAMENTOS,
  ROTULO_NAO_AVALIADO,
  ROTULOS_DIMENSAO,
  ROTULOS_GRAU_CONFIANCA,
  ROTULOS_POSICIONAMENTO,
} from "../rotulos";

export type CriterioDoFormulario = {
  id: string;
  dimensao: "poder" | "interesse";
  nome: string;
  descricao: string | null;
  escalaMinima: number;
  escalaMaxima: number;
};

export type ValoresRascunho = {
  posicionamento: string | null;
  grauConfianca: string | null;
  justificativaConfianca: string | null;
  justificativa: string | null;
  validacaoInstitucional: string | null;
  dataReferencia: string | null;
  notas: Record<string, number>;
};

const ESTADO_INICIAL: EstadoFormulario = {};

/**
 * Edição do rascunho. "Salvar rascunho" grava sem publicar; "Publicar" grava e
 * publica: o banco exige justificativa, data de referência e evidência.
 */
export function FormularioRascunho({
  versaoId,
  instituicao,
  criterios,
  inicial,
}: {
  versaoId: string;
  /** Instituições exigem validação institucional para receber posicionamento (Manual V2.0). */
  instituicao: boolean;
  criterios: CriterioDoFormulario[];
  inicial: ValoresRascunho;
}) {
  const [estado, acao, enviando] = useActionState(salvarRascunhoAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: keyof Omit<ValoresRascunho, "notas">) => estado.valores?.[campo] ?? inicial[campo] ?? "";
  const valorNota = (criterioId: string) =>
    estado.valores?.[campoDaNota(criterioId)] ?? (inicial.notas[criterioId] !== undefined ? String(inicial.notas[criterioId]) : "");
  const atributosErro = (campo: string) =>
    erros[campo] ? { "aria-invalid": true, "aria-describedby": idErroCampo(campo) } : {};

  return (
    // A chave recria o formulário com os valores enviados (ver formulario-instituicao.tsx).
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className={`${classeCartao} flex flex-col gap-5`}>
      <input type="hidden" name="versaoId" value={versaoId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Rascunho salvo.</Alerta>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          id="posicionamento"
          rotulo="Posicionamento"
          ajuda="“Não avaliado” é diferente de neutro: indica que ainda não há base para classificar."
          erros={erros.posicionamento}
        >
          <select
            id="posicionamento"
            name="posicionamento"
            defaultValue={valor("posicionamento")}
            className={classeEntrada}
            {...atributosErro("posicionamento")}
          >
            <option value="">{ROTULO_NAO_AVALIADO}</option>
            {POSICIONAMENTOS.map((p) => (
              <option key={p} value={p}>
                {ROTULOS_POSICIONAMENTO[p]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="dataReferencia" rotulo="Data de referência" obrigatorio erros={erros.dataReferencia}>
          <input
            id="dataReferencia"
            name="dataReferencia"
            type="date"
            defaultValue={valor("dataReferencia")}
            className={classeEntrada}
            {...atributosErro("dataReferencia")}
          />
        </Campo>

        {instituicao && (
          <div className="sm:col-span-2">
            <Campo
              id="validacaoInstitucional"
              rotulo="Validação institucional (fonte e justificativa)"
              ajuda="Obrigatória para atribuir posicionamento a uma instituição. A manifestação de um representante é atribuída à pessoa, e não presume a posição da instituição."
              erros={erros.validacaoInstitucional}
            >
              <textarea
                id="validacaoInstitucional"
                name="validacaoInstitucional"
                rows={2}
                maxLength={1000}
                defaultValue={valor("validacaoInstitucional")}
                className={classeEntrada}
                {...atributosErro("validacaoInstitucional")}
              />
            </Campo>
          </div>
        )}

        <Campo
          id="grauConfianca"
          rotulo="Grau de confiança"
          ajuda="Informado e justificado pelo responsável, sem classificação automática (D-036). Considere a confiabilidade da fonte, a independência das evidências, a atualidade, a pertinência e a consistência."
          erros={erros.grauConfianca}
        >
          <select
            id="grauConfianca"
            name="grauConfianca"
            defaultValue={valor("grauConfianca")}
            className={classeEntrada}
            {...atributosErro("grauConfianca")}
          >
            <option value="">Não informado</option>
            {GRAUS_CONFIANCA.map((g) => (
              <option key={g} value={g}>
                {ROTULOS_GRAU_CONFIANCA[g]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          id="justificativaConfianca"
          rotulo="Justificativa do grau de confiança"
          ajuda="Obrigatória quando o grau de confiança for informado."
          erros={erros.justificativaConfianca}
        >
          <textarea
            id="justificativaConfianca"
            name="justificativaConfianca"
            rows={2}
            maxLength={1000}
            defaultValue={valor("justificativaConfianca")}
            className={classeEntrada}
            {...atributosErro("justificativaConfianca")}
          />
        </Campo>
      </div>

      {criterios.length > 0 && (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-borda p-4">
          <legend className="px-1 text-sm font-semibold">Notas por critério (metodologia de demonstração)</legend>
          <p className="text-xs text-texto-secundario">
            Critério sem nota fica “sem nota” — nunca vale zero. Se faltar alguma nota, a dimensão fica sem pontuação e o
            stakeholder não aparece no gráfico da matriz.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {criterios.map((c) => (
              <Campo
                key={c.id}
                id={campoDaNota(c.id)}
                rotulo={`${c.nome} (${ROTULOS_DIMENSAO[c.dimensao].toLowerCase()})`}
                ajuda={c.descricao ?? undefined}
              >
                <select
                  id={campoDaNota(c.id)}
                  name={campoDaNota(c.id)}
                  defaultValue={valorNota(c.id)}
                  className={classeEntrada}
                >
                  <option value="">Sem nota</option>
                  {Array.from({ length: c.escalaMaxima - c.escalaMinima + 1 }, (_, i) => c.escalaMinima + i).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Campo>
            ))}
          </div>
        </fieldset>
      )}

      <Campo
        id="justificativa"
        rotulo="Justificativa da avaliação"
        obrigatorio
        ajuda="Obrigatória para publicar. Explique a avaliação com base nas evidências."
        erros={erros.justificativa}
      >
        <textarea
          id="justificativa"
          name="justificativa"
          rows={5}
          maxLength={4000}
          defaultValue={valor("justificativa")}
          className={classeEntrada}
          {...atributosErro("justificativa")}
        />
      </Campo>

      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intencao" value="salvar" disabled={enviando} className={classeBotaoSecundario}>
          {enviando ? "Salvando…" : "Salvar rascunho"}
        </button>
        <button type="submit" name="intencao" value="publicar" disabled={enviando} className={classeBotaoPrimario}>
          Publicar versão
        </button>
      </div>
      <p className="text-xs text-texto-secundario">
        Ao publicar, esta versão passa a ser a vigente e não pode mais ser alterada; a anterior fica preservada no
        histórico.
      </p>
    </form>
  );
}
