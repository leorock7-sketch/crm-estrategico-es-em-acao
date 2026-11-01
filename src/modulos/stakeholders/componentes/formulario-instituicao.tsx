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
import { type EstadoFormulario, salvarInstituicao } from "../acoes";
import { ESFERAS, NATUREZAS, ROTULOS_ESFERA, ROTULOS_NATUREZA, UFS } from "../rotulos";
import { AvisoDuplicidades } from "./aviso-duplicidades";

export type ValoresInstituicao = {
  id?: string;
  nome?: string;
  sigla?: string | null;
  natureza?: string;
  esfera?: string | null;
  cnpj?: string | null;
  uf?: string | null;
  municipio?: string | null;
  site?: string | null;
  instituicaoSuperiorId?: string | null;
};

export type OpcaoInstituicao = { id: string; nome: string; sigla: string | null };

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioInstituicao({
  inicial = {},
  opcoesSuperior,
}: {
  inicial?: ValoresInstituicao;
  opcoesSuperior: OpcaoInstituicao[];
}) {
  const [estado, acao, enviando] = useActionState(salvarInstituicao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: keyof ValoresInstituicao) =>
    estado.valores?.[campo] ?? inicial[campo] ?? "";
  const atributosErro = (campo: string) =>
    erros[campo] ? { "aria-invalid": true, "aria-describedby": idErroCampo(campo) } : {};
  const superiores = opcoesSuperior.filter((opcao) => opcao.id !== inicial.id);

  return (
    // A chave recria o formulário com os valores enviados: após um erro, o React
    // reinicia o formulário e não reaplica o valor padrão das listas de seleção.
    <form
      key={JSON.stringify(estado.valores ?? {})}
      action={acao}
      className={`${classeCartao} flex flex-col gap-5`}
    >
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}

      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}

      <div className="grid gap-5 sm:grid-cols-2">
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
        <Campo id="sigla" rotulo="Sigla" erros={erros.sigla}>
          <input
            id="sigla"
            name="sigla"
            maxLength={30}
            autoComplete="off"
            defaultValue={valor("sigla")}
            className={classeEntrada}
            {...atributosErro("sigla")}
          />
        </Campo>
        <Campo id="natureza" rotulo="Natureza" obrigatorio erros={erros.natureza}>
          <select
            id="natureza"
            name="natureza"
            required
            defaultValue={valor("natureza")}
            className={classeEntrada}
            {...atributosErro("natureza")}
          >
            <option value="">Selecione…</option>
            {NATUREZAS.map((natureza) => (
              <option key={natureza} value={natureza}>
                {ROTULOS_NATUREZA[natureza]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="esfera" rotulo="Esfera" erros={erros.esfera}>
          <select
            id="esfera"
            name="esfera"
            defaultValue={valor("esfera")}
            className={classeEntrada}
            {...atributosErro("esfera")}
          >
            <option value="">Não informada</option>
            {ESFERAS.map((esfera) => (
              <option key={esfera} value={esfera}>
                {ROTULOS_ESFERA[esfera]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          id="cnpj"
          rotulo="CNPJ"
          ajuda="Com ou sem pontuação. Aceita também o novo CNPJ alfanumérico."
          erros={erros.cnpj}
        >
          <input
            id="cnpj"
            name="cnpj"
            maxLength={18}
            autoComplete="off"
            defaultValue={valor("cnpj")}
            className={`${classeEntrada} uppercase`}
            {...atributosErro("cnpj")}
          />
        </Campo>
        <Campo id="uf" rotulo="UF" erros={erros.uf}>
          <select
            id="uf"
            name="uf"
            defaultValue={valor("uf")}
            className={classeEntrada}
            {...atributosErro("uf")}
          >
            <option value="">Não informada</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="municipio" rotulo="Município" erros={erros.municipio}>
          <input
            id="municipio"
            name="municipio"
            maxLength={100}
            autoComplete="off"
            defaultValue={valor("municipio")}
            className={classeEntrada}
            {...atributosErro("municipio")}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="site" rotulo="Site" erros={erros.site}>
            <input
              id="site"
              name="site"
              type="url"
              placeholder="https://"
              maxLength={300}
              defaultValue={valor("site")}
              className={classeEntrada}
              {...atributosErro("site")}
            />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo
            id="instituicaoSuperiorId"
            rotulo="Instituição superior"
            ajuda="Por exemplo, o governo ao qual uma secretaria está vinculada."
            erros={erros.instituicaoSuperiorId}
          >
            <select
              id="instituicaoSuperiorId"
              name="instituicaoSuperiorId"
              defaultValue={valor("instituicaoSuperiorId")}
              className={classeEntrada}
              {...atributosErro("instituicaoSuperiorId")}
            >
              <option value="">Nenhuma</option>
              {superiores.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.sigla ? `${opcao.nome} (${opcao.sigla})` : opcao.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </div>

      {estado.duplicidades && estado.duplicidades.length > 0 && (
        <AvisoDuplicidades duplicidades={estado.duplicidades} caminho="/instituicoes" />
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Salvando…" : estado.duplicidades?.length ? "Salvar mesmo assim" : "Salvar"}
        </button>
        <Link
          href={inicial.id ? `/instituicoes/${inicial.id}` : "/instituicoes"}
          className={classeBotaoSecundario}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
