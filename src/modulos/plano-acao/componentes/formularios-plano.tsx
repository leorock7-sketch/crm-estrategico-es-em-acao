"use client";

import { type ChangeEvent, useState } from "react";
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
import {
  alterarIniciativaDaAcao,
  converterCompromissoAcao,
  decidirVersaoAcao,
  enviarParaAprovacaoAcao,
  registrarAcompanhamentoDaAcao,
  salvarAcaoPlanejada,
  salvarEixo,
  salvarMarco,
  salvarPlano,
} from "../acoes";
import { PERIODICIDADES, PILARES_REFERENCIA_INFRAESTRUTURA, ROTULOS_PERIODICIDADE, ROTULOS_SITUACAO_ACAO, SITUACOES_ACAO } from "../rotulos";

export type OpcaoProjeto = { id: string; nome: string; comiteNome: string };
export type OpcaoEixoPlano = { id: string; codigo: string; nome: string };

export type ValoresPlano = { id?: string; titulo?: string; objetivo?: string | null; responsavelId?: string | null; projetoTemaId?: string };

/** Cadastro (um plano por projeto ou tema) ou edição dos dados gerais do plano. */
export function FormularioPlano({ inicial, projetos, usuarios }: { inicial: ValoresPlano; projetos: OpcaoProjeto[]; usuarios: OpcaoNome[] }) {
  const f = useFormularioRegistro(salvarPlano, { usarPilaresReferencia: "sim", ...inicial } as Record<string, unknown>, inicial.id ? `plano-${inicial.id}` : "plano-novo");
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-4">
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      <MensagensFormulario estado={f.estado} sucesso="Plano salvo." />
      <div className="grid gap-3 sm:grid-cols-2">
        {!inicial.id && (
          <div className="sm:col-span-2">
            <CampoSelecao
              id={f.id("projetoTemaId")}
              nome="projetoTemaId"
              rotulo="Projeto ou tema"
              valor={f.valor("projetoTemaId")}
              vazio="Selecione…"
              obrigatorio
              ajuda="Cada projeto ou tema tem um único plano de ação, que evolui por versões."
              erros={f.erros.projetoTemaId}
              atributos={f.atributosErro("projetoTemaId")}
            >
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.comiteNome})
                </option>
              ))}
            </CampoSelecao>
          </div>
        )}
        <div className="sm:col-span-2">
          <Campo id={f.id("titulo")} rotulo="Título do plano" obrigatorio erros={f.erros.titulo}>
            <input id={f.id("titulo")} name="titulo" required maxLength={200} defaultValue={f.valor("titulo")} className={classeEntrada} {...f.atributosErro("titulo")} />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo id={f.id("objetivo")} rotulo="Objetivo geral" erros={f.erros.objetivo}>
            <textarea id={f.id("objetivo")} name="objetivo" rows={3} maxLength={2000} defaultValue={f.valor("objetivo")} className={classeEntrada} />
          </Campo>
        </div>
        <CampoSelecao
          id={f.id("responsavelId")}
          nome="responsavelId"
          rotulo="Responsável pelo plano (equipe)"
          valor={f.valor("responsavelId")}
          vazio="Nenhum"
          erros={f.erros.responsavelId}
        >
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </CampoSelecao>
      </div>
      {!inicial.id && (
        <fieldset className="rounded-lg border border-borda p-4">
          <legend className="px-1 font-semibold">Pilares ou eixos</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="usarPilaresReferencia" value="sim" defaultChecked={f.valor("usarPilaresReferencia") === "sim"} className="mt-0.5 size-4" />
            <span>
              Começar com os cinco pilares de referência do Comitê de Infraestrutura (podem ser renomeados, arquivados ou
              complementados):
              <span className="mt-1 block text-xs text-texto-secundario">
                {PILARES_REFERENCIA_INFRAESTRUTURA.map((p) => `${p.codigo} ${p.nome}`).join(" · ")}
              </span>
            </span>
          </label>
          <p className="mt-2 text-xs text-texto-secundario">
            O modelo não é obrigatório: cada projeto ou tema pode ter os seus próprios pilares ou eixos.
          </p>
        </fieldset>
      )}
      <BotaoEnviar enviando={f.enviando} rotulo={inicial.id ? "Salvar alterações" : "Criar plano"} />
    </form>
  );
}

