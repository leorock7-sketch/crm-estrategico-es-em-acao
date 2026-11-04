import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { BotaoAcaoRegistro } from "@/componentes/botao-acao-registro";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeCartao, classeLink } from "@/componentes/estilos";
import { FormularioStakeholderRelacionado } from "@/componentes/formulario-registro";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData, hojeEmBrasilia } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { HistoricoAtividade } from "@/modulos/iniciativas/componentes/historico-atividade";
import { opcoesIniciativas } from "@/modulos/iniciativas/consultas";
import { nomesDoHistorico } from "@/modulos/iniciativas/historico";
import { incluirStakeholderNaAcaoAcao, retirarStakeholderDaAcaoAcao } from "@/modulos/plano-acao/acoes";
import { FormularioAcompanhamentoAcao, FormularioIniciativaDaAcao } from "@/modulos/plano-acao/componentes/formularios-plano";
import { ProgressoMarcos, SeloAcao, SeloVersao } from "@/modulos/plano-acao/componentes/selos";
import {
  acoesVigentes,
  acompanhamentosDaAcao,
  compromissosDaAcao,
  historicoDaAcao,
  obterAcao,
  planejamentosDaAcao,
  planoEhVisivel,
  stakeholdersDaAcao,
} from "@/modulos/plano-acao/consultas";
import { marcoAtrasado, ROTULOS_PERIODICIDADE, ROTULOS_SITUACAO_ACAO } from "@/modulos/plano-acao/rotulos";
import { opcoesStakeholders } from "@/modulos/projetos-temas/consultas";
import { SeloClassificacao } from "@/modulos/riscos/componentes/matriz-riscos";
import { riscosDaAcao } from "@/modulos/riscos/consultas";
import { ROTULOS_SITUACAO_RISCO } from "@/modulos/riscos/rotulos";

export const metadata: Metadata = { title: "Ação do plano" };

export default function PaginaAcao({ params }: PageProps<"/acoes/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheAcao params={params} />
    </Suspense>
  );
}

