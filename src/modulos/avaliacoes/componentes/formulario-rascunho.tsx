"use client";

import { type ReactNode, useActionState, useState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo, idErroCampo } from "@/componentes/campo";
import { classeBotaoPrimario, classeBotaoSecundario, classeCartao, classeEntrada } from "@/componentes/estilos";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { salvarRascunhoAcao } from "../acoes";
import { calcularAlertas, type DadosParaAlertas } from "../alertas";
import { campoDaNota } from "../esquemas";
import {
  type DimensaoRubrica,
  GRAUS_CONFIANCA,
  NATUREZAS_POSICIONAMENTO,
  NIVEIS,
  NIVEIS_DA_RUBRICA,
  POSICIONAMENTOS,
  POSICIONAMENTOS_VIGENTES,
  ROTULO_NAO_AVALIADO,
  ROTULO_RESSALVAS_NAO_SE_APLICA,
  ROTULOS_DIMENSAO,
  ROTULOS_DIMENSAO_RUBRICA,
  ROTULOS_GRAU_CONFIANCA,
  ROTULOS_NATUREZA_POSICIONAMENTO,
  ROTULOS_NIVEL,
  ROTULOS_POSICIONAMENTO,
  ROTULOS_SITUACAO_RESSALVAS,
  rotuloNivelDaRubrica,
  SITUACOES_RESSALVAS,
} from "../rotulos";

export type CriterioDoFormulario = {
  id: string;
  dimensao: "poder" | "interesse";
  nome: string;
  descricao: string | null;
  escalaMinima: number;
  escalaMaxima: number;
};

export type RubricaDoFormulario = {
  dimensao: DimensaoRubrica;
  nivel: string;
  criterioOrientador: string;
  basesTipicas: string | null;
};

export type ValoresRascunho = {
  posicionamento: string | null;
  grauConfianca: string | null;
  justificativaConfianca: string | null;
  justificativa: string | null;
  validacaoInstitucional: string | null;
  dataReferencia: string | null;
  notas: Record<string, number>;
  nivelPoder?: string | null;
  nivelInteresse?: string | null;
  justificativaPoder?: string | null;
  justificativaInteresse?: string | null;
  justificativaPosicionamento?: string | null;
  naturezaPosicionamento?: string | null;
  situacaoRessalvas?: string | null;
  descricaoRessalvas?: string | null;
};

const ESTADO_INICIAL: EstadoFormulario = {};

const textoOuNulo = (valor: FormDataEntryValue | string | null | undefined) =>
  typeof valor === "string" && valor.trim() !== "" ? valor : null;

/** Dados do formulário usados pelos alertas orientativos (calculados a cada alteração). */
function dadosParaAlertas(ler: (campo: string) => FormDataEntryValue | string | null | undefined): DadosParaAlertas {
  return {
    posicionamento: textoOuNulo(ler("posicionamento")) as DadosParaAlertas["posicionamento"],
    naturezaPosicionamento: textoOuNulo(ler("naturezaPosicionamento")) as DadosParaAlertas["naturezaPosicionamento"],
    origemPosicionamento: textoOuNulo(ler("validacaoInstitucional")),
    situacaoRessalvas: textoOuNulo(ler("situacaoRessalvas")) as DadosParaAlertas["situacaoRessalvas"],
    descricaoRessalvas: textoOuNulo(ler("descricaoRessalvas")),
    justificativaPosicionamento: textoOuNulo(ler("justificativaPosicionamento")),
    grauConfianca: textoOuNulo(ler("grauConfianca")) as DadosParaAlertas["grauConfianca"],
  };
}

/**
 * Edição do rascunho. "Salvar rascunho" grava sem publicar; "Publicar" grava e
 * publica. Na escala V2.2, as rubricas orientam o julgamento (Q-66 1.0) e os
 * alertas orientativos NUNCA impedem salvar nem publicar (D-067): o banco
 * exige apenas a rastreabilidade mínima (justificativas e natureza da
 * informação). Na metodologia de demonstração, valem as regras da Etapa 2A.
 */