/** Inclui ou altera um pilar ou eixo do plano. */
export function FormularioEixo({
  planoId,
  eixo,
}: {
  planoId: string;
  eixo?: { id: string; nome: string; descricao: string | null; objetivo: string | null };
}) {
  const f = useFormularioRegistro(salvarEixo, { nome: eixo?.nome ?? "", descricao: eixo?.descricao ?? "", objetivo: eixo?.objetivo ?? "" }, `eixo-${eixo?.id ?? planoId}`);
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="planoAcaoId" value={planoId} />
      {eixo && <input type="hidden" name="id" value={eixo.id} />}
      <MensagensFormulario estado={f.estado} sucesso="Pilar ou eixo salvo." />
      <Campo id={f.id("nome")} rotulo="Nome" obrigatorio erros={f.erros.nome}>
        <input id={f.id("nome")} name="nome" required maxLength={200} defaultValue={f.valor("nome")} className={classeEntrada} {...f.atributosErro("nome")} />
      </Campo>
      <Campo id={f.id("objetivo")} rotulo="Objetivo estratégico neste projeto ou tema" erros={f.erros.objetivo}>
        <textarea id={f.id("objetivo")} name="objetivo" rows={2} maxLength={2000} defaultValue={f.valor("objetivo")} className={classeEntrada} />
      </Campo>
      <Campo id={f.id("descricao")} rotulo="Descrição" erros={f.erros.descricao}>
        <textarea id={f.id("descricao")} name="descricao" rows={2} maxLength={2000} defaultValue={f.valor("descricao")} className={classeEntrada} />
      </Campo>
      <BotaoEnviar enviando={f.enviando} rotulo={eixo ? "Salvar pilar ou eixo" : "Incluir pilar ou eixo"} />
    </form>
  );
}

export type ValoresAcaoPlanejada = {
  planejamentoId?: string;
  eixoId?: string | null;
  titulo?: string;
  descricao?: string | null;
  justificativa?: string | null;
  responsavelUsuarioId?: string | null;
  responsavelStakeholderId?: string | null;
  inicioPrevisto?: string | null;
  fimPrevisto?: string | null;
  periodicidade?: string | null;
  iniciativaId?: string | null;
};

