"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import {
  classeBotaoPrimario,
  classeBotaoSecundario,
  classeCartao,
  classeEntrada,
} from "@/componentes/estilos";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { AvisoDuplicidades } from "@/modulos/stakeholders/componentes/aviso-duplicidades";
import { salvarProjetoTema } from "../acoes";
import {
  ROTULOS_SITUACAO_PROJETO_TEMA,
  ROTULOS_TIPO_PROJETO_TEMA,
  SITUACOES_PROJETO_TEMA,
  TIPOS_PROJETO_TEMA,
} from "../rotulos";

export type ValoresProjetoTema = {
  id?: string;
  tipo?: string;
  nome?: string;
  descricao?: string | null;
  comiteId?: string;
  situacao?: string;
  dataInicio?: string | null;
  dataFim?: string | null;
};

export type OpcaoComite = { id: string; nome: string };

const ESTADO_INICIAL: EstadoFormulario = {};

/** Cadastro e edição de projeto ou tema, com o comitê principal. */
export function FormularioProjetoTema({
  inicial = {},
  opcoesComites,
}: {
  inicial?: ValoresProjetoTema;
  opcoesComites: OpcaoComite[];
}) {
  const [estado, acao, enviando] = useActionState(salvarProjetoTema, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: keyof ValoresProjetoTema) =>
    estado.valores?.[campo] ?? inicial[campo] ?? "";
  const atributosErro = (campo: string) =>
    erros[campo] ? { "aria-invalid": true, "aria-describedby": idErroCampo(campo) } : {};

  return (
    // A chave recria o formulário com os valores enviados (ver formulario-instituicao.tsx).
    <form
      key={JSON.stringify(estado.valores ?? {})}
      action={acao}
      className={`${classeCartao} flex flex-col gap-5`}
    >
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}

      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="tipo" rotulo="Tipo" obrigatorio erros={erros.tipo}>
          <select
            id="tipo"
            name="tipo"
            required
            defaultValue={valor("tipo")}
            className={classeEntrada}
            {...atributosErro("tipo")}
          >
            <option value="">Selecione…</option>
            {TIPOS_PROJETO_TEMA.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ROTULOS_TIPO_PROJETO_TEMA[tipo]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="situacao" rotulo="Situação" obrigatorio erros={erros.situacao}>
          <select
            id="situacao"
            name="situacao"
            required
            defaultValue={valor("situacao") || "proposto"}
            className={classeEntrada}
            {...atributosErro("situacao")}
          >
            {SITUACOES_PROJETO_TEMA.map((situacao) => (
              <option key={situacao} value={situacao}>
                {ROTULOS_SITUACAO_PROJETO_TEMA[situacao]}
              </option>
            ))}
          </select>
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="nome" rotulo="Nome" obrigatorio erros={erros.nome}>
            <input
              id="nome"
              name="nome"
              required
              maxLength={200}
              autoComplete="off"
              defaultValue={valor("nome")}
              className={classeEntrada}
              {...atributosErro("nome")}
            />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo
            id="comiteId"
            rotulo="Comitê principal"
            obrigatorio
            ajuda="Os comitês participantes são registrados depois, na página do projeto ou tema."
            erros={erros.comiteId}
          >
            <select
              id="comiteId"
              name="comiteId"
              required
              defaultValue={valor("comiteId")}
              className={classeEntrada}
              {...atributosErro("comiteId")}
            >
              <option value="">Selecione…</option>
              {opcoesComites.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo id="descricao" rotulo="Descrição" erros={erros.descricao}>
            <textarea
              id="descricao"
              name="descricao"
              rows={4}
              maxLength={2000}
              defaultValue={valor("descricao")}
              className={classeEntrada}
              {...atributosErro("descricao")}
            />
          </Campo>
        </div>
        <Campo id="dataInicio" rotulo="Início" erros={erros.dataInicio}>
          <input
            id="dataInicio"
            name="dataInicio"
            type="date"
            defaultValue={valor("dataInicio")}
            className={classeEntrada}
            {...atributosErro("dataInicio")}
          />
        </Campo>
        <Campo id="dataFim" rotulo="Término" erros={erros.dataFim}>
          <input
            id="dataFim"
            name="dataFim"
            type="date"
            defaultValue={valor("dataFim")}
            className={classeEntrada}
            {...atributosErro("dataFim")}
          />
        </Campo>
      </div>

      {estado.duplicidades && estado.duplicidades.length > 0 && (
        <AvisoDuplicidades
          duplicidades={estado.duplicidades}
          caminho="/projetos-temas"
          titulo="Possível projeto ou tema repetido"
          confirmacao="Conferi e confirmo que não se trata do mesmo projeto ou tema."
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Salvando…" : estado.duplicidades?.length ? "Salvar mesmo assim" : "Salvar"}
        </button>
        <Link
          href={inicial.id ? `/projetos-temas/${inicial.id}` : "/projetos-temas"}
          className={classeBotaoSecundario}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