export function FormularioRascunho({
  versaoId,
  instituicao,
  criterios,
  inicial,
  escala = "demonstracao",
  rubricas = [],
}: {
  versaoId: string;
  /** Na demonstração, instituições exigem validação institucional para receber posicionamento (Etapa 2A). */
  instituicao: boolean;
  criterios: CriterioDoFormulario[];
  inicial: ValoresRascunho;
  /** "ordinal": escala V2.2 (níveis e três categorias); "demonstracao": notas por critério e cinco categorias. */
  escala?: "ordinal" | "demonstracao";
  rubricas?: RubricaDoFormulario[];
}) {
  const [estado, acao, enviando] = useActionState(salvarRascunhoAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const valor = (campo: keyof Omit<ValoresRascunho, "notas">) => estado.valores?.[campo] ?? inicial[campo] ?? "";
  const valorNota = (criterioId: string) =>
    estado.valores?.[campoDaNota(criterioId)] ?? (inicial.notas[criterioId] !== undefined ? String(inicial.notas[criterioId]) : "");
  const atributosErro = (campo: string) =>
    erros[campo] ? { "aria-invalid": true, "aria-describedby": idErroCampo(campo) } : {};
  const ordinal = escala === "ordinal";
  const [alertas, setAlertas] = useState(() => calcularAlertas(dadosParaAlertas((campo) => valor(campo as keyof Omit<ValoresRascunho, "notas">) as string)));

  const campoTexto = (campo: keyof Omit<ValoresRascunho, "notas">, rotulo: string, ajuda?: string, linhas = 2, maximo = 2000) => (
    <Campo id={campo} rotulo={rotulo} ajuda={ajuda} erros={erros[campo]}>
      <textarea
        id={campo}
        name={campo}
        rows={linhas}
        maxLength={maximo}
        defaultValue={valor(campo)}
        className={classeEntrada}
        {...atributosErro(campo)}
      />
    </Campo>
  );

  return (
    // A chave recria o formulário com os valores enviados (ver formulario-instituicao.tsx).
    <form
      key={JSON.stringify(estado.valores ?? {})}
      action={acao}
      onChange={(evento) => {
        const dados = new FormData(evento.currentTarget);
        setAlertas(calcularAlertas(dadosParaAlertas((campo) => dados.get(campo))));
      }}
      className={`${classeCartao} flex flex-col gap-5`}
    >
      <input type="hidden" name="versaoId" value={versaoId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Rascunho salvo.</Alerta>}

      {ordinal ? (
        <>
          <Secao titulo="Poder" rubrica={<Rubrica dimensao="poder" rubricas={rubricas} />}>
            <SeletorNivel campo="nivelPoder" rotulo="Nível de poder" valor={valor("nivelPoder")} erros={erros.nivelPoder} />
            {campoTexto(
              "justificativaPoder",
              "Justificativa do poder",
              "Obrigatória se o nível for classificado. Indique em que se apoia (documento, informação informal ou percepção). Capacidade plausível conta; hipótese meramente abstrata, não. A falta de sinais de Alto não prova Baixo.",
            )}
          </Secao>

          <Secao titulo="Interesse" rubrica={<Rubrica dimensao="interesse" rubricas={rubricas} />}>
            <SeletorNivel
              campo="nivelInteresse"
              rotulo="Nível de interesse"
              valor={valor("nivelInteresse")}
              erros={erros.nivelInteresse}
            />
            {campoTexto(
              "justificativaInteresse",
              "Justificativa do interesse",
              "Obrigatória se o nível for classificado. Presença ou ausência em reuniões não determina o interesse: o que decide é a relevância do projeto para o ator.",
            )}
          </Secao>

          <Secao titulo="Posicionamento" rubrica={<Rubrica dimensao="posicionamento" rubricas={rubricas} />}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                id="posicionamento"
                rotulo="Posicionamento"
                ajuda="“Não avaliado” é diferente de neutro. Apoio condicionado pode ser Favorável, com as condições nas ressalvas."
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
                  {POSICIONAMENTOS_VIGENTES.map((p) => (
                    <option key={p} value={p}>
                      {ROTULOS_POSICIONAMENTO[p]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo
                id="naturezaPosicionamento"
                rotulo="Natureza da informação"
                ajuda="Obrigatória se o posicionamento for classificado. Só a manifestação formal é posição confirmada; as demais são avaliação preliminar."
                erros={erros.naturezaPosicionamento}
              >
                <select
                  id="naturezaPosicionamento"
                  name="naturezaPosicionamento"
                  defaultValue={valor("naturezaPosicionamento")}
                  className={classeEntrada}
                  {...atributosErro("naturezaPosicionamento")}
                >
                  <option value="">Não informada</option>
                  {NATUREZAS_POSICIONAMENTO.map((n) => (
                    <option key={n} value={n}>
                      {ROTULOS_NATUREZA_POSICIONAMENTO[n]}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            {campoTexto(
              "validacaoInstitucional",
              "Origem da informação (quem, em que contexto)",
              "Por exemplo: conversa com o diretor responsável, declaração em reunião, ofício. Não apresente como posição oficial o que não for.",
              2,
              1000,
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                id="situacaoRessalvas"
                rotulo="Ressalvas relevantes"
                ajuda="Sem manifestação identificada, deixe “Não se aplica”. Percepções ainda não manifestadas vão para a justificativa, não para as ressalvas."
                erros={erros.situacaoRessalvas}
              >
                <select
                  id="situacaoRessalvas"
                  name="situacaoRessalvas"
                  defaultValue={valor("situacaoRessalvas")}
                  className={classeEntrada}
                  {...atributosErro("situacaoRessalvas")}
                >
                  <option value="">{ROTULO_RESSALVAS_NAO_SE_APLICA}</option>
                  {SITUACOES_RESSALVAS.map((s) => (
                    <option key={s} value={s}>
                      {ROTULOS_SITUACAO_RESSALVAS[s]}
                    </option>
                  ))}
                </select>
              </Campo>
              {campoTexto(
                "descricaoRessalvas",
                "Descrição das ressalvas",
                "Condições, objeções parciais ou exigências materialmente relevantes.",
              )}
            </div>
            {campoTexto(
              "justificativaPosicionamento",
              "Justificativa do posicionamento",
              "Obrigatória se o posicionamento for classificado. Na manifestação inconclusiva, registre a manifestação e a razão da indefinição.",
            )}
          </Secao>
        </>
      ) : (
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
          {instituicao && (
            <div className="sm:col-span-2">
              <Campo
                id="validacaoInstitucional"
                rotulo="Validação institucional (fonte e justificativa)"
                ajuda="Obrigatória, na metodologia de demonstração, para atribuir posicionamento a uma instituição."
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
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          id="grauConfianca"
          rotulo="Grau de confiança"
          ajuda="Expressa a segurança da avaliação, considerando a natureza da informação e se ela está confirmada (D-036, D-067)."
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

      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        <Campo
          id="justificativa"
          rotulo={ordinal ? "Síntese da avaliação" : "Justificativa da avaliação"}
          obrigatorio
          ajuda={
            ordinal
              ? "Obrigatória para publicar. Resuma a avaliação e o que mudou em relação à versão anterior, sem repetir as justificativas de cada dimensão."
              : "Obrigatória para publicar. Explique a avaliação com base nas evidências."
          }
          erros={erros.justificativa}
        >
          <textarea
            id="justificativa"
            name="justificativa"
            rows={4}
            maxLength={4000}
            defaultValue={valor("justificativa")}
            className={classeEntrada}
            {...atributosErro("justificativa")}
          />
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
      </div>

      {ordinal && <PainelAlertas alertas={alertas} />}

      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intencao" value="salvar" disabled={enviando} className={classeBotaoSecundario}>
          {enviando ? "Salvando…" : "Salvar rascunho"}
        </button>
        <button type="submit" name="intencao" value="publicar" disabled={enviando} className={classeBotaoPrimario}>
          {ordinal && alertas.length > 0 ? "Publicar mesmo assim" : "Publicar versão"}
        </button>
      </div>
      <p className="text-xs text-texto-secundario">
        Ao publicar, esta versão passa a ser a vigente e não pode mais ser alterada; a anterior fica preservada no
        histórico.{ordinal && " Os alertas mantidos ficam registrados na versão publicada."}
      </p>
    </form>
  );
}

function Secao({ titulo, rubrica, children }: { titulo: string; rubrica: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-borda p-4">
      <legend className="px-1 text-sm font-semibold">{titulo}</legend>
      {children}
      {rubrica}
    </fieldset>
  );
}

function SeletorNivel({
  campo,
  rotulo,
  valor,
  erros,
}: {
  campo: "nivelPoder" | "nivelInteresse";
  rotulo: string;
  valor: string;
  erros?: string[];
}) {
  return (
    <Campo id={campo} rotulo={rotulo} ajuda="“Não avaliado” quando as informações não bastarem para formar um julgamento." erros={erros}>
      <select
        id={campo}
        name={campo}
        defaultValue={valor}
        className={classeEntrada}
        {...(erros ? { "aria-invalid": true, "aria-describedby": idErroCampo(campo) } : {})}
      >
        <option value="">{ROTULO_NAO_AVALIADO}</option>
        {NIVEIS.map((n) => (
          <option key={n} value={n}>
            {ROTULOS_NIVEL[n]}
          </option>
        ))}
      </select>
    </Campo>
  );
}

/** Rubrica da dimensão como texto de ajuda (Q-66 1.0): orienta, não decide. */
function Rubrica({ dimensao, rubricas }: { dimensao: DimensaoRubrica; rubricas: RubricaDoFormulario[] }) {
  const daDimensao = NIVEIS_DA_RUBRICA[dimensao]
    .map((nivel) => rubricas.find((r) => r.dimensao === dimensao && r.nivel === nivel))
    .filter((r): r is RubricaDoFormulario => r !== undefined);
  if (daDimensao.length === 0) return null;
  return (
    <details className="rounded-md bg-fundo p-3 text-sm">
      <summary className="cursor-pointer font-medium">Rubrica de {ROTULOS_DIMENSAO_RUBRICA[dimensao].toLowerCase()} (orientação)</summary>
      <dl className="mt-2 flex flex-col gap-2">
        {daDimensao.map((r) => (
          <div key={r.nivel}>
            <dt className="font-medium">{rotuloNivelDaRubrica(r.nivel)}</dt>
            <dd className="text-texto-secundario">
              {r.criterioOrientador}
              {r.basesTipicas && <span className="mt-0.5 block text-xs">Bases típicas: {r.basesTipicas}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Alertas orientativos (D-067): informam, sem impedir salvar ou publicar. */
function PainelAlertas({ alertas }: { alertas: ReturnType<typeof calcularAlertas> }) {
  return (
    <section aria-labelledby="titulo-alertas" aria-live="polite" className="rounded-lg border border-borda p-4">
      <h3 id="titulo-alertas" className="text-sm font-semibold">
        Alertas orientativos ({alertas.length})
      </h3>
      {alertas.length === 0 ? (
        <p className="mt-1 text-xs text-texto-secundario">Nenhum alerta. Os alertas não impedem salvar nem publicar.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-texto-secundario">
            Possíveis inconsistências. Você pode manter a classificação, com justificativa: os alertas não impedem salvar
            nem publicar.
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {alertas.map((a) => (
              <li key={a.codigo} className="flex gap-2">
                <span aria-hidden="true">⚠</span>
                <span>{a.mensagem}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