/** Planejamento de uma ação na versão em rascunho (nova ação quando não há planejamento). */
export function FormularioAcaoPlanejada({
  versaoId,
  inicial = {},
  eixos,
  usuarios,
  pessoas,
  instituicoes,
  iniciativas,
}: {
  versaoId: string;
  inicial?: ValoresAcaoPlanejada;
  eixos: OpcaoEixoPlano[];
  usuarios: OpcaoNome[];
  pessoas: OpcaoNome[];
  instituicoes: OpcaoNome[];
  iniciativas: { id: string; titulo: string }[];
}) {
  const f = useFormularioRegistro(salvarAcaoPlanejada, inicial as Record<string, unknown>, `acao-${inicial.planejamentoId ?? versaoId}`);
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="versaoId" value={versaoId} />
      {inicial.planejamentoId && <input type="hidden" name="planejamentoId" value={inicial.planejamentoId} />}
      <MensagensFormulario estado={f.estado} sucesso="Ação salva nesta versão." />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo id={f.id("titulo")} rotulo="Ação" obrigatorio erros={f.erros.titulo}>
            <input id={f.id("titulo")} name="titulo" required maxLength={300} defaultValue={f.valor("titulo")} className={classeEntrada} {...f.atributosErro("titulo")} />
          </Campo>
        </div>
        <CampoSelecao id={f.id("eixoId")} nome="eixoId" rotulo="Pilar ou eixo" valor={f.valor("eixoId")} vazio="Nenhum" erros={f.erros.eixoId}>
          {eixos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.codigo} – {e.nome}
            </option>
          ))}
        </CampoSelecao>
        {!inicial.planejamentoId ? (
          <CampoSelecao
            id={f.id("iniciativaId")}
            nome="iniciativaId"
            rotulo="Iniciativa relacionada"
            valor={f.valor("iniciativaId")}
            vazio="Nenhuma"
            ajuda="A ligação com a iniciativa pode ser alterada depois, na página da ação."
            erros={f.erros.iniciativaId}
          >
            {iniciativas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.titulo}
              </option>
            ))}
          </CampoSelecao>
        ) : (
          <div />
        )}
        <div className="sm:col-span-2">
          <Campo id={f.id("descricao")} rotulo="Detalhamento" ajuda="Desdobramentos e subações." erros={f.erros.descricao}>
            <textarea id={f.id("descricao")} name="descricao" rows={3} maxLength={4000} defaultValue={f.valor("descricao")} className={classeEntrada} />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo id={f.id("justificativa")} rotulo="Justificativa" erros={f.erros.justificativa}>
            <textarea id={f.id("justificativa")} name="justificativa" rows={2} maxLength={2000} defaultValue={f.valor("justificativa")} className={classeEntrada} />
          </Campo>
        </div>
        <CampoSelecao
          id={f.id("responsavelUsuarioId")}
          nome="responsavelUsuarioId"
          rotulo="Responsável da equipe"
          valor={f.valor("responsavelUsuarioId")}
          vazio="Nenhum"
          ajuda="Informe ao menos um responsável, da equipe ou externo."
          erros={f.erros.responsavelUsuarioId}
          atributos={f.atributosErro("responsavelUsuarioId")}
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
        <Campo id={f.id("inicioPrevisto")} rotulo="Início previsto" erros={f.erros.inicioPrevisto}>
          <input id={f.id("inicioPrevisto")} name="inicioPrevisto" type="date" defaultValue={f.valor("inicioPrevisto")} className={classeEntrada} />
        </Campo>
        <Campo id={f.id("fimPrevisto")} rotulo="Prazo (fim previsto)" erros={f.erros.fimPrevisto}>
          <input
            id={f.id("fimPrevisto")}
            name="fimPrevisto"
            type="date"
            defaultValue={f.valor("fimPrevisto")}
            className={classeEntrada}
            {...f.atributosErro("fimPrevisto")}
          />
        </Campo>
        <CampoSelecao id={f.id("periodicidade")} nome="periodicidade" rotulo="Periodicidade de acompanhamento" valor={f.valor("periodicidade")} vazio="Não definida">
          {PERIODICIDADES.map((p) => (
            <option key={p} value={p}>
              {ROTULOS_PERIODICIDADE[p]}
            </option>
          ))}
        </CampoSelecao>
      </div>
      <BotaoEnviar enviando={f.enviando} rotulo={inicial.planejamentoId ? "Salvar ação" : "Incluir ação"} />
    </form>
  );
}

