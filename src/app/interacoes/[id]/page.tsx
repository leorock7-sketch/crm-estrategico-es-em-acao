import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { BotaoAcaoRegistro } from "@/componentes/botao-acao-registro";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCartao, classeLink } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { AreaConformePermissao } from "@/modulos/acesso/componentes/area-conforme-permissao";
import { podeEditarRegistro } from "@/modulos/acesso/capacidades";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarDataHora, hojeEmBrasilia } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { HistoricoAtividade } from "@/modulos/iniciativas/componentes/historico-atividade";
import { opcoesIniciativas, opcoesProjetosTemas } from "@/modulos/iniciativas/consultas";
import { nomesDoHistorico } from "@/modulos/iniciativas/historico";
import { ROTULOS_TIPO_INICIATIVA } from "@/modulos/iniciativas/rotulos";
import {
  alterarArquivamentoInteracao,
  retirarIniciativaDaInteracaoAcao,
  retirarParticipanteAcao,
  retirarProjetoDaInteracaoAcao,
} from "@/modulos/interacoes/acoes";
import { FormularioCompromisso } from "@/modulos/interacoes/componentes/formularios-compromisso";
import {
  FormularioIniciativaDaInteracao,
  FormularioParticipante,
  FormularioPresenca,
  FormularioProjetoDaInteracao,
} from "@/modulos/interacoes/componentes/formularios-ligacao";
import { ListaCompromissos } from "@/modulos/interacoes/componentes/lista-compromissos";
import { SeloIniciativa, SeloInteracao } from "@/modulos/interacoes/componentes/selos";
import {
  compromissosDaInteracao,
  historicoDaInteracao,
  iniciativasDaInteracao,
  interacaoEhVisivel,
  obterInteracao,
  participantesDaInteracao,
  projetosDaInteracao,
} from "@/modulos/interacoes/consultas";
import { ROTULOS_PRESENCA, ROTULOS_TIPO_INTERACAO } from "@/modulos/interacoes/rotulos";
import { opcoesStakeholders } from "@/modulos/projetos-temas/consultas";
import { BotaoArquivamento } from "@/modulos/stakeholders/componentes/botao-arquivamento";

export const metadata: Metadata = { title: "Interação" };

export default function PaginaInteracao({ params }: PageProps<"/interacoes/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheInteracao params={params} />
    </Suspense>
  );
}

