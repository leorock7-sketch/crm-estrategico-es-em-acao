import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { BotaoAcaoRegistro } from "@/componentes/botao-acao-registro";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCartao, classeCelula, classeCelulaCabecalho, classeLink, classeTabela } from "@/componentes/estilos";
import { FormularioStakeholderRelacionado } from "@/componentes/formulario-registro";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { AreaConformePermissao } from "@/modulos/acesso/componentes/area-conforme-permissao";
import { podeEditarRegistro } from "@/modulos/acesso/capacidades";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData, formatarDataHora, hojeEmBrasilia } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { HistoricoAtividade } from "@/modulos/iniciativas/componentes/historico-atividade";
import { nomesDoHistorico } from "@/modulos/iniciativas/historico";
import { opcoesAcoes } from "@/modulos/plano-acao/consultas";
import { opcoesStakeholders } from "@/modulos/projetos-temas/consultas";
import {
  alterarArquivamentoRisco,
  arquivarGatilhoAcao,
  arquivarRespostaAcao,
  incluirStakeholderNoRiscoAcao,
  retirarStakeholderDoRiscoAcao,
} from "@/modulos/riscos/acoes";
import { avaliacaoVigente, motivosReavaliacao, ultimasAvaliacoes } from "@/modulos/riscos/analise";
import {
  FormularioAvaliacao,
  FormularioGatilho,
  FormularioOcorrenciaGatilho,
  FormularioResposta,
} from "@/modulos/riscos/componentes/formularios-risco";
import {
  ComparacaoInerenteResidual,
  MatrizRiscos,
  ResumoAvaliacao,
  SeloClassificacao,
} from "@/modulos/riscos/componentes/matriz-riscos";
import {
  avaliacoesDoRisco,
  gatilhosDoRisco,
  historicoDoRisco,
  obterRisco,
  respostasDoRisco,
  riscoEhVisivel,
  stakeholdersDoRisco,
} from "@/modulos/riscos/consultas";
import {
  DESCRICOES_SITUACAO_RISCO,
  DESCRICOES_TIPO_AVALIACAO,
  FAIXAS,
  ROTULOS_ESTRATEGIA,
  ROTULOS_SITUACAO_RESPOSTA,
  ROTULOS_SITUACAO_RISCO,
  ROTULOS_TIPO_AVALIACAO,
} from "@/modulos/riscos/rotulos";

export const metadata: Metadata = { title: "Risco" };

export default function PaginaRisco({ params }: PageProps<"/riscos/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <FichaRisco params={params} />
    </Suspense>
  );
}

