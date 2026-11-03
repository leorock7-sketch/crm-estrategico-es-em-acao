"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoPrimario, classeBotaoSecundario, classeEntrada } from "@/componentes/estilos";
import type { OpcaoProjetoTema, OpcaoUsuario } from "@/modulos/iniciativas/componentes/formulario-iniciativa";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import {
  alterarPresencaAcao,
  incluirIniciativaNaInteracaoAcao,
  incluirParticipanteAcao,
  incluirProjetoNaInteracaoAcao,
} from "../acoes";
import { PRESENCAS_INTERACAO, type PresencaInteracao, ROTULOS_PRESENCA } from "../rotulos";
import type { OpcaoIniciativa } from "./formulario-interacao";

type OpcaoStakeholder = { id: string; nome: string };

const ESTADO_INICIAL: EstadoFormulario = {};

function atributosDeErro(erros: string[] | undefined, id: string) {
  return erros ? { "aria-invalid": true, "aria-describedby": idErroCampo(id) } : {};
}

/** Inclui participante externo (pessoa ou instituição) ou da equipe interna. */
export function FormularioParticipante({
  interacaoId,
  pessoas,
  instituicoes,
  usuarios,
}: {
  interacaoId: string;
  pessoas: OpcaoStakeholder[];
  instituicoes: OpcaoStakeholder[];
  usuarios: OpcaoUsuario[];
}) {
  const [estado, acao, enviando] = useActionState(incluirParticipanteAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  return (
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="interacaoId" value={interacaoId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Participante incluído.</Alerta>}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Campo id="participante" rotulo="Participante" obrigatorio erros={erros.participante}>
          <select
            id="participante"
            name="participante"
            required
            defaultValue={estado.valores?.participante ?? ""}
            className={classeEntrada}
            {...atributosDeErro(erros.participante, "participante")}
          >
            <option value="">Selecione…</option>
            <optgroup label="Equipe interna">
              {usuarios.map((u) => (
                <option key={u.id} value={`u:${u.id}`}>
                  {u.nome}
                </option>
              ))}
            </optgroup>
            <optgroup label="Instituições">
              {instituicoes.map((o) => (
                <option key={o.id} value={`s:${o.id}`}>
                  {o.nome}
                </option>
              ))}
            </optgroup>
            <optgroup label="Pessoas">
              {pessoas.map((o) => (
                <option key={o.id} value={`s:${o.id}`}>
                  {o.nome}
                </option>
              ))}
            </optgroup>
          </select>
        </Campo>
        <Campo id="presenca" rotulo="Presença" obrigatorio erros={erros.presenca}>
          <select
            id="presenca"
            name="presenca"
            required
            defaultValue={estado.valores?.presenca ?? "presente"}
            className={classeEntrada}
            {...atributosDeErro(erros.presenca, "presenca")}
          >
            {PRESENCAS_INTERACAO.map((p) => (
              <option key={p} value={p}>
                {ROTULOS_PRESENCA[p]}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Incluindo…" : "Incluir participante"}
        </button>
      </div>
    </form>
  );
}

/** Ajusta a presença de um participante. */
export function FormularioPresenca({
  interacaoId,
  participanteId,
  presenca,
  nome,
}: {
  interacaoId: string;
  participanteId: string;
  presenca: PresencaInteracao;
  nome: string;
}) {
  const [estado, acao, enviando] = useActionState(alterarPresencaAcao, ESTADO_INICIAL);
  const id = `presenca-${participanteId}`;
  return (
    <form action={acao} className="flex items-center gap-2">
      <input type="hidden" name="interacaoId" value={interacaoId} />
      <input type="hidden" name="participanteId" value={participanteId} />
      <label htmlFor={id} className="sr-only">
        Presença de {nome}
      </label>
      <select
        id={id}
        name="presenca"
        defaultValue={presenca}
        className="rounded-lg border border-borda bg-superficie px-2 py-1 text-sm text-texto shadow-sm focus:border-blue-700 focus:outline-2 focus:outline-blue-700/30"
      >
        {PRESENCAS_INTERACAO.map((p) => (
          <option key={p} value={p}>
            {ROTULOS_PRESENCA[p]}
          </option>
        ))}
      </select>
      <button type="submit" disabled={enviando} className={`${classeBotaoSecundario} px-3 py-1`}>
        {enviando ? "Salvando…" : "Salvar"}
      </button>
      {estado.mensagem && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {estado.mensagem}
        </span>
      )}
    </form>
  );
}

/** Liga a interação a mais um projeto ou tema. */
export function FormularioProjetoDaInteracao({ interacaoId, projetos }: { interacaoId: string; projetos: OpcaoProjetoTema[] }) {
  const [estado, acao, enviando] = useActionState(incluirProjetoNaInteracaoAcao, ESTADO_INICIAL);
  const erro = estado.erros?.projetoTemaId;
  return (
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="interacaoId" value={interacaoId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Projeto ou tema incluído.</Alerta>}
      <Campo id="interacao-projetoTemaId" rotulo="Projeto ou tema" obrigatorio erros={erro}>
        <select
          id="interacao-projetoTemaId"
          name="projetoTemaId"
          required
          defaultValue=""
          className={classeEntrada}
          {...atributosDeErro(erro, "interacao-projetoTemaId")}
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

/** Registra que a interação também contribuiu para outra iniciativa (sem duplicar a reunião). */
export function FormularioIniciativaDaInteracao({
  interacaoId,
  iniciativas,
}: {
  interacaoId: string;
  iniciativas: OpcaoIniciativa[];
}) {
  const [estado, acao, enviando] = useActionState(incluirIniciativaNaInteracaoAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  return (
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="interacaoId" value={interacaoId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Iniciativa incluída.</Alerta>}
      <Campo id="interacao-iniciativaId" rotulo="Iniciativa" obrigatorio erros={erros.iniciativaId}>
        <select
          id="interacao-iniciativaId"
          name="iniciativaId"
          required
          defaultValue=""
          className={classeEntrada}
          {...atributosDeErro(erros.iniciativaId, "interacao-iniciativaId")}
        >
          <option value="">Selecione…</option>
          {iniciativas.map((i) => (
            <option key={i.id} value={i.id}>
              {i.titulo}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="interacao-contribuicao" rotulo="Contribuição" ajuda="Como a interação contribuiu para esta iniciativa." erros={erros.contribuicao}>
        <input id="interacao-contribuicao" name="contribuicao" maxLength={500} className={classeEntrada} />
      </Campo>
      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Incluindo…" : "Incluir iniciativa"}
        </button>
      </div>
    </form>
  );
}
