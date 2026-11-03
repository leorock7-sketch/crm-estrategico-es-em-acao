"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { CaixasSelecao } from "@/componentes/caixas-selecao";
import { classeBotaoPrimario, classeBotaoSecundario, classeCartao, classeEntrada } from "@/componentes/estilos";
import type { OpcaoProjetoTema, OpcaoUsuario } from "@/modulos/iniciativas/componentes/formulario-iniciativa";
import { ROTULOS_TIPO_INICIATIVA, type TipoIniciativa } from "@/modulos/iniciativas/rotulos";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { AvisoDuplicidades } from "@/modulos/stakeholders/componentes/aviso-duplicidades";
import { salvarInteracao } from "../acoes";
import { ROTULOS_SITUACAO_INTERACAO, ROTULOS_TIPO_INTERACAO, SITUACOES_INTERACAO, TIPOS_INTERACAO } from "../rotulos";

export type ValoresInteracao = {
  id?: string;
  tipo?: string;
  assunto?: string;
  inicio?: string;
  fim?: string;
  local?: string | null;
  resumo?: string | null;
  situacao?: string;
  /** Pré-seleções do cadastro (identificadores separados por vírgulas). */
  projetos?: string;
  iniciativas?: string;
  participantesExternos?: string;
  participantesInternos?: string;
};

export type OpcaoIniciativa = { id: string; titulo: string; tipo: TipoIniciativa };
type OpcaoStakeholder = { id: string; nome: string };

const ESTADO_INICIAL: EstadoFormulario = {};

/**
 * Registro de interação — feito uma única vez, já com os projetos, temas e
 * iniciativas para os quais ela contribui e com os participantes. Na edição,
 * só os dados da interação; ligações e participantes ficam na página dela.
 */
export function FormularioInteracao({
  inicial = {},
  projetos,
  iniciativas,
  pessoas,
  instituicoes,
  usuarios,
}: {
  inicial?: ValoresInteracao;
  projetos: OpcaoProjetoTema[];
  iniciativas: OpcaoIniciativa[];
  pessoas: OpcaoStakeholder[];
  instituicoes: OpcaoStakeholder[];
  usuarios: OpcaoUsuario[];
}) {
  const [estado, acao, enviando] = useActionState(salvarInteracao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: keyof ValoresInteracao) => estado.valores?.[campo] ?? inicial[campo] ?? "";
  const lista = (campo: keyof ValoresInteracao) => valor(campo).split(",").filter(Boolean);
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
            {TIPOS_INTERACAO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ROTULOS_TIPO_INTERACAO[tipo]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="situacao" rotulo="Situação" obrigatorio erros={erros.situacao}>
          <select
            id="situacao"
            name="situacao"
            required
            defaultValue={valor("situacao") || "realizada"}
            className={classeEntrada}
            {...atributosErro("situacao")}
          >
            {SITUACOES_INTERACAO.map((situacao) => (
              <option key={situacao} value={situacao}>
                {ROTULOS_SITUACAO_INTERACAO[situacao]}
              </option>
            ))}
          </select>
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="assunto" rotulo="Assunto" obrigatorio erros={erros.assunto}>
            <input id="assunto" name="assunto" required maxLength={300} defaultValue={valor("assunto")} className={classeEntrada} {...atributosErro("assunto")} />
          </Campo>
        </div>
        <Campo id="inicio" rotulo="Início (data e hora)" obrigatorio erros={erros.inicio}>
          <input
            id="inicio"
            name="inicio"
            type="datetime-local"
            required
            defaultValue={valor("inicio")}
            className={classeEntrada}
            {...atributosErro("inicio")}
          />
        </Campo>
        <Campo id="fim" rotulo="Término (data e hora)" erros={erros.fim}>
          <input id="fim" name="fim" type="datetime-local" defaultValue={valor("fim")} className={classeEntrada} {...atributosErro("fim")} />
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="local" rotulo="Local" ajuda="Endereço ou link da reunião virtual." erros={erros.local}>
            <input id="local" name="local" maxLength={300} defaultValue={valor("local")} className={classeEntrada} {...atributosErro("local")} />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo id="resumo" rotulo="Resumo" ajuda="Registro ou ata resumida. Use somente informações fictícias." erros={erros.resumo}>
            <textarea id="resumo" name="resumo" rows={4} maxLength={8000} defaultValue={valor("resumo")} className={classeEntrada} {...atributosErro("resumo")} />
          </Campo>
        </div>

        {novo && (
          <>
            <div className="sm:col-span-2">
              <p className="text-sm text-texto-secundario">
                A mesma reunião pode contribuir para várias iniciativas: marque todas aqui, sem registrá-la de novo.
                Ligue a interação a pelo menos um projeto, tema ou iniciativa.
              </p>
            </div>
            <CaixasSelecao
              id="iniciativas"
              nome="iniciativas"
              legenda="Iniciativas"
              grupos={[{ opcoes: iniciativas.map((i) => ({ id: i.id, rotulo: i.titulo, detalhe: ROTULOS_TIPO_INICIATIVA[i.tipo] })) }]}
              marcados={lista("iniciativas")}
              erros={erros.iniciativas}
            />
            <CaixasSelecao
              id="projetos"
              nome="projetos"
              legenda="Projetos e temas"
              grupos={[{ opcoes: projetos.map((p) => ({ id: p.id, rotulo: p.nome, detalhe: p.comiteNome })) }]}
              marcados={lista("projetos")}
              erros={erros.projetos}
            />
            <CaixasSelecao
              id="participantesExternos"
              nome="participantesExternos"
              legenda="Participantes externos"
              grupos={[
                { titulo: "Instituições", opcoes: instituicoes.map((o) => ({ id: o.id, rotulo: o.nome })) },
                { titulo: "Pessoas", opcoes: pessoas.map((o) => ({ id: o.id, rotulo: o.nome })) },
              ]}
              marcados={lista("participantesExternos")}
              erros={erros.participantesExternos}
            />
            <CaixasSelecao
              id="participantesInternos"
              nome="participantesInternos"
              legenda="Participantes da equipe"
              ajuda="Presença inicial: “presente” se a interação foi realizada; “convidado” se agendada."
              grupos={[{ opcoes: usuarios.map((u) => ({ id: u.id, rotulo: u.nome })) }]}
              marcados={lista("participantesInternos")}
              erros={erros.participantesInternos}
            />
          </>
        )}
      </div>

      {estado.duplicidades && estado.duplicidades.length > 0 && (
        <AvisoDuplicidades
          duplicidades={estado.duplicidades}
          caminho="/interacoes"
          titulo="Possível interação já registrada"
          confirmacao="Conferi e confirmo que não se trata da mesma interação."
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Salvando…" : estado.duplicidades?.length ? "Salvar mesmo assim" : "Salvar"}
        </button>
        <Link href={inicial.id ? `/interacoes/${inicial.id}` : "/interacoes"} className={classeBotaoSecundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