/** Inclui ou altera um marco (entrega verificável) da ação na versão em rascunho. */
export function FormularioMarco({
  versaoId,
  acaoId,
  marco,
}: {
  versaoId: string;
  acaoId: string;
  marco?: { id: string; descricao: string; prazoPrevisto: string | null };
}) {
  const f = useFormularioRegistro(salvarMarco, { descricao: marco?.descricao ?? "", prazoPrevisto: marco?.prazoPrevisto ?? "" }, `marco-${marco?.id ?? acaoId}`);
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="versaoId" value={versaoId} />
      <input type="hidden" name="acaoId" value={acaoId} />
      {marco && <input type="hidden" name="marcoPlanejamentoId" value={marco.id} />}
      <MensagensFormulario estado={f.estado} sucesso="Marco salvo nesta versão." />
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Campo id={f.id("descricao")} rotulo="Marco" obrigatorio ajuda="Entrega ou ponto verificável." erros={f.erros.descricao}>
          <input id={f.id("descricao")} name="descricao" required maxLength={500} defaultValue={f.valor("descricao")} className={classeEntrada} {...f.atributosErro("descricao")} />
        </Campo>
        <Campo id={f.id("prazoPrevisto")} rotulo="Prazo previsto" erros={f.erros.prazoPrevisto}>
          <input id={f.id("prazoPrevisto")} name="prazoPrevisto" type="date" defaultValue={f.valor("prazoPrevisto")} className={classeEntrada} />
        </Campo>
      </div>
      <BotaoEnviar enviando={f.enviando} rotulo={marco ? "Salvar marco" : "Incluir marco"} />
    </form>
  );
}

/** Envio do rascunho para aprovação, com o motivo (obrigatório a partir da versão 2). */
export function FormularioEnvio({ versaoId, exigeMotivo }: { versaoId: string; exigeMotivo: boolean }) {
  const f = useFormularioRegistro(enviarParaAprovacaoAcao, { motivoAlteracao: "" }, `envio-${versaoId}`);
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="versaoId" value={versaoId} />
      <MensagensFormulario estado={f.estado} sucesso="Versão enviada para aprovação." />
      <Campo
        id={f.id("motivoAlteracao")}
        rotulo="Motivo da alteração"
        obrigatorio={exigeMotivo}
        ajuda={exigeMotivo ? "Explique o que muda em relação à versão vigente e por quê." : "Opcional na primeira versão."}
        erros={f.erros.motivoAlteracao}
      >
        <textarea
          id={f.id("motivoAlteracao")}
          name="motivoAlteracao"
          rows={3}
          maxLength={2000}
          required={exigeMotivo}
          defaultValue={f.valor("motivoAlteracao")}
          className={classeEntrada}
        />
      </Campo>
      <BotaoEnviar enviando={f.enviando} rotulo="Enviar para aprovação" rotuloEnviando="Enviando…" />
    </form>
  );
}

/** Decisão sobre a versão em aprovação: aprovar, devolver para ajustes ou rejeitar, com parecer opcional. */
export function FormularioDecisao({ versaoId }: { versaoId: string }) {
  const f = useFormularioRegistro(decidirVersaoAcao, { decisao: "", parecer: "" }, `decisao-${versaoId}`);
  const opcoes = [
    { valor: "aprovada", rotulo: "Aprovar", ajuda: "A versão passa a vigorar; a vigente anterior fica como substituída." },
    { valor: "devolvida", rotulo: "Devolver para ajustes", ajuda: "A versão volta a rascunho para alterações." },
    { valor: "rejeitada", rotulo: "Rejeitar", ajuda: "A versão fica registrada como rejeitada; a vigente continua valendo." },
  ];
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="versaoId" value={versaoId} />
      <MensagensFormulario estado={f.estado} sucesso="Decisão registrada." />
      <fieldset>
        <legend className="text-sm font-medium">
          Decisão <span className="text-red-700 dark:text-red-400" aria-hidden="true">*</span>
        </legend>
        <div className="mt-2 flex flex-col gap-2">
          {opcoes.map((o) => (
            <label key={o.valor} className="flex items-start gap-2 text-sm">
              <input type="radio" name="decisao" value={o.valor} required defaultChecked={f.valor("decisao") === o.valor} className="mt-0.5 size-4" />
              <span>
                <span className="font-medium">{o.rotulo}</span>
                <span className="block text-xs text-texto-secundario">{o.ajuda}</span>
              </span>
            </label>
          ))}
        </div>
        {f.erros.decisao && <p className="text-sm text-red-700 dark:text-red-400">{f.erros.decisao.join(" ")}</p>}
      </fieldset>
      <Campo id={f.id("parecer")} rotulo="Parecer" erros={f.erros.parecer}>
        <textarea id={f.id("parecer")} name="parecer" rows={3} maxLength={2000} defaultValue={f.valor("parecer")} className={classeEntrada} />
      </Campo>
      <BotaoEnviar enviando={f.enviando} rotulo="Registrar decisão" rotuloEnviando="Registrando…" />
    </form>
  );
}

