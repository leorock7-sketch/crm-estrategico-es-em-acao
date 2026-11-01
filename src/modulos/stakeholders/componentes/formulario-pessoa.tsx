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
import { type EstadoFormulario, salvarPessoa } from "../acoes";
import { AvisoDuplicidades } from "./aviso-duplicidades";

export type ValoresPessoa = {
  id?: string;
  nomeCompleto?: string;
  nomeTratamento?: string | null;
  email?: string | null;
  telefone?: string | null;
  observacoes?: string | null;
};

const ESTADO_INICIAL: EstadoFormulario = {};

/** Inclusão e edição de pessoa (dados mínimos — decisão D-021). */
export function FormularioPessoa({ inicial = {} }: { inicial?: ValoresPessoa }) {
  const [estado, acao, enviando] = useActionState(salvarPessoa, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: keyof ValoresPessoa) => estado.valores?.[campo] ?? inicial[campo] ?? "";
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
        <div className="sm:col-span-2">
          <Campo id="nomeCompleto" rotulo="Nome completo" obrigatorio erros={erros.nomeCompleto}>
            <input
              id="nomeCompleto"
              name="nomeCompleto"
              required
              maxLength={200}
              autoComplete="off"
              defaultValue={valor("nomeCompleto")}
              className={classeEntrada}
              {...atributosErro("nomeCompleto")}
            />
          </Campo>
        </div>
        <Campo
          id="nomeTratamento"
          rotulo="Nome de tratamento"
          ajuda="Como a pessoa prefere ser chamada."
          erros={erros.nomeTratamento}
        >
          <input
            id="nomeTratamento"
            name="nomeTratamento"
            maxLength={100}
            autoComplete="off"
            defaultValue={valor("nomeTratamento")}
            className={classeEntrada}
            {...atributosErro("nomeTratamento")}
          />
        </Campo>
        <Campo id="email" rotulo="E-mail" erros={erros.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            defaultValue={valor("email")}
            className={classeEntrada}
            {...atributosErro("email")}
          />
        </Campo>
        <Campo id="telefone" rotulo="Telefone" erros={erros.telefone}>
          <input
            id="telefone"
            name="telefone"
            type="tel"
            maxLength={40}
            autoComplete="off"
            defaultValue={valor("telefone")}
            className={classeEntrada}
            {...atributosErro("telefone")}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="observacoes" rotulo="Observações" erros={erros.observacoes}>
            <textarea
              id="observacoes"
              name="observacoes"
              rows={4}
              maxLength={2000}
              defaultValue={valor("observacoes")}
              className={classeEntrada}
              {...atributosErro("observacoes")}
            />
          </Campo>
        </div>
      </div>

      {estado.duplicidades && estado.duplicidades.length > 0 && (
        <AvisoDuplicidades duplicidades={estado.duplicidades} caminho="/pessoas" />
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Salvando…" : estado.duplicidades?.length ? "Salvar mesmo assim" : "Salvar"}
        </button>
        <Link href={inicial.id ? `/pessoas/${inicial.id}` : "/pessoas"} className={classeBotaoSecundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
