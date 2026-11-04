"use client";

import { type ReactNode, useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoPrimario, classeEntrada } from "@/componentes/estilos";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";

export type AcaoFormulario = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
export type OpcaoNome = { id: string; nome: string };

const ESTADO_INICIAL: EstadoFormulario = {};

/**
 * Estado comum dos formulários: valores reapresentados após erro (ou os
 * iniciais), mensagens por campo e atributos de acessibilidade dos erros.
 */
export function useFormularioRegistro<T extends Record<string, unknown>>(acaoServidor: AcaoFormulario, inicial: T, prefixo: string) {
  const [estado, acao, enviando] = useActionState(acaoServidor, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: string): string => {
    const enviado = estado.sucesso ? undefined : estado.valores?.[campo];
    if (enviado !== undefined) return enviado;
    const original = inicial[campo];
    return original === null || original === undefined ? "" : String(original);
  };
  const id = (campo: string) => `${prefixo}-${campo}`;
  const atributosErro = (campo: string) =>
    erros[campo] ? { "aria-invalid": true as const, "aria-describedby": idErroCampo(id(campo)) } : {};
  const chave = JSON.stringify(estado.valores ?? {}) + String(estado.sucesso);
  return { estado, acao, enviando, erros, valor, id, atributosErro, chave };
}

/** Mensagens gerais do formulário (erro ou sucesso). */
export function MensagensFormulario({ estado, sucesso }: { estado: EstadoFormulario; sucesso: string }) {
  return (
    <>
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">{sucesso}</Alerta>}
    </>
  );
}

export function BotaoEnviar({ enviando, rotulo, rotuloEnviando = "Salvando…" }: { enviando: boolean; rotulo: string; rotuloEnviando?: string }) {
  return (
    <div>
      <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
        {enviando ? rotuloEnviando : rotulo}
      </button>
    </div>
  );
}

/** Opções de pessoas e instituições do Cadastro Mestre, agrupadas. */
export function OpcoesStakeholders({ pessoas, instituicoes }: { pessoas: OpcaoNome[]; instituicoes: OpcaoNome[] }) {
  return (
    <>
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
    </>
  );
}

/** Lista de seleção com rótulo, ajuda e erros; a primeira opção representa "nenhum". */
export function CampoSelecao({
  id,
  nome,
  rotulo,
  valor,
  vazio,
  obrigatorio,
  ajuda,
  erros,
  atributos,
  children,
}: {
  id: string;
  nome: string;
  rotulo: string;
  valor: string;
  vazio?: string;
  obrigatorio?: boolean;
  ajuda?: string;
  erros?: string[];
  atributos?: Record<string, unknown>;
  children: ReactNode;
}) {
  return (
    <Campo id={id} rotulo={rotulo} obrigatorio={obrigatorio} ajuda={ajuda} erros={erros}>
      <select id={id} name={nome} required={obrigatorio} defaultValue={valor} className={classeEntrada} {...atributos}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {children}
      </select>
    </Campo>
  );
}

/** Inclui uma pessoa ou instituição relacionada a um registro (ação ou risco), com observação. */
export function FormularioStakeholderRelacionado({
  acao: acaoServidor,
  campos,
  prefixo,
  pessoas,
  instituicoes,
}: {
  acao: AcaoFormulario;
  campos: Record<string, string>;
  prefixo: string;
  pessoas: OpcaoNome[];
  instituicoes: OpcaoNome[];
}) {
  const f = useFormularioRegistro(acaoServidor, { stakeholderId: "", observacao: "" }, prefixo);
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <MensagensFormulario estado={f.estado} sucesso="Pessoa ou instituição incluída." />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSelecao
          id={f.id("stakeholderId")}
          nome="stakeholderId"
          rotulo="Pessoa ou instituição"
          valor={f.valor("stakeholderId")}
          vazio="Selecione…"
          obrigatorio
          erros={f.erros.stakeholderId}
          atributos={f.atributosErro("stakeholderId")}
        >
          <OpcoesStakeholders pessoas={pessoas} instituicoes={instituicoes} />
        </CampoSelecao>
        <Campo id={f.id("observacao")} rotulo="Observação" erros={f.erros.observacao}>
          <input
            id={f.id("observacao")}
            name="observacao"
            maxLength={500}
            defaultValue={f.valor("observacao")}
            className={classeEntrada}
            {...f.atributosErro("observacao")}
          />
        </Campo>
      </div>
      <BotaoEnviar enviando={f.enviando} rotulo="Incluir" rotuloEnviando="Incluindo…" />
    </form>
  );
}