/** Acompanhamento da ação (sem aprovação): situação, percentual opcional, marco alcançado e observação. */
export function FormularioAcompanhamentoAcao({
  acaoId,
  hoje,
  marcos,
}: {
  acaoId: string;
  hoje: string;
  marcos: MarcoAcompanhamento[];
}) {
  const f = useFormularioRegistro(
    registrarAcompanhamentoDaAcao,
    { data: hoje, situacao: "", percentual: "", marcoId: "", marcoAlcancado: "sim", observacao: "" },
    `acompanhamento-${acaoId}`,
  );
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="acaoId" value={acaoId} />
      <MensagensFormulario estado={f.estado} sucesso="Acompanhamento registrado." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id={f.id("data")} rotulo="Data" obrigatorio erros={f.erros.data}>
          <input id={f.id("data")} name="data" type="date" required defaultValue={f.valor("data")} className={classeEntrada} {...f.atributosErro("data")} />
        </Campo>
        <CampoSelecao id={f.id("situacao")} nome="situacao" rotulo="Situação" valor={f.valor("situacao")} vazio="Sem mudança" erros={f.erros.situacao}>
          {SITUACOES_ACAO.map((s) => (
            <option key={s} value={s}>
              {ROTULOS_SITUACAO_ACAO[s]}
            </option>
          ))}
        </CampoSelecao>
        <CamposMarco f={f} marcos={marcos} />
        <div className="sm:col-span-2">
          <Campo id={f.id("observacao")} rotulo="Observação" erros={f.erros.observacao}>
            <textarea
              id={f.id("observacao")}
              name="observacao"
              rows={2}
              maxLength={2000}
              defaultValue={f.valor("observacao")}
              className={classeEntrada}
              {...f.atributosErro("observacao")}
            />
          </Campo>
        </div>
      </div>
      <BotaoEnviar enviando={f.enviando} rotulo="Registrar acompanhamento" rotuloEnviando="Registrando…" />
    </form>
  );
}

type MarcoAcompanhamento = { marcoId: string; codigo: string; descricao: string; alcancadoEm: string | null };

/** Marco e, conforme a escolha, a indicação de alcance ou o percentual; o estado reinicia com o formulário. */
function CamposMarco({
  f,
  marcos,
}: {
  f: ReturnType<typeof useFormularioRegistro<Record<string, unknown>>>;
  marcos: MarcoAcompanhamento[];
}) {
  const [marco, setMarco] = useState(f.valor("marcoId"));
  return (
    <>
      <CampoSelecao
        id={f.id("marcoId")}
        nome="marcoId"
        rotulo="Marco"
        valor={marco}
        vazio="Nenhum"
        erros={f.erros.marcoId}
        atributos={{ onChange: (e: ChangeEvent<HTMLSelectElement>) => setMarco(e.target.value) }}
      >
        {marcos.map((m) => (
          <option key={m.marcoId} value={m.marcoId}>
            {m.codigo} – {m.descricao}
            {m.alcancadoEm ? " (alcançado)" : ""}
          </option>
        ))}
      </CampoSelecao>
      {marco ? (
        <CampoSelecao
          id={f.id("marcoAlcancado")}
          nome="marcoAlcancado"
          rotulo="O marco foi alcançado?"
          valor={f.valor("marcoAlcancado") || "sim"}
          erros={f.erros.marcoAlcancado}
        >
          <option value="sim">Sim, alcançado</option>
          <option value="nao">Não (corrige registro anterior)</option>
        </CampoSelecao>
      ) : (
        <Campo
          id={f.id("percentual")}
          rotulo="Percentual de execução"
          ajuda="Complementar e opcional; os marcos são a medida principal."
          erros={f.erros.percentual}
        >
          <input
            id={f.id("percentual")}
            name="percentual"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={f.valor("percentual")}
            className={classeEntrada}
            {...f.atributosErro("percentual")}
          />
        </Campo>
      )}
    </>
  );
}

