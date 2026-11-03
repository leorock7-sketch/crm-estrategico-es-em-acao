"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoPrimario, classeEntrada } from "@/componentes/estilos";
import type { OpcaoUsuario } from "@/modulos/iniciativas/componentes/formulario-iniciativa";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { registrarAcompanhamentoAcao, salvarCompromisso } from "../acoes";
import { ROTULOS_SITUACAO_COMPROMISSO, SITUACOES_COMPROMISSO } from "../rotulos";

type OpcaoStakeholder = { id: string; nome: string };
type OpcaoIniciativaSimples = { id: string; titulo: string };

export type ValoresCompromisso = {
  id?: string;
  descricao?: string;
  interacaoId?: string | null;
  iniciativaId?: string | null;
  responsavelUsuarioId?: string | null;
  responsavelStakeholderId?: string | null;
  prazo?: string | null;
};

const ESTADO_INICIAL: EstadoFormulario = {};

/**
 * Cadastro ou edição de compromisso. A origem (interação ou iniciativa) vem da
 * página em que o formulário está; a iniciativa pode ser escolhida entre as
 * opções informadas. Com `voltarPara`, permanece na página após salvar.
 */
export function FormularioCompromisso({
  inicial = {},
  iniciativas,
  usuarios,
  pessoas,
  instituicoes,
  voltarPara,
  rotuloBotao = "Registrar compromisso",
}: {
  inicial?: ValoresCompromisso;
  /** Iniciativas que podem ser escolhidas; sem opções, mantém a iniciativa inicial. */
  iniciativas: OpcaoIniciativaSimples[];
  usuarios: OpcaoUsuario[];
  pessoas: OpcaoStakeholder[];
  instituicoes: OpcaoStakeholder[];
  voltarPara?: string;
  rotuloBotao?: string;
}) {
  const [estado, acao, enviando] = useActionState(salvarCompromisso, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: keyof ValoresCompromisso) => (estado.sucesso ? undefined : estado.valores?.[campo]) ?? inicial[campo] ?? "";
  const prefixo = inicial.id ? `compromisso-${inicial.id}` : "compromisso-novo";
  const atributosErro = (campo: string) =>
    erros[campo] ? { "aria-invalid": true, "aria-describedby": idErroCampo(`${prefixo}-${campo}`) } : {};

  return (
    <form key={JSON.stringify(estado.valores ?? {}) + String(estado.sucesso)} action={acao} className="flex flex-col gap-3">
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      {inicial.interacaoId && <input type="hidden" name="interacaoId" value={inicial.interacaoId} />}
      {iniciativas.length === 0 && inicial.iniciativaId && <input type="hidden" name="iniciativaId" value={inicial.iniciativaId} />}
      {voltarPara && <input type="hidden" name="voltarPara" value={voltarPara} />}
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Compromisso salvo.</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo id={`${prefixo}-descricao`} rotulo="Encaminhamento" obrigatorio erros={erros.descricao}>
            <textarea
              id={`${prefixo}-descricao`}
              name="descricao"
              required
              rows={2}
              maxLength={2000}
              defaultValue={valor("descricao")}
              className={classeEntrada}
              {...atributosErro("descricao")}
            />
          </Campo>
        </div>
        <Campo
          id={`${prefixo}-responsavelUsuarioId`}
          rotulo="Responsável da equipe"
          ajuda="Informe ao menos um responsável, da equipe ou externo."
          erros={erros.responsavelUsuarioId}
        >
          <select
            id={`${prefixo}-responsavelUsuarioId`}
            name="responsavelUsuarioId"
            defaultValue={valor("responsavelUsuarioId")}
            className={classeEntrada}
            {...atributosErro("responsavelUsuarioId")}
          >
            <option value="">Nenhum</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${prefixo}-responsavelStakeholderId`} rotulo="Responsável externo" erros={erros.responsavelStakeholderId}>
          <select
            id={`${prefixo}-responsavelStakeholderId`}
            name="responsavelStakeholderId"
            defaultValue={valor("responsavelStakeholderId")}
            className={classeEntrada}
            {...atributosErro("responsavelStakeholderId")}
          >
            <option value="">Nenhum</option>
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
        <Campo id={`${prefixo}-prazo`} rotulo="Prazo" erros={erros.prazo}>
          <input
            id={`${prefixo}-prazo`}
            name="prazo"
            type="date"
            defaultValue={valor("prazo")}
            className={classeEntrada}
            {...atributosErro("prazo")}
          />
        </Campo>
        {iniciativas.length > 0 && (
          <Campo
            id={`${prefixo}-iniciativaId`}
            rotulo="Iniciativa relacionada"
            ajuda={inicial.interacaoId ? "Opcional." : undefined}
            erros={erros.iniciativaId}
          >
            <select
              id={`${prefixo}-iniciativaId`}
              name="iniciativaId"
              defaultValue={valor("iniciativaId")}
              className={classeEntrada}
              {...atributosErro("iniciativaId")}
            >
              <option value="">{inicial.interacaoId ? "Nenhuma" : "Selecione…"}</option>
              {iniciativas.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.titulo}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>
      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Salvando…" : rotuloBotao}
        </button>
      </div>
    </form>
  );
}

/** Registro de acompanhamento, com mudança opcional da situação. Cada registro fica no histórico. */
export function FormularioAcompanhamento({ compromissoId, hoje }: { compromissoId: string; hoje: string }) {
  const [estado, acao, enviando] = useActionState(registrarAcompanhamentoAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: string, padrao = "") => (estado.sucesso ? undefined : estado.valores?.[campo]) ?? padrao;
  return (
    <form key={JSON.stringify(estado.valores ?? {}) + String(estado.sucesso)} action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="compromissoId" value={compromissoId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Acompanhamento registrado.</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="acompanhamento-data" rotulo="Data" obrigatorio erros={erros.data}>
          <input id="acompanhamento-data" name="data" type="date" required defaultValue={valor("data", hoje)} className={classeEntrada} />
        </Campo>
        <Campo id="acompanhamento-situacao" rotulo="Nova situação" erros={erros.situacao}>
          <select id="acompanhamento-situacao" name="situacao" defaultValue={valor("situacao")} className={classeEntrada}>
            <option value="">Manter a situação atual</option>
            {SITUACOES_COMPROMISSO.map((s) => (
              <option key={s} value={s}>
                {ROTULOS_SITUACAO_COMPROMISSO[s]}
              </option>
            ))}
          </select>
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="acompanhamento-registro" rotulo="Registro" obrigatorio erros={erros.registro}>
            <textarea
              id="acompanhamento-registro"
              name="registro"
              required
              rows={2}
              maxLength={2000}
              defaultValue={valor("registro")}
              className={classeEntrada}
            />
          </Campo>
        </div>
      </div>
      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Registrando…" : "Registrar acompanhamento"}
        </button>
      </div>
    </form>
  );
}
