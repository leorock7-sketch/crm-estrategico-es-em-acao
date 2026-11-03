"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { CaixasSelecao } from "@/componentes/caixas-selecao";
import { classeBotaoPrimario, classeBotaoSecundario, classeCartao, classeEntrada } from "@/componentes/estilos";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { salvarIniciativa } from "../acoes";
import {
  AJUDA_TIPO_INICIATIVA,
  PRIORIDADES_INICIATIVA,
  ROTULOS_PRIORIDADE_INICIATIVA,
  ROTULOS_SITUACAO_INICIATIVA,
  ROTULOS_TIPO_INICIATIVA,
  SITUACOES_INICIATIVA,
  TIPOS_INICIATIVA,
} from "../rotulos";

export type ValoresIniciativa = {
  id?: string;
  tipo?: string;
  titulo?: string;
  descricao?: string | null;
  origem?: string | null;
  situacao?: string;
  prioridade?: string | null;
  responsavelId?: string | null;
  dataAbertura?: string;
  dataPrevistaConclusao?: string | null;
  dataConclusao?: string | null;
  /** Projetos e temas pré-selecionados (somente no cadastro). */
  projetos?: string;
};

export type OpcaoProjetoTema = { id: string; nome: string; tipo: "projeto" | "tema"; comiteNome: string };
export type OpcaoUsuario = { id: string; nome: string };

const ESTADO_INICIAL: EstadoFormulario = {};

/**
 * Cadastro e edição de iniciativa. No cadastro, escolhem-se os projetos ou
 * temas (pelo menos um); depois, projetos e stakeholders são geridos na
 * página da iniciativa.
 */
export function FormularioIniciativa({
  inicial = {},
  projetos,
  usuarios,
}: {
  inicial?: ValoresIniciativa;
  projetos: OpcaoProjetoTema[];
  usuarios: OpcaoUsuario[];
}) {
  const [estado, acao, enviando] = useActionState(salvarIniciativa, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: keyof ValoresIniciativa) => estado.valores?.[campo] ?? inicial[campo] ?? "";
  const atributosErro = (campo: string) =>
    erros[campo] ? { "aria-invalid": true, "aria-describedby": idErroCampo(campo) } : {};
  const novo = !inicial.id;

  return (
    // A chave recria o formulário com os valores enviados (ver formulario-instituicao.tsx).
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className={`${classeCartao} flex flex-col gap-5`}>
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="tipo" rotulo="Tipo" obrigatorio erros={erros.tipo}>
          <select id="tipo" name="tipo" required defaultValue={valor("tipo")} className={classeEntrada} {...atributosErro("tipo")}>
            <option value="">Selecione…</option>
            {TIPOS_INICIATIVA.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ROTULOS_TIPO_INICIATIVA[tipo]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="situacao" rotulo="Situação" obrigatorio erros={erros.situacao}>
          <select
            id="situacao"
            name="situacao"
            required
            defaultValue={valor("situacao") || "registrada"}
            className={classeEntrada}
            {...atributosErro("situacao")}
          >
            {SITUACOES_INICIATIVA.map((situacao) => (
              <option key={situacao} value={situacao}>
                {ROTULOS_SITUACAO_INICIATIVA[situacao]}
              </option>
            ))}
          </select>
        </Campo>
        <ul className="text-xs text-texto-secundario sm:col-span-2">
          {TIPOS_INICIATIVA.map((tipo) => (
            <li key={tipo}>
              <span className="font-medium">{ROTULOS_TIPO_INICIATIVA[tipo]}:</span> {AJUDA_TIPO_INICIATIVA[tipo]}
            </li>
          ))}
        </ul>
        <div className="sm:col-span-2">
          <Campo id="titulo" rotulo="Título" obrigatorio erros={erros.titulo}>
            <input
              id="titulo"
              name="titulo"
              required
              maxLength={200}
              defaultValue={valor("titulo")}
              className={classeEntrada}
              {...atributosErro("titulo")}
            />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo id="descricao" rotulo="Descrição" erros={erros.descricao}>
            <textarea
              id="descricao"
              name="descricao"
              rows={3}
              maxLength={4000}
              defaultValue={valor("descricao")}
              className={classeEntrada}
              {...atributosErro("descricao")}
            />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo id="origem" rotulo="Origem" ajuda="Quem ou o que originou a iniciativa." erros={erros.origem}>
            <input id="origem" name="origem" maxLength={500} defaultValue={valor("origem")} className={classeEntrada} {...atributosErro("origem")} />
          </Campo>
        </div>
        <Campo id="responsavelId" rotulo="Responsável (equipe)" erros={erros.responsavelId}>
          <select
            id="responsavelId"
            name="responsavelId"
            defaultValue={valor("responsavelId")}
            className={classeEntrada}
            {...atributosErro("responsavelId")}
          >
            <option value="">Não definido</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="prioridade" rotulo="Prioridade" ajuda="Escala provisória." erros={erros.prioridade}>
          <select id="prioridade" name="prioridade" defaultValue={valor("prioridade")} className={classeEntrada} {...atributosErro("prioridade")}>
            <option value="">Não definida</option>
            {PRIORIDADES_INICIATIVA.map((p) => (
              <option key={p} value={p}>
                {ROTULOS_PRIORIDADE_INICIATIVA[p]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="dataAbertura" rotulo="Abertura" obrigatorio erros={erros.dataAbertura}>
          <input
            id="dataAbertura"
            name="dataAbertura"
            type="date"
            required
            defaultValue={valor("dataAbertura")}
            className={classeEntrada}
            {...atributosErro("dataAbertura")}
          />
        </Campo>
        <Campo id="dataPrevistaConclusao" rotulo="Previsão de conclusão" erros={erros.dataPrevistaConclusao}>
          <input
            id="dataPrevistaConclusao"
            name="dataPrevistaConclusao"
            type="date"
            defaultValue={valor("dataPrevistaConclusao")}
            className={classeEntrada}
            {...atributosErro("dataPrevistaConclusao")}
          />
        </Campo>
        <Campo
          id="dataConclusao"
          rotulo="Conclusão"
          ajuda="Obrigatória quando a situação é “Concluída”."
          erros={erros.dataConclusao}
        >
          <input
            id="dataConclusao"
            name="dataConclusao"
            type="date"
            defaultValue={valor("dataConclusao")}
            className={classeEntrada}
            {...atributosErro("dataConclusao")}
          />
        </Campo>
        {novo && (
          <div className="sm:col-span-2">
            <CaixasSelecao
              id="projetos"
              nome="projetos"
              legenda="Projetos e temas"
              obrigatorio
              ajuda="Pelo menos um. Definem o contexto e quem pode ver a iniciativa."
              grupos={[
                { titulo: "Projetos", opcoes: projetos.filter((p) => p.tipo === "projeto").map(opcaoProjeto) },
                { titulo: "Temas", opcoes: projetos.filter((p) => p.tipo === "tema").map(opcaoProjeto) },
              ]}
              marcados={valor("projetos").split(",").filter(Boolean)}
              erros={erros.projetos}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Salvando…" : "Salvar"}
        </button>
        <Link href={inicial.id ? `/iniciativas/${inicial.id}` : "/iniciativas"} className={classeBotaoSecundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function opcaoProjeto(p: OpcaoProjetoTema) {
  return { id: p.id, rotulo: p.nome, detalhe: p.comiteNome };
}