/** Liga a ação a uma iniciativa (ou desfaz a ligação); não altera o conteúdo planejado. */
export function FormularioIniciativaDaAcao({
  acaoId,
  iniciativaId,
  iniciativas,
}: {
  acaoId: string;
  iniciativaId: string | null;
  iniciativas: { id: string; titulo: string }[];
}) {
  const f = useFormularioRegistro(alterarIniciativaDaAcao, { iniciativaId: iniciativaId ?? "" }, `acao-iniciativa-${acaoId}`);
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="acaoId" value={acaoId} />
      <MensagensFormulario estado={f.estado} sucesso="Ligação atualizada." />
      <CampoSelecao id={f.id("iniciativaId")} nome="iniciativaId" rotulo="Iniciativa" valor={f.valor("iniciativaId")} vazio="Nenhuma">
        {iniciativas.map((i) => (
          <option key={i.id} value={i.id}>
            {i.titulo}
          </option>
        ))}
      </CampoSelecao>
      <BotaoEnviar enviando={f.enviando} rotulo="Salvar ligação" />
    </form>
  );
}

/** Converte o compromisso em ação do plano do projeto ou tema, preservando a origem. */
export function FormularioConversaoCompromisso({
  compromissoId,
  planos,
  eixos,
}: {
  compromissoId: string;
  planos: { id: string; titulo: string; projetoNome: string }[];
  eixos: (OpcaoEixoPlano & { planoAcaoId: string })[];
}) {
  const f = useFormularioRegistro(converterCompromissoAcao, { planoAcaoId: planos.length === 1 ? planos[0].id : "", eixoId: "" }, `conversao-${compromissoId}`);
  const [plano, setPlano] = useState(f.valor("planoAcaoId"));
  const doPlano = eixos.filter((e) => e.planoAcaoId === plano);
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-3">
      <input type="hidden" name="compromissoId" value={compromissoId} />
      <MensagensFormulario estado={f.estado} sucesso="Compromisso convertido." />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSelecao
          id={f.id("planoAcaoId")}
          nome="planoAcaoId"
          rotulo="Plano de ação"
          valor={plano}
          vazio="Selecione…"
          obrigatorio
          erros={f.erros.planoAcaoId}
          atributos={{ onChange: (e: ChangeEvent<HTMLSelectElement>) => setPlano(e.target.value) }}
        >
          {planos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.projetoNome} – {p.titulo}
            </option>
          ))}
        </CampoSelecao>
        <CampoSelecao id={f.id("eixoId")} nome="eixoId" rotulo="Pilar ou eixo" valor={f.valor("eixoId")} vazio="Nenhum" erros={f.erros.eixoId}>
          {doPlano.map((e) => (
            <option key={e.id} value={e.id}>
              {e.codigo} – {e.nome}
            </option>
          ))}
        </CampoSelecao>
      </div>
      <p className="text-xs text-texto-secundario">
        A ação entra na versão em rascunho do plano (criada a partir da vigente, se preciso) com a descrição, o responsável,
        o prazo e a iniciativa do compromisso, e depende de aprovação. O compromisso continua registrado, apontando para a ação.
      </p>
      <BotaoEnviar enviando={f.enviando} rotulo="Converter em ação do plano" rotuloEnviando="Convertendo…" />
    </form>
  );
}