async function DetalheInteracao({ params }: Pick<PageProps<"/interacoes/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();

  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const interacao = await obterInteracao(banco, id);
  if (!interacao || !(await interacaoEhVisivel(banco, id, visiveis))) notFound();

  const [participantes, projetos, iniciativas, compromissos, historico, opcoesProjetos, opcoesInic, opcoes, usuarios] =
    await Promise.all([
      participantesDaInteracao(banco, id),
      projetosDaInteracao(banco, id),
      iniciativasDaInteracao(banco, id),
      compromissosDaInteracao(banco, id),
      historicoDaInteracao(banco, id),
      opcoesProjetosTemas(banco, visiveis),
      opcoesIniciativas(banco, visiveis),
      opcoesStakeholders(banco),
      opcoesUsuarios(banco),
    ]);
  const nomes = await nomesDoHistorico(banco, historico);
  const hoje = hojeEmBrasilia();
  const arquivada = interacao.arquivadoEm !== null;
  const projetosLigados = new Set(projetos.map((p) => p.projetoTemaId));
  const iniciativasLigadas = new Set(iniciativas.map((i) => i.iniciativaId));
  // A última ligação (projeto, tema ou iniciativa) não pode ser retirada.
  const podeRetirarLigacao = projetos.length + iniciativas.length > 1;

  const podeEditar = await podeEditarRegistro(banco, "interacao", id);
  return (
    <AreaConformePermissao podeEditar={podeEditar}>
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={interacao.assunto}
        voltar={{ href: "/interacoes", rotulo: "Interações" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {ROTULOS_TIPO_INTERACAO[interacao.tipo]} · {formatarDataHora(interacao.inicio)}
              {interacao.fim && ` até ${formatarDataHora(interacao.fim)}`}
            </span>
            <SeloInteracao situacao={interacao.situacao} />
            {arquivada && <SeloSituacao tom="neutro">Arquivada</SeloSituacao>}
          </span>
        }
        acoes={
          <>
            {!arquivada && (
              <Link href={`/interacoes/${id}/editar`} className={classeBotaoPrimario}>
                Editar
              </Link>
            )}
            <BotaoArquivamento acao={alterarArquivamentoInteracao.bind(null, id, !arquivada)} arquivado={arquivada} />
          </>
        }
      />

      {arquivada && (
        <Alerta tom="aviso" titulo="Interação arquivada">
          Arquivada em {formatarDataHora(interacao.arquivadoEm)}. Os registros continuam visíveis, mas não podem ser
          alterados. Para alterar, reative a interação.
        </Alerta>
      )}

      <section aria-labelledby="titulo-dados" className={classeCartao}>
        <h2 id="titulo-dados" className="mb-4 text-lg font-semibold">
          Registro
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-texto-secundario">Resumo</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words">{interacao.resumo || "—"}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Local</dt>
            <dd className="mt-0.5 break-words">{interacao.local || "—"}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Registrada em</dt>
            <dd className="mt-0.5">{formatarDataHora(interacao.criadoEm)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="titulo-participantes" className={classeCartao}>
        <h2 id="titulo-participantes" className="mb-4 text-lg font-semibold">
          Participantes
        </h2>
        {participantes.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhum participante registrado.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {participantes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <span>
                  {p.stakeholderId ? (
                    <Link href={`/${p.tipoStakeholder === "pessoa" ? "pessoas" : "instituicoes"}/${p.stakeholderId}`} className={classeLink}>
                      {p.nome}
                    </Link>
                  ) : (
                    <span className="font-medium">{p.nome}</span>
                  )}
                  <span className="text-texto-secundario">
                    {" "}
                    · {p.usuarioId ? "equipe interna" : "externo"}
                    {arquivada && ` · ${ROTULOS_PRESENCA[p.presenca]}`}
                  </span>
                </span>
                {!arquivada && (
                  <span className="flex flex-wrap items-center gap-3">
                    <FormularioPresenca interacaoId={id} participanteId={p.id} presenca={p.presenca} nome={p.nome} />
                    <BotaoAcaoRegistro
                      acao={retirarParticipanteAcao}
                      campos={{ ligacaoId: p.id, interacaoId: id }}
                      rotulo="Retirar"
                      rotuloEnviando="Retirando…"
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {!arquivada && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Incluir participante</summary>
            <div className="mt-4">
              <FormularioParticipante interacaoId={id} pessoas={opcoes.pessoas} instituicoes={opcoes.instituicoes} usuarios={usuarios} />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-iniciativas" className={classeCartao}>
        <h2 id="titulo-iniciativas" className="mb-1 text-lg font-semibold">
          Iniciativas para as quais contribuiu
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          A mesma interação contribui para várias iniciativas sem ser registrada de novo.
        </p>
        {iniciativas.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhuma iniciativa ligada.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {iniciativas.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                    {ROTULOS_TIPO_INICIATIVA[i.tipo]}{" "}
                  </span>
                  <Link href={`/iniciativas/${i.iniciativaId}`} className={classeLink}>
                    {i.titulo}
                  </Link>
                  {i.contribuicao && <span className="block text-xs text-texto-secundario">{i.contribuicao}</span>}
                </span>
                <span className="flex flex-wrap items-center gap-3">
                  <SeloIniciativa situacao={i.situacao} />
                  {!arquivada && podeRetirarLigacao && (
                    <BotaoAcaoRegistro
                      acao={retirarIniciativaDaInteracaoAcao}
                      campos={{ ligacaoId: i.id, interacaoId: id }}
                      rotulo="Retirar"
                      rotuloEnviando="Retirando…"
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!arquivada && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Ligar a outra iniciativa</summary>
            <div className="mt-4">
              <FormularioIniciativaDaInteracao interacaoId={id} iniciativas={opcoesInic.filter((i) => !iniciativasLigadas.has(i.id))} />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-projetos" className={classeCartao}>
        <h2 id="titulo-projetos" className="mb-1 text-lg font-semibold">
          Projetos e temas
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Ligados diretamente. Os projetos e temas das iniciativas acima também valem para a interação.
        </p>
        {projetos.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhum projeto ou tema ligado diretamente.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {projetos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <span>
                  <Link href={`/projetos-temas/${p.projetoTemaId}`} className={classeLink}>
                    {p.nome}
                  </Link>
                  <span className="text-texto-secundario"> · {p.comiteNome}</span>
                </span>
                {!arquivada && podeRetirarLigacao && (
                  <BotaoAcaoRegistro
                    acao={retirarProjetoDaInteracaoAcao}
                    campos={{ ligacaoId: p.id, interacaoId: id }}
                    rotulo="Retirar"
                    rotuloEnviando="Retirando…"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {!arquivada && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Incluir projeto ou tema</summary>
            <div className="mt-4">
              <FormularioProjetoDaInteracao interacaoId={id} projetos={opcoesProjetos.filter((p) => !projetosLigados.has(p.id))} />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-compromissos" className={classeCartao}>
        <h2 id="titulo-compromissos" className="mb-1 text-lg font-semibold">
          Encaminhamentos e compromissos
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">Definidos nesta interação, com responsável e prazo.</p>
        <ListaCompromissos compromissos={compromissos} hoje={hoje} mostrarOrigem={false} vazio="Nenhum compromisso registrado." />
        {!arquivada && (
          <details className="mt-4 rounded-lg border border-borda p-4" open={compromissos.length === 0}>
            <summary className="cursor-pointer font-medium">Registrar compromisso</summary>
            <div className="mt-4">
              <FormularioCompromisso
                inicial={{ interacaoId: id }}
                iniciativas={iniciativas.map((i) => ({ id: i.iniciativaId, titulo: i.titulo }))}
                usuarios={usuarios}
                pessoas={opcoes.pessoas}
                instituicoes={opcoes.instituicoes}
                voltarPara={`/interacoes/${id}`}
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