async function DetalheAcao({ params }: Pick<PageProps<"/acoes/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const acao = await obterAcao(banco, id);
  if (!acao || !(await planoEhVisivel(banco, acao.planoAcaoId, visiveis))) notFound();
  const hoje = hojeEmBrasilia();

  const [vigentes, planejamentos, acompanhamentos, compromissos, riscos, stakeholders, historico, opcoes, iniciativas] = await Promise.all([
    acoesVigentes(banco, acao.planoAcaoId, hoje),
    planejamentosDaAcao(banco, id),
    acompanhamentosDaAcao(banco, id),
    compromissosDaAcao(banco, id),
    riscosDaAcao(banco, id),
    stakeholdersDaAcao(banco, id),
    historicoDaAcao(banco, id),
    opcoesStakeholders(banco),
    opcoesIniciativas(banco, visiveis),
  ]);
  const nomes = await nomesDoHistorico(banco, historico);
  const vigente = vigentes.acoes.find((a) => a.acaoId === id) ?? null;
  const ultimo = planejamentos.find((p) => !p.retirada);
  const titulo = vigente?.titulo ?? ultimo?.titulo ?? acao.codigo;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={`${acao.codigo} – ${titulo}`}
        voltar={{ href: `/planos/${acao.planoAcaoId}`, rotulo: acao.planoTitulo }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/projetos-temas/${acao.projetoTemaId}`} className={classeLink}>
              {acao.projetoNome}
            </Link>
            {vigente && <SeloAcao situacao={vigente.andamento.situacao} atrasada={vigente.atrasada} />}
          </span>
        }
      />

      {!vigente && (
        <Alerta tom="aviso" titulo="Ação fora da versão vigente">
          Esta ação não está na versão aprovada do plano (ainda em elaboração ou já retirada). O acompanhamento só é
          registrado nas ações da versão vigente.
        </Alerta>
      )}

      {vigente && (
        <section aria-labelledby="titulo-planejamento" className={classeCartao}>
          <h2 id="titulo-planejamento" className="mb-1 text-lg font-semibold">
            Planejamento vigente
          </h2>
          <p className="mb-4 text-sm text-texto-secundario">Conforme a versão {vigentes.versao?.numeroVersao} (aprovada) do plano.</p>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <ItemDado rotulo="Pilar ou eixo" valor={vigente.eixoCodigo && `${vigente.eixoCodigo} – ${vigente.eixoNome}`} />
            <ItemDado rotulo="Responsável" valor={[vigente.responsavelUsuarioNome, vigente.responsavelStakeholderNome].filter(Boolean).join(" / ")} />
            <ItemDado rotulo="Início previsto" valor={vigente.inicioPrevisto && formatarData(vigente.inicioPrevisto)} />
            <ItemDado rotulo="Prazo (fim previsto)" valor={vigente.fimPrevisto && formatarData(vigente.fimPrevisto)} />
            <ItemDado rotulo="Periodicidade de acompanhamento" valor={vigente.periodicidade && ROTULOS_PERIODICIDADE[vigente.periodicidade]} />
            <ItemDado
              rotulo="Andamento"
              valor={`${ROTULOS_SITUACAO_ACAO[vigente.andamento.situacao ?? "nao_iniciada"]}${
                vigente.andamento.percentual !== null ? ` · ${vigente.andamento.percentual}% informado` : ""
              }`}
            />
            <ItemDado rotulo="Detalhamento" valor={vigente.descricao} largo />
            <ItemDado rotulo="Justificativa" valor={vigente.justificativa} largo />
          </dl>
        </section>
      )}

      {vigente && (
        <section aria-labelledby="titulo-marcos" className={classeCartao}>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="titulo-marcos" className="text-lg font-semibold">
              Marcos
            </h2>
            <ProgressoMarcos alcancados={vigente.marcos.filter((m) => m.alcancadoEm).length} previstos={vigente.marcos.length} />
          </div>
          <p className="mb-4 text-sm text-texto-secundario">Entregas verificáveis previstas e alcançadas; são a medida principal de evolução.</p>
          {vigente.marcos.length === 0 ? (
            <p className="text-sm text-texto-secundario">Nenhum marco previsto.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda text-sm">
              {vigente.marcos.map((m) => {
                const atrasado = marcoAtrasado(m.alcancadoEm !== null, m.prazoPrevisto, hoje);
                return (
                  <li key={m.marcoId} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <span>
                      <span className="font-semibold">{m.codigo}</span> {m.descricao}
                      {m.prazoPrevisto && <span className="text-texto-secundario"> · previsto para {formatarData(m.prazoPrevisto)}</span>}
                    </span>
                    {m.alcancadoEm ? (
                      <span className="font-medium text-green-800 dark:text-green-300">Alcançado em {formatarData(m.alcancadoEm)}</span>
                    ) : atrasado ? (
                      <span className="font-semibold text-red-800 dark:text-red-300">Prazo vencido</span>
                    ) : (
                      <span className="text-texto-secundario">Previsto</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="titulo-acompanhamento" className={classeCartao}>
        <h2 id="titulo-acompanhamento" className="mb-1 text-lg font-semibold">
          Acompanhamento
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Registros sem aprovação e preservados (não são alterados; uma correção é um novo registro).
        </p>
        {vigente && (
          <details className="mb-4 rounded-lg border border-borda p-4" open={acompanhamentos.length === 0}>
            <summary className="cursor-pointer font-medium">Registrar acompanhamento</summary>
            <div className="mt-4">
              <FormularioAcompanhamentoAcao acaoId={id} hoje={hoje} marcos={vigente.marcos} />
            </div>
          </details>
        )}
        {acompanhamentos.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhum acompanhamento registrado.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-borda text-sm">
            {acompanhamentos.map((r) => (
              <li key={r.id} className="py-2 first:pt-0 last:pb-0">
                <span className="font-medium">{formatarData(r.data)}</span>
                {r.situacao && <span> · {ROTULOS_SITUACAO_ACAO[r.situacao]}</span>}
                {r.percentual !== null && <span className="tabular-nums"> · {r.percentual}%</span>}
                {r.marcoCodigo && <span> · marco {r.marcoCodigo} {r.marcoAlcancado ? "alcançado" : "não alcançado (correção)"}</span>}
                {r.autorNome && <span className="text-texto-secundario"> · {r.autorNome}</span>}
                {r.observacao && <span className="block whitespace-pre-line text-texto-secundario">{r.observacao}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="titulo-ligacoes" className={classeCartao}>
        <h2 id="titulo-ligacoes" className="mb-4 text-lg font-semibold">
          Origem e relações
        </h2>
        <div className="grid gap-6 text-sm md:grid-cols-2">
          <div>
            <h3 className="font-semibold">Iniciativa</h3>
            <p className="mt-1">
              {acao.iniciativaId ? (
                <Link href={`/iniciativas/${acao.iniciativaId}`} className={classeLink}>
                  {acao.iniciativaTitulo}
                </Link>
              ) : (
                <span className="text-texto-secundario">Nenhuma iniciativa ligada.</span>
              )}
            </p>
            <details className="mt-2 rounded-lg border border-borda p-3">
              <summary className="cursor-pointer font-medium">Alterar ligação</summary>
              <div className="mt-3">
                <FormularioIniciativaDaAcao acaoId={id} iniciativaId={acao.iniciativaId} iniciativas={iniciativas} />
              </div>
            </details>
          </div>
          <div>
            <h3 className="font-semibold">Compromissos convertidos nesta ação</h3>
            {compromissos.length === 0 ? (
              <p className="mt-1 text-texto-secundario">Nenhum.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {compromissos.map((c) => (
                  <li key={c.id}>
                    <Link href={`/compromissos/${c.id}`} className={classeLink}>
                      {c.descricao}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="md:col-span-2">
            <h3 className="font-semibold">Riscos que esta ação responde</h3>
            {riscos.length === 0 ? (
              <p className="mt-1 text-texto-secundario">Nenhum risco aponta para esta ação.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-2">
                {riscos.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/riscos/${r.id}`} className={classeLink}>
                      {r.codigo} – {r.titulo}
                    </Link>
                    {r.vigente && <SeloClassificacao classificacao={r.vigente.classificacao} valor={r.vigente.criticidade} />}
                    <span className="text-texto-secundario">{ROTULOS_SITUACAO_RISCO[r.situacao]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="titulo-stakeholders" className={classeCartao}>
        <h2 id="titulo-stakeholders" className="mb-1 text-lg font-semibold">
          Pessoas e instituições relacionadas
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">Stakeholders do Cadastro Mestre envolvidos na ação, além do responsável.</p>
        {stakeholders.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhuma pessoa ou instituição relacionada.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {stakeholders.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <span>
                  <Link href={`/${s.tipoStakeholder === "pessoa" ? "pessoas" : "instituicoes"}/${s.stakeholderId}`} className={classeLink}>
                    {s.nome}
                  </Link>
                  {s.observacao && <span className="block text-xs text-texto-secundario">{s.observacao}</span>}
                </span>
                <BotaoAcaoRegistro acao={retirarStakeholderDaAcaoAcao} campos={{ id: s.id, acaoId: id }} rotulo="Retirar" rotuloEnviando="Retirando…" />
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4 rounded-lg border border-borda p-4">
          <summary className="cursor-pointer font-medium">Incluir pessoa ou instituição</summary>
          <div className="mt-4">
            <FormularioStakeholderRelacionado
              acao={incluirStakeholderNaAcaoAcao}
              campos={{ acaoId: id }}
              prefixo={`acao-stakeholder-${id}`}
              pessoas={opcoes.pessoas}
              instituicoes={opcoes.instituicoes}
            />
          </div>
        </details>
      </section>

      <section aria-labelledby="titulo-versoes" className={classeCartao}>
        <h2 id="titulo-versoes" className="mb-1 text-lg font-semibold">
          A ação ao longo das versões
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">Como a ação foi planejada em cada versão do plano.</p>
        <ul className="flex flex-col divide-y divide-borda text-sm">
          {planejamentos.map((p) => (
            <li key={`${p.versaoId}-${p.retirada}`} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/planos/${acao.planoAcaoId}/versoes/${p.versaoId}`} className={classeLink}>
                  Versão {p.numeroVersao}
                </Link>
                <SeloVersao situacao={p.situacaoVersao} />
                {p.retirada && <span className="text-texto-secundario">(retirada nesta versão)</span>}
              </div>
              <p className="text-texto-secundario">
                {p.titulo}
                {p.fimPrevisto && ` · prazo ${formatarData(p.fimPrevisto)}`}
                {(p.responsavelUsuarioNome || p.responsavelStakeholderNome) &&
                  ` · ${[p.responsavelUsuarioNome, p.responsavelStakeholderNome].filter(Boolean).join(" / ")}`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-historico" className={classeCartao}>
        <h2 id="titulo-historico" className="mb-4 text-lg font-semibold">
          Histórico de alterações
        </h2>
        <HistoricoAtividade registros={historico} nomes={nomes} />
      </section>
    </div>
  );
}

function ItemDado({ rotulo, valor, largo }: { rotulo: string; valor: string | null | undefined; largo?: boolean }) {
  return (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <dt className="text-texto-secundario">{rotulo}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words">{valor || "—"}</dd>
    </div>
  );
}
