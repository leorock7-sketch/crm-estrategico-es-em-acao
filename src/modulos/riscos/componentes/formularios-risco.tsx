"use client";

import { useState } from "react";
import { Campo } from "@/componentes/campo";
import { classeEntrada } from "@/componentes/estilos";
import {
  BotaoEnviar,
  CampoSelecao,
  MensagensFormulario,
  type OpcaoNome,
  OpcoesStakeholders,
  useFormularioRegistro,
} from "@/componentes/formulario-registro";
import { registrarAvaliacaoAcao, registrarOcorrenciaGatilhoAcao, salvarGatilho, salvarResposta, salvarRisco } from "../acoes";
import {
  classificar,
  criticidade,
  DESCRICOES_SITUACAO_RISCO,
  DESCRICOES_TIPO_AVALIACAO,
  ESTRATEGIAS_RESPOSTA,
  FAIXAS,
  IMPACTOS,
  NIVEIS_5,
  PROBABILIDADES,
  ROTULOS_ESTRATEGIA,
  ROTULOS_SITUACAO_RESPOSTA,
  ROTULOS_SITUACAO_RISCO,
  ROTULOS_TIPO_AVALIACAO,
  SIGNIFICADO_GATILHO,
  SITUACOES_RESPOSTA,
  SITUACOES_RISCO,
  TIPOS_AVALIACAO,
} from "../rotulos";

export type OpcaoEixo = { id: string; codigo: string; nome: string; projetoTemaId: string };
export type OpcaoProjeto = { id: string; nome: string; comiteNome: string };
export type OpcaoAcao = { id: string; codigo: string; titulo: string; projetoNome: string };

type Formulario = ReturnType<typeof useFormularioRegistro<Record<string, unknown>>>;

/**
 * Probabilidade, impacto (com os critérios da matriz original), data,
 * justificativa e responsável pela avaliação, com a criticidade e a
 * classificação calculadas na hora.
 */
function CamposAvaliacao({ f, usuarios }: { f: Formulario; usuarios: OpcaoNome[] }) {
  const [p, setP] = useState(f.valor("probabilidade"));
  const [i, setI] = useState(f.valor("impacto"));
  const valor = p && i ? criticidade(Number(p), Number(i)) : null;
  const faixa = valor ? FAIXAS[classificar(valor)] : null;
  return (
    <>
      <Campo
        id={f.id("probabilidade")}
        rotulo="Probabilidade"
        obrigatorio
        ajuda={p ? PROBABILIDADES[Number(p) as 1].criterio : "Escala de 1 (remota) a 5 (muito alta)."}
        erros={f.erros.probabilidade}
      >
        <select
          id={f.id("probabilidade")}
          name="probabilidade"
          required
          value={p}
          onChange={(e) => setP(e.target.value)}
          className={classeEntrada}
          {...f.atributosErro("probabilidade")}
        >
          <option value="">Selecione…</option>
          {NIVEIS_5.map((n) => (
            <option key={n} value={n}>
              {n} – {PROBABILIDADES[n].rotulo}
            </option>
          ))}
        </select>
      </Campo>
      <Campo
        id={f.id("impacto")}
        rotulo="Impacto"
        obrigatorio
        ajuda={i ? IMPACTOS[Number(i) as 1].criterio : "Escala de 1 (muito baixo) a 5 (muito alto)."}
        erros={f.erros.impacto}
      >
        <select
          id={f.id("impacto")}
          name="impacto"
          required
          value={i}
          onChange={(e) => setI(e.target.value)}
          className={classeEntrada}
          {...f.atributosErro("impacto")}
        >
          <option value="">Selecione…</option>
          {NIVEIS_5.map((n) => (
            <option key={n} value={n}>
              {n} – {IMPACTOS[n].rotulo}
            </option>
          ))}
        </select>
      </Campo>
      <div className="sm:col-span-2" aria-live="polite">
        {faixa && valor ? (
          <p className="rounded-lg border border-black/10 px-3 py-2 text-sm" style={{ backgroundColor: faixa.cor, color: "#1f2937" }}>
            Criticidade <strong className="tabular-nums">{valor}</strong> ({p} × {i}) · <strong>{faixa.rotulo}</strong> ·{" "}
            {faixa.prioridade}
          </p>
        ) : (
          <p className="text-sm text-texto-secundario">Criticidade = probabilidade × impacto (de 1 a 25).</p>
        )}
      </div>
      <Campo id={f.id("dataAvaliacao")} rotulo="Data da avaliação" obrigatorio erros={f.erros.dataAvaliacao}>
        <input
          id={f.id("dataAvaliacao")}
          name="dataAvaliacao"
          type="date"
          required
          defaultValue={f.valor("dataAvaliacao")}
          className={classeEntrada}
          {...f.atributosErro("dataAvaliacao")}
        />
      </Campo>
      <CampoSelecao
        id={f.id("avaliadoPor")}
        nome="avaliadoPor"
        rotulo="Responsável pela avaliação"
        valor={f.valor("avaliadoPor")}
        vazio="Selecione…"
        obrigatorio
        erros={f.erros.avaliadoPor}
        atributos={f.atributosErro("avaliadoPor")}
      >
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nome}
          </option>
        ))}
      </CampoSelecao>
      <div className="sm:col-span-2">
        <Campo
          id={f.id("justificativa")}
          rotulo="Justificativa"
          obrigatorio
          ajuda="Fundamente a probabilidade e o impacto atribuídos."
          erros={f.erros.justificativa}
        >
          <textarea
            id={f.id("justificativa")}
            name="justificativa"
            required
            rows={3}
            maxLength={2000}
            defaultValue={f.valor("justificativa")}
            className={classeEntrada}
            {...f.atributosErro("justificativa")}
          />
        </Campo>
      </div>
    </>
  );
}

