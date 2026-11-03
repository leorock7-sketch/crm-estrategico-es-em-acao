"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoPrimario, classeEntrada } from "@/componentes/estilos";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { incluirProjetoNaIniciativaAcao, incluirStakeholderNaIniciativaAcao } from "../acoes";
import { PAPEIS_INICIATIVA, ROTULOS_PAPEL_INICIATIVA } from "../rotulos";
import type { OpcaoProjetoTema } from "./formulario-iniciativa";

type OpcaoStakeholder = { id: string; nome: string };

const ESTADO_INICIAL: EstadoFormulario = {};

/** Inclui um projeto ou tema na iniciativa. */
export function FormularioProjetoDaIniciativa({
  iniciativaId,
  projetos,
}: {
  iniciativaId: string;
  projetos: OpcaoProjetoTema[];
}) {
  const [estado, acao, enviando] = useActionState(incluirProjetoNaIniciativaAcao, ESTADO_INICIAL);
  const erro = estado.erros?.projetoTemaId;
  return (
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="iniciativaId" value={iniciativaId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Projeto ou tema incluído.</Alerta>}
      <Campo id="iniciativa-projetoTemaId" rotulo="Projeto ou tema" obrigatorio erros={erro}>
        <select
          id="iniciativa-projetoTemaId"
          name="projetoTemaId"
          required
          defaultValue=""
          className={classeEntrada}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idErroCampo("iniciativa-projetoTemaId") : undefined}
        >
          <option value="">Selecione…</option>
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p.comiteNome})
            </option>
          ))}
        </select>
      </Campo>
      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Incluindo…" : "Incluir projeto ou tema"}
        </button>
      </div>
    </form>
  );
}

/** Inclui uma pessoa ou instituição na iniciativa, com o seu papel (lista provisória — Q-23). */
export function FormularioStakeholderDaIniciativa({
  iniciativaId,
  pessoas,
  instituicoes,
}: {
  iniciativaId: string;
  pessoas: OpcaoStakeholder[];
  instituicoes: OpcaoStakeholder[];
}) {
  const [estado, acao, enviando] = useActionState(incluirStakeholderNaIniciativaAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: string) => estado.valores?.[campo] ?? "";
  const atributosErro = (campo: string) =>
    erros[campo] ? { "aria-invalid": true, "aria-describedby": idErroCampo(`iniciativa-${campo}`) } : {};
  return (
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="iniciativaId" value={iniciativaId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Stakeholder incluído.</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo id="iniciativa-stakeholderId" rotulo="Pessoa ou instituição" obrigatorio erros={erros.stakeholderId}>
            <select
              id="iniciativa-stakeholderId"
              name="stakeholderId"
              required
              defaultValue={valor("stakeholderId")}
              className={classeEntrada}
              {...atributosErro("stakeholderId")}
            >
              <option value="">Selecione…</option>
              <optgroup label="Instituições">
                {instituicoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Pessoas">
                {pessoas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </optgroup>
            </select>
          </Campo>
        </div>
        <Campo id="iniciativa-papel" rotulo="Papel" obrigatorio erros={erros.papel}>
          <select id="iniciativa-papel" name="papel" required defaultValue={valor("papel")} className={classeEntrada} {...atributosErro("papel")}>
            <option value="">Selecione…</option>
            {PAPEIS_INICIATIVA.map((papel) => (
              <option key={papel} value={papel}>
                {ROTULOS_PAPEL_INICIATIVA[papel]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="iniciativa-observacao" rotulo="Observação" erros={erros.observacao}>
          <input
            id="iniciativa-observacao"
            name="observacao"
            maxLength={500}
            defaultValue={valor("observacao")}
            className={classeEntrada}
            {...atributosErro("observacao")}
          />
        </Campo>
      </div>
      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Incluindo…" : "Incluir stakeholder"}
        </button>
      </div>
    </form>
  );
}