async function FichaRisco({ params }: Pick<PageProps<"/riscos/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const risco = await obterRisco(banco, id);
  if (!risco || !(await riscoEhVisivel(banco, id, visiveis))) notFound();

  const [avaliacoes, gatilhos, respostas, stakeholders, historico, usuarios, opcoes, acoes] = await Promise.all([
    avaliacoesDoRisco(banco, id),
    gatilhosDoRisco(banco, id),
    respostasDoRisco(banco, id),
    stakeholdersDoRisco(banco, id),
    historicoDoRisco(banco, id),
    opcoesUsuarios(banco),
    opcoesStakeholders(banco),
    opcoesAcoes(banco, visiveis),
  ]);
  const nomes = await nomesDoHistorico(banco, historico);
  const hoje = hojeEmBrasilia();
  const arquivado = risco.arquivadoEm !== null;
  const ultimas = ultimasAvaliacoes(avaliacoes);
  const vigente = avaliacaoVigente(ultimas);
  const ultimaAvaliacaoEm = avaliacoes[0]?.dataAvaliacao ?? null;
  const motivos = motivosReavaliacao({
    ultimaAvaliacaoEm,
    gatilhosOcorridosEm: gatilhos.filter((g) => g.ultimo?.ocorrido).map((g) => g.ultimo!.data),
    proximaRevisao: risco.proximaRevisao,
    hoje,
  });
  const detalhe = (tipo: "inerente" | "residual") => avaliacoes.find((a) => a.tipo === tipo) ?? null;
  // Ações do mesmo projeto ou tema primeiro.
  const acoesOrdenadas = [...acoes.filter((a) => a.projetoNome === risco.projetoNome), ...acoes.filter((a) => a.projetoNome !== risco.projetoNome)];

  const podeEditar = await podeEditarRegistro(banco, "risco", id);
  return (
    <AreaConformePermissao podeEditar={podeEditar}>
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={`${risco.codigo} – ${risco.titulo}`}
        voltar={{ href: "/riscos", rotulo: "Matriz de Riscos" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/projetos-temas/${risco.projetoTemaId}`} className={classeLink}>
              {risco.projetoNome}
            </Link>
            <SeloSituacao tom={risco.situacao === "escalonado" ? "aviso" : risco.situacao === "mitigado" ? "sucesso" : "neutro"}>
              {ROTULOS_SITUACAO_RISCO[risco.situacao]}
            </SeloSituacao>
            {vigente && <SeloClassificacao classificacao={vigente.classificacao} valor={vigente.criticidade} />}
            {arquivado && <SeloSituacao tom="neutro">Arquivado</SeloSituacao>}
          </span>
        }
        acoes={
          <>
            {!arquivado && (
              <Link href={`/riscos/${id}/editar`} className={classeBotaoPrimario}>
                Editar
              </Link>
            )}
            <BotaoAcaoRegistro
              acao={alterarArquivamentoRisco}
              campos={{ id, arquivar: arquivado ? "nao" : "sim" }}
              rotulo={arquivado ? "Reativar risco" : "Arquivar risco"}
              rotuloEnviando={arquivado ? "Reativando…" : "Arquivando…"}
            />
          </>
        }
      />

      {arquivado && (
        <Alerta tom="aviso" titulo="Risco arquivado">
          Arquivado em {formatarDataHora(risco.arquivadoEm)}. O histórico continua disponível; para alterar, reative o risco.
        </Alerta>
      )}
      {!arquivado && motivos.length > 0 && (
        <Alerta tom="aviso" titulo="Reavaliação recomendada">
          {motivos.join(" ")} O sistema não altera a avaliação automaticamente: registre uma nova avaliação, fundamentada.
        </Alerta>
      )}

      <section aria-labelledby="titulo-dados" className={classeCartao}>
        <h2 id="titulo-dados" className="mb-4 text-lg font-semibold">
          Dados
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <ItemDado rotulo="Pilar ou eixo" valor={risco.eixoCodigo && `${risco.eixoCodigo} – ${risco.eixoNome}`} />
          <div>
            <dt className="text-texto-secundario">Iniciativa relacionada</dt>
            <dd className="mt-0.5">
              {risco.iniciativaId ? (
                <Link href={`/iniciativas/${risco.iniciativaId}`} className={classeLink}>
                  {risco.iniciativaTitulo}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <ItemDado rotulo="Dono do risco (equipe)" valor={risco.responsavelNome} />
          <ItemDado rotulo="Próxima revisão" valor={risco.proximaRevisao && formatarData(risco.proximaRevisao)} />
          <ItemDado rotulo="Status" valor={`${ROTULOS_SITUACAO_RISCO[risco.situacao]}: ${DESCRICOES_SITUACAO_RISCO[risco.situacao]}`} largo />
          <ItemDado rotulo="Descrição" valor={risco.descricao} largo />
          <ItemDado rotulo="Causa" valor={risco.causa} largo />
          <ItemDado rotulo="Consequência" valor={risco.consequencia} largo />
          <ItemDado rotulo="Controles existentes" valor={risco.controlesExistentes} largo />
        </dl>
      </section>

      <section aria-labelledby="titulo-avaliacao" className={classeCartao}>
        <h2 id="titulo-avaliacao" className="mb-1 text-lg font-semibold">
          Avaliação: inerente e residual
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Cada avaliação é um registro próprio, com data, responsável e justificativa. Registrar uma medida ou um gatilho não
          reduz o risco: só uma nova avaliação fundamentada o faz.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {(["inerente", "residual"] as const).map((tipo) => {
            const a = detalhe(tipo);
            return (
              <div key={tipo} className="rounded-lg border border-borda p-4">
                <h3 className="font-semibold">{ROTULOS_TIPO_AVALIACAO[tipo]}</h3>
                <p className="mb-2 text-xs text-texto-secundario">{DESCRICOES_TIPO_AVALIACAO[tipo]}</p>
                {a ? (
                  <>
                    <ResumoAvaliacao avaliacao={a} />
                    <p className="mt-2 text-sm text-texto-secundario">
                      {formatarData(a.dataAvaliacao)} · {a.avaliadoPorNome}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm">{a.justificativa}</p>
                    <p className="mt-1 text-xs text-texto-secundario">Prioridade de tratamento: {FAIXAS[a.classificacao].prioridade}</p>
                  </>
                ) : (
                  <p className="text-sm text-texto-secundario">Ainda não avaliado.</p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm">
          <span className="text-texto-secundario">Comparação (índice de criticidade): </span>
          <ComparacaoInerenteResidual inerente={ultimas.inerente} residual={ultimas.residual} />
        </p>
        <p className="mt-1 text-xs text-texto-secundario">
          A diferença está em pontos do índice ordinal (probabilidade × impacto) e na faixa; não é uma redução percentual da
          exposição real ao risco.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <MatrizRiscos titulo="Posição do risco inerente" avaliacoes={[ultimas.inerente]} />
          <MatrizRiscos titulo="Posição do risco residual" avaliacoes={[ultimas.residual]} />
        </div>

        {!arquivado && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Registrar avaliação ou reavaliação</summary>
            <div className="mt-4">
              <FormularioAvaliacao riscoId={id} hoje={hoje} usuarios={usuarios} />
            </div>
          </details>
        )}

        <h3 className="mt-6 mb-2 font-semibold">Histórico das avaliações</h3>
        <div className="overflow-x-auto rounded-lg border border-borda">
          <table className={classeTabela}>
            <caption className="sr-only">Histórico das avaliações do risco</caption>
            <thead>
              <tr>
                <th scope="col" className={classeCelulaCabecalho}>
                  Data
                </th>
                <th scope="col" className={classeCelulaCabecalho}>
                  Tipo
                </th>
                <th scope="col" className={classeCelulaCabecalho}>
                  Avaliação
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>
                  Justificativa
                </th>
                <th scope="col" className={`${classeCelulaCabecalho} hidden sm:table-cell`}>
                  Responsável
                </th>
              </tr>
            </thead>
            <tbody>
              {avaliacoes.map((a) => (
                <tr key={a.id}>
                  <td className={`${classeCelula} whitespace-nowrap`}>{formatarData(a.dataAvaliacao)}</td>
                  <td className={classeCelula}>{ROTULOS_TIPO_AVALIACAO[a.tipo]}</td>
                  <td className={classeCelula}>
                    <ResumoAvaliacao avaliacao={a} />
                    <span className="mt-1 block text-xs text-texto-secundario md:hidden">{a.justificativa}</span>
                  </td>
                  <td className={`${classeCelula} hidden whitespace-pre-line md:table-cell`}>{a.justificativa}</td>
                  <td className={`${classeCelula} hidden sm:table-cell`}>
                    {a.avaliadoPorNome}
                    {a.registradoPorNome && a.registradoPorNome !== a.avaliadoPorNome && (
                      <span className="block text-xs text-texto-secundario">registrado por {a.registradoPorNome}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="titulo-gatilhos" className={classeCartao}>
        <h2 id="titulo-gatilhos" className="mb-1 text-lg font-semibold">
          Gatilhos
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Sinais de alerta acompanhados ao longo do tempo. A ocorrência não altera probabilidade, impacto nem criticidade:
          sinaliza a necessidade de reavaliação.
        </p>
        {gatilhos.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhum gatilho registrado.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {gatilhos.map((g) => (
              <li key={g.id} className="rounded-lg border border-borda p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="whitespace-pre-line font-medium">{g.descricao}</p>
                  {g.ultimo ? (
                    <SeloSituacao tom={g.ultimo.ocorrido ? "aviso" : "neutro"}>
                      {g.ultimo.ocorrido ? "Ocorreu" : "Não ocorreu"} em {formatarData(g.ultimo.data)}
                    </SeloSituacao>
                  ) : (
                    <SeloSituacao tom="neutro">Sem acompanhamento</SeloSituacao>
                  )}
                </div>
                {g.registros.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-texto-secundario">
                    {g.registros.map((r) => (
                      <li key={r.id}>
                        {formatarData(r.data)} · {r.ocorrido ? "ocorreu" : "não ocorreu"}
                        {r.observacao && ` · ${r.observacao}`}
                        {r.autorNome && ` · ${r.autorNome}`}
                      </li>
                    ))}
                  </ul>
                )}
                {!arquivado && (
                  <div className="mt-3 flex flex-col gap-2">
                    <details className="rounded-lg border border-borda p-3">
                      <summary className="cursor-pointer font-medium">Registrar acompanhamento</summary>
                      <div className="mt-3">
                        <FormularioOcorrenciaGatilho gatilhoId={g.id} hoje={hoje} />
                      </div>
                    </details>
                    <details className="rounded-lg border border-borda p-3">
                      <summary className="cursor-pointer font-medium">Alterar descrição</summary>
                      <div className="mt-3">
                        <FormularioGatilho riscoId={id} gatilho={g} />
                      </div>
                    </details>
                    <BotaoAcaoRegistro acao={arquivarGatilhoAcao} campos={{ id: g.id }} rotulo="Arquivar gatilho" rotuloEnviando="Arquivando…" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!arquivado && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Incluir gatilho</summary>
            <div className="mt-4">
              <FormularioGatilho riscoId={id} />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-respostas" className={classeCartao}>
        <h2 id="titulo-respostas" className="mb-1 text-lg font-semibold">
          Respostas ao risco
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Medidas para evitar, mitigar, transferir ou aceitar o risco. Quando a medida já é uma ação do Plano de Ação, ela
          aponta para a ação, sem duplicá-la.
        </p>
        {respostas.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhuma medida registrada.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {respostas.map((r) => (
              <li key={r.id} className="rounded-lg border border-borda p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p>
                    <span className="font-semibold">{ROTULOS_ESTRATEGIA[r.estrategia]}:</span> {r.descricao}
                  </p>
                  <SeloSituacao tom={r.situacao === "concluida" ? "sucesso" : "neutro"}>{ROTULOS_SITUACAO_RESPOSTA[r.situacao]}</SeloSituacao>
                </div>
                <p className="mt-1 text-texto-secundario">
                  {[r.responsavelUsuarioNome, r.responsavelStakeholderNome].filter(Boolean).join(" / ") || "Sem responsável"}
                  {r.prazo && ` · prazo ${formatarData(r.prazo)}`}
                </p>
                {r.acaoId && (
                  <p className="mt-1">
                    Ação do plano:{" "}
                    <Link href={`/acoes/${r.acaoId}`} className={classeLink}>
                      {r.acaoCodigo} – {r.acaoTitulo}
                    </Link>
                  </p>
                )}
                {!arquivado && (
                  <div className="mt-3 flex flex-col gap-2">
                    <details className="rounded-lg border border-borda p-3">
                      <summary className="cursor-pointer font-medium">Alterar medida</summary>
                      <div className="mt-3">
                        <FormularioResposta
                          riscoId={id}
                          inicial={r}
                          usuarios={usuarios}
                          pessoas={opcoes.pessoas}
                          instituicoes={opcoes.instituicoes}
                          acoes={acoesOrdenadas}
                        />
                      </div>
                    </details>
                    <BotaoAcaoRegistro acao={arquivarRespostaAcao} campos={{ id: r.id, riscoId: id }} rotulo="Arquivar medida" rotuloEnviando="Arquivando…" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!arquivado && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Incluir medida de resposta</summary>
            <div className="mt-4">
              <FormularioResposta riscoId={id} usuarios={usuarios} pessoas={opcoes.pessoas} instituicoes={opcoes.instituicoes} acoes={acoesOrdenadas} />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-stakeholders" className={classeCartao}>
        <h2 id="titulo-stakeholders" className="mb-1 text-lg font-semibold">
          Pessoas e instituições relacionadas
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">Stakeholders do Cadastro Mestre envolvidos no risco ou no seu tratamento.</p>
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
                {!arquivado && (
                  <BotaoAcaoRegistro acao={retirarStakeholderDoRiscoAcao} campos={{ id: s.id, riscoId: id }} rotulo="Retirar" rotuloEnviando="Retirando…" />
                )}
              </li>
            ))}
          </ul>
        )}
        {!arquivado && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Incluir pessoa ou instituição</summary>
            <div className="mt-4">
              <FormularioStakeholderRelacionado
                acao={incluirStakeholderNoRiscoAcao}
                campos={{ riscoId: id }}
                prefixo={`risco-stakeholder-${id}`}
                pessoas={opcoes.pessoas}
                instituicoes={opcoes.instituicoes}
              />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-historico" className={classeCartao}>
        <h2 id="titulo-historico" className="mb-4 text-lg font-semibold">
          Histórico de alterações
        </h2>
        <HistoricoAtividade registros={historico} nomes={nomes} />
      </section>
    </div>
    </AreaConformePermissao>
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