export type ValoresRisco = {
  id?: string;
  projetoTemaId?: string;
  titulo?: string;
  descricao?: string | null;
  causa?: string | null;
  consequencia?: string | null;
  controlesExistentes?: string | null;
  eixoId?: string | null;
  iniciativaId?: string | null;
  responsavelId?: string | null;
  situacao?: string;
  proximaRevisao?: string | null;
  dataAvaliacao?: string;
  avaliadoPor?: string;
};

/** Cadastro (com a avaliação do risco inerente) ou edição de risco. */
export function FormularioRisco({
  inicial,
  projetos,
  eixos,
  iniciativas,
  usuarios,
}: {
  inicial: ValoresRisco;
  projetos: OpcaoProjeto[];
  eixos: OpcaoEixo[];
  iniciativas: { id: string; titulo: string }[];
  usuarios: OpcaoNome[];
}) {
  const f = useFormularioRegistro(salvarRisco, inicial as Record<string, unknown>, inicial.id ? `risco-${inicial.id}` : "risco-novo");
  const [projeto, setProjeto] = useState(f.valor("projetoTemaId"));
  const eixosDoProjeto = eixos.filter((e) => e.projetoTemaId === projeto);
  const texto = (campo: string, rotulo: string, linhas: number, ajuda?: string) => (
    <div className="sm:col-span-2">
      <Campo id={f.id(campo)} rotulo={rotulo} ajuda={ajuda} erros={f.erros[campo]}>
        <textarea
          id={f.id(campo)}
          name={campo}
          rows={linhas}
          maxLength={campo === "descricao" ? 4000 : 2000}
          defaultValue={f.valor(campo)}
          className={classeEntrada}
          {...f.atributosErro(campo)}
        />
      </Campo>
    </div>
  );
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-4">
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      <MensagensFormulario estado={f.estado} sucesso="Risco salvo." />
      <div className="grid gap-3 sm:grid-cols-2">
        {!inicial.id && (
          <Campo id={f.id("projetoTemaId")} rotulo="Projeto ou tema" obrigatorio erros={f.erros.projetoTemaId}>
            <select
              id={f.id("projetoTemaId")}
              name="projetoTemaId"
              required
              value={projeto}
              onChange={(e) => setProjeto(e.target.value)}
              className={classeEntrada}
              {...f.atributosErro("projetoTemaId")}
            >
              <option value="">Selecione…</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.comiteNome})
                </option>
              ))}
            </select>
          </Campo>
        )}
        <CampoSelecao
          id={f.id("eixoId")}
          nome="eixoId"
          rotulo="Pilar ou eixo"
          valor={f.valor("eixoId")}
          vazio={eixosDoProjeto.length ? "Nenhum" : "O plano do projeto não tem pilares ou eixos"}
          ajuda="Os pilares ou eixos vêm do plano de ação do mesmo projeto ou tema."
          erros={f.erros.eixoId}
          atributos={f.atributosErro("eixoId")}
        >
          {eixosDoProjeto.map((e) => (
            <option key={e.id} value={e.id}>
              {e.codigo} – {e.nome}
            </option>
          ))}
        </CampoSelecao>
        <div className="sm:col-span-2">
          <Campo id={f.id("titulo")} rotulo="Risco" obrigatorio ajuda="Descreva o evento de risco em uma frase." erros={f.erros.titulo}>
            <input
              id={f.id("titulo")}
              name="titulo"
              required
              maxLength={300}
              defaultValue={f.valor("titulo")}
              className={classeEntrada}
              {...f.atributosErro("titulo")}
            />
          </Campo>
        </div>
        {texto("descricao", "Descrição", 3)}
        {texto("causa", "Causa", 2)}
        {texto("consequencia", "Consequência", 2)}
        {texto("controlesExistentes", "Controles existentes", 2, "Controles já implementados. Medidas apenas planejadas vão em Respostas.")}
        <CampoSelecao
          id={f.id("situacao")}
          nome="situacao"
          rotulo="Status"
          valor={f.valor("situacao") || "aberto"}
          obrigatorio
          ajuda={DESCRICOES_SITUACAO_RISCO[(f.valor("situacao") || "aberto") as "aberto"]}
          erros={f.erros.situacao}
          atributos={f.atributosErro("situacao")}
        >
          {SITUACOES_RISCO.map((s) => (
            <option key={s} value={s}>
              {ROTULOS_SITUACAO_RISCO[s]}
            </option>
          ))}
        </CampoSelecao>
        <CampoSelecao
          id={f.id("responsavelId")}
          nome="responsavelId"
          rotulo="Dono do risco (equipe)"
          valor={f.valor("responsavelId")}
          vazio="Nenhum"
          erros={f.erros.responsavelId}
          atributos={f.atributosErro("responsavelId")}
        >
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </CampoSelecao>
        <CampoSelecao
          id={f.id("iniciativaId")}
          nome="iniciativaId"
          rotulo="Iniciativa relacionada"
          valor={f.valor("iniciativaId")}
          vazio="Nenhuma"
          erros={f.erros.iniciativaId}
          atributos={f.atributosErro("iniciativaId")}
        >
          {iniciativas.map((i) => (
            <option key={i.id} value={i.id}>
              {i.titulo}
            </option>
          ))}
        </CampoSelecao>
        <Campo id={f.id("proximaRevisao")} rotulo="Próxima revisão" erros={f.erros.proximaRevisao}>
          <input
            id={f.id("proximaRevisao")}
            name="proximaRevisao"
            type="date"
            defaultValue={f.valor("proximaRevisao")}
            className={classeEntrada}
            {...f.atributosErro("proximaRevisao")}
          />
        </Campo>
      </div>
      {!inicial.id && (
        <fieldset className="rounded-lg border border-borda p-4">
          <legend className="px-1 font-semibold">Avaliação do risco inerente</legend>
          <p className="mb-3 text-sm text-texto-secundario">{DESCRICOES_TIPO_AVALIACAO.inerente}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CamposAvaliacao f={f} usuarios={usuarios} />
          </div>
        </fieldset>
      )}
      <BotaoEnviar enviando={f.enviando} rotulo={inicial.id ? "Salvar alterações" : "Registrar risco"} />
    </form>
  );
}

/** Nova avaliação (ou reavaliação) inerente ou residual; as anteriores ficam no histórico. */
export function FormularioAvaliacao({ riscoId, hoje, usuarios }: { riscoId: string; hoje: string; usuarios: OpcaoNome[] }) {
  const f = useFormularioRegistro(
    registrarAvaliacaoAcao,
    { tipo: "residual", dataAvaliacao: hoje, probabilidade: "", impacto: "", justificativa: "", avaliadoPor: "" },
    `avaliacao-${riscoId}`,
  );
  const [tipo, setTipo] = useState(f.valor("tipo"));
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="riscoId" value={riscoId} />
      <MensagensFormulario estado={f.estado} sucesso="Avaliação registrada." />
      <fieldset>
        <legend className="text-sm font-medium">Tipo da avaliação</legend>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:gap-6">
          {TIPOS_AVALIACAO.map((t) => (
            <label key={t} className="flex items-start gap-2 text-sm">
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="mt-0.5 size-4" />
              <span>
                <span className="font-medium">{ROTULOS_TIPO_AVALIACAO[t]}</span>
                <span className="block text-xs text-texto-secundario">{DESCRICOES_TIPO_AVALIACAO[t]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <CamposAvaliacao f={f} usuarios={usuarios} />
      </div>
      <BotaoEnviar enviando={f.enviando} rotulo="Registrar avaliação" rotuloEnviando="Registrando…" />
    </form>
  );
}

/** Inclui ou altera a descrição de um gatilho (sinal de alerta). */
export function FormularioGatilho({ riscoId, gatilho }: { riscoId: string; gatilho?: { id: string; descricao: string } }) {
  const f = useFormularioRegistro(salvarGatilho, { descricao: gatilho?.descricao ?? "" }, `gatilho-${gatilho?.id ?? riscoId}`);
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="riscoId" value={riscoId} />
      {gatilho && <input type="hidden" name="id" value={gatilho.id} />}
      <MensagensFormulario estado={f.estado} sucesso="Gatilho salvo." />
      <Campo id={f.id("descricao")} rotulo="Gatilho" obrigatorio ajuda="Sinal observável de que o risco está se materializando." erros={f.erros.descricao}>
        <textarea
          id={f.id("descricao")}
          name="descricao"
          required
          rows={2}
          maxLength={1000}
          defaultValue={f.valor("descricao")}
          className={classeEntrada}
          {...f.atributosErro("descricao")}
        />
      </Campo>
      <BotaoEnviar enviando={f.enviando} rotulo={gatilho ? "Salvar gatilho" : "Incluir gatilho"} />
    </form>
  );
}

/** Registro do acompanhamento do gatilho: ocorreu ou não, com observação. */
export function FormularioOcorrenciaGatilho({ gatilhoId, hoje }: { gatilhoId: string; hoje: string }) {
  const f = useFormularioRegistro(registrarOcorrenciaGatilhoAcao, { data: hoje, ocorrido: "", observacao: "" }, `ocorrencia-${gatilhoId}`);
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="gatilhoId" value={gatilhoId} />
      <MensagensFormulario estado={f.estado} sucesso="Acompanhamento registrado." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id={f.id("data")} rotulo="Data" obrigatorio erros={f.erros.data}>
          <input id={f.id("data")} name="data" type="date" required defaultValue={f.valor("data")} className={classeEntrada} {...f.atributosErro("data")} />
        </Campo>
        <fieldset>
          <legend className="text-sm font-medium">
            O gatilho ocorreu? <span className="text-red-700 dark:text-red-400" aria-hidden="true">*</span>
          </legend>
          <div className="mt-2 flex gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="ocorrido" value="sim" required defaultChecked={f.valor("ocorrido") === "sim"} className="size-4" />
              Sim
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="ocorrido" value="nao" defaultChecked={f.valor("ocorrido") === "nao"} className="size-4" />
              Não
            </label>
          </div>
          {f.erros.ocorrido && <p className="text-sm text-red-700 dark:text-red-400">{f.erros.ocorrido.join(" ")}</p>}
        </fieldset>
        <div className="sm:col-span-2">
          <Campo id={f.id("observacao")} rotulo="Observação" erros={f.erros.observacao}>
            <textarea id={f.id("observacao")} name="observacao" rows={2} maxLength={2000} defaultValue={f.valor("observacao")} className={classeEntrada} />
          </Campo>
        </div>
      </div>
      <p className="text-xs text-texto-secundario">
        Sim: {SIGNIFICADO_GATILHO.ocorrido} Não: {SIGNIFICADO_GATILHO.naoOcorrido} O registro não altera a avaliação do risco.
      </p>
      <BotaoEnviar enviando={f.enviando} rotulo="Registrar" rotuloEnviando="Registrando…" />
    </form>
  );
}

export type ValoresResposta = {
  id?: string;
  estrategia?: string;
  descricao?: string;
  responsavelUsuarioId?: string | null;
  responsavelStakeholderId?: string | null;
  prazo?: string | null;
  situacao?: string;
  acaoId?: string | null;
};

/** Medida de resposta (evitar, mitigar, transferir ou aceitar), que pode apontar para uma ação existente do plano. */
export function FormularioResposta({
  riscoId,
  inicial = {},
  usuarios,
  pessoas,
  instituicoes,
  acoes,
}: {
  riscoId: string;
  inicial?: ValoresResposta;
  usuarios: OpcaoNome[];
  pessoas: OpcaoNome[];
  instituicoes: OpcaoNome[];
  acoes: OpcaoAcao[];
}) {
  const f = useFormularioRegistro(salvarResposta, inicial as Record<string, unknown>, `resposta-${inicial.id ?? riscoId}`);
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="riscoId" value={riscoId} />
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      <MensagensFormulario estado={f.estado} sucesso="Medida salva." />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSelecao
          id={f.id("estrategia")}
          nome="estrategia"
          rotulo="Estratégia"
          valor={f.valor("estrategia")}
          vazio="Selecione…"
          obrigatorio
          erros={f.erros.estrategia}
          atributos={f.atributosErro("estrategia")}
        >
          {ESTRATEGIAS_RESPOSTA.map((e) => (
            <option key={e} value={e}>
              {ROTULOS_ESTRATEGIA[e]}
            </option>
          ))}
        </CampoSelecao>
        <CampoSelecao
          id={f.id("situacao")}
          nome="situacao"
          rotulo="Situação"
          valor={f.valor("situacao") || "planejada"}
          obrigatorio
          erros={f.erros.situacao}
          atributos={f.atributosErro("situacao")}
        >
          {SITUACOES_RESPOSTA.map((s) => (
            <option key={s} value={s}>
              {ROTULOS_SITUACAO_RESPOSTA[s]}
            </option>
          ))}
        </CampoSelecao>
        <div className="sm:col-span-2">
          <Campo id={f.id("descricao")} rotulo="Medida" obrigatorio erros={f.erros.descricao}>
            <textarea
              id={f.id("descricao")}
              name="descricao"
              required
              rows={2}
              maxLength={2000}
              defaultValue={f.valor("descricao")}
              className={classeEntrada}
              {...f.atributosErro("descricao")}
            />
          </Campo>
        </div>
        <CampoSelecao
          id={f.id("responsavelUsuarioId")}
          nome="responsavelUsuarioId"
          rotulo="Responsável da equipe"
          valor={f.valor("responsavelUsuarioId")}
          vazio="Nenhum"
          erros={f.erros.responsavelUsuarioId}
        >
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </CampoSelecao>
        <CampoSelecao
          id={f.id("responsavelStakeholderId")}
          nome="responsavelStakeholderId"
          rotulo="Responsável externo"
          valor={f.valor("responsavelStakeholderId")}
          vazio="Nenhum"
          erros={f.erros.responsavelStakeholderId}
        >
          <OpcoesStakeholders pessoas={pessoas} instituicoes={instituicoes} />
        </CampoSelecao>
        <Campo id={f.id("prazo")} rotulo="Prazo" erros={f.erros.prazo}>
          <input id={f.id("prazo")} name="prazo" type="date" defaultValue={f.valor("prazo")} className={classeEntrada} {...f.atributosErro("prazo")} />
        </Campo>
        <CampoSelecao
          id={f.id("acaoId")}
          nome="acaoId"
          rotulo="Ação do plano"
          valor={f.valor("acaoId")}
          vazio="Nenhuma"
          ajuda="Se a medida já é uma ação do Plano de Ação, aponte para ela em vez de duplicá-la."
          erros={f.erros.acaoId}
        >
          {acoes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigo} – {a.titulo} ({a.projetoNome})
            </option>
          ))}
        </CampoSelecao>
      </div>
      <p className="text-xs text-texto-secundario">
        Registrar uma medida não reduz a avaliação do risco. Depois que os controles estiverem efetivamente implementados,
        registre a avaliação residual com a justificativa.
      </p>
      <BotaoEnviar enviando={f.enviando} rotulo={inicial.id ? "Salvar medida" : "Incluir medida"} />
    </form>
  );
}
