import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCartao, classeLink } from "@/componentes/estilos";
import { FormularioEncerramento } from "@/componentes/formulario-encerramento";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { descreverPeriodo, formatarData, formatarDataHora } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import {
  alterarArquivamentoProjetoTema,
  encerrarAssociacaoAcao,
  encerrarParticipacaoAcao,
} from "@/modulos/projetos-temas/acoes";
import { AtividadesDoProjetoTema } from "@/modulos/iniciativas/componentes/atividades-relacionadas";
import { FormularioAssociacao } from "@/modulos/projetos-temas/componentes/formulario-associacao";
import { FormularioParticipacao } from "@/modulos/projetos-temas/componentes/formulario-participacao";
import {
  historicoDoProjetoTema,
  listarParticipantes,
  listarStakeholdersDoContexto,
  obterProjetoTema,
  opcoesComites,
  opcoesStakeholders,
} from "@/modulos/projetos-temas/consultas";
import {
  ROTULOS_SITUACAO_PROJETO_TEMA,
  ROTULOS_TIPO_PROJETO_TEMA,
  ROTULOS_TIPO_RELACAO,
} from "@/modulos/projetos-temas/rotulos";
import { permissaoNoContexto } from "@/modulos/acesso/permissoes";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { SeloPosicionamento } from "@/modulos/avaliacoes/componentes/selo-posicionamento";
import { fichasDoContexto } from "@/modulos/avaliacoes/consultas";
import type { FichaParaMatriz } from "@/modulos/avaliacoes/matriz";
import { BotaoArquivamento } from "@/modulos/stakeholders/componentes/botao-arquivamento";
import { ListaHistorico } from "@/modulos/stakeholders/componentes/lista-historico";
import { idsCitadosNoHistorico, nomesDosRegistros } from "@/modulos/stakeholders/consultas";

export const metadata: Metadata = { title: "Projeto ou tema" };

export default function PaginaProjetoTema({ params }: PageProps<"/projetos-temas/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheProjetoTema params={params} />
    </Suspense>
  );
}

async function DetalheProjetoTema({ params }: Pick<PageProps<"/projetos-temas/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();

  const banco = await bancoDaRequisicao();
  const projeto = await obterProjetoTema(banco, id);
  if (!projeto) notFound();

  const [participantes, stakeholders, historico, comites, opcoes] = await Promise.all([
    listarParticipantes(banco, id),
    listarStakeholdersDoContexto(banco, id),
    historicoDoProjetoTema(banco, id),
    opcoesComites(banco),
    opcoesStakeholders(banco),
  ]);
  const nomes = await nomesDosRegistros(banco, idsCitadosNoHistorico(historico));
  const usuario = await obterUsuarioAtual(banco);
  const permissao = await permissaoNoContexto(banco, usuario.id, id);
  const fichas = permissao.ver ? await fichasDoContexto(banco, id) : [];
  const arquivado = projeto.arquivadoEm !== null;
  const tipo = ROTULOS_TIPO_PROJETO_TEMA[projeto.tipo];
  // O comitê principal e os que já participam não podem ser incluídos de novo.
  const comitesIndisponiveis = new Set([
    projeto.comiteId,
    ...participantes.filter((p) => p.dataFim === null).map((p) => p.comiteId),
  ]);
  const comitesDisponiveis = comites.filter((c) => !comitesIndisponiveis.has(c.id));
  const stakeholdersVigentes = stakeholders.filter((s) => s.dataFim === null);
  const stakeholdersEncerrados = stakeholders.filter((s) => s.dataFim !== null);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={projeto.nome}
        voltar={{ href: "/projetos-temas", rotulo: "Projetos e temas" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <span>{tipo}</span>
            <span>· {ROTULOS_SITUACAO_PROJETO_TEMA[projeto.situacao]}</span>
            {arquivado && <SeloSituacao tom="neutro">Arquivado</SeloSituacao>}
          </span>
        }
        acoes={
          <>
            {!arquivado && (
              <Link href={`/projetos-temas/${id}/editar`} className={classeBotaoPrimario}>
                Editar
              </Link>
            )}
            <BotaoArquivamento
              acao={alterarArquivamentoProjetoTema.bind(null, id, !arquivado)}
              arquivado={arquivado}
            />
          </>
        }
      />

      {arquivado && (
        <Alerta tom="aviso" titulo={`${tipo} arquivado`}>
          Arquivado em {formatarDataHora(projeto.arquivadoEm)}. Comitês participantes e stakeholders
          continuam visíveis, mas não podem ser alterados. Para editar, reative o cadastro.
        </Alerta>
      )}

      <section aria-labelledby="titulo-dados" className={classeCartao}>
        <h2 id="titulo-dados" className="mb-4 text-lg font-semibold">
          Dados
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-texto-secundario">Descrição</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words">{projeto.descricao || "—"}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Comitê principal</dt>
            <dd className="mt-0.5">
              <Link href={`/comites/${projeto.comiteId}`} className={classeLink}>
                {projeto.comiteNome}
              </Link>
            </dd>
          </div>
          <ItemDado rotulo="Início" valor={projeto.dataInicio && formatarData(projeto.dataInicio)} />
          <ItemDado rotulo="Término" valor={projeto.dataFim && formatarData(projeto.dataFim)} />
          <ItemDado rotulo="Cadastrado em" valor={formatarDataHora(projeto.criadoEm)} />
          <ItemDado rotulo="Última alteração" valor={formatarDataHora(projeto.atualizadoEm)} />
        </dl>
      </section>

      <section aria-labelledby="titulo-participantes" className={classeCartao}>
        <h2 id="titulo-participantes" className="mb-1 text-lg font-semibold">
          Comitês participantes
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Outros comitês que também atuam neste {tipo.toLowerCase()}, além do comitê principal.
        </p>
        {participantes.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhum comitê participante.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {participantes.map((p) => (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/comites/${p.comiteId}`} className={classeLink}>
                    {p.comiteNome}
                  </Link>
                  {p.dataFim === null ? (
                    <SeloSituacao tom="sucesso">Vigente</SeloSituacao>
                  ) : (
                    <SeloSituacao tom="neutro">Encerrada</SeloSituacao>
                  )}
                </div>
                <p className="text-xs text-texto-secundario">
                  {descreverPeriodo(p.dataInicio, p.dataFim)}
                  {p.observacao && ` · ${p.observacao}`}
                </p>
                {!arquivado && p.dataFim === null && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-texto-secundario hover:underline">
                      Encerrar participação
                    </summary>
                    <FormularioEncerramento acao={encerrarParticipacaoAcao} campo="participacaoId" id={p.id} />
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        {!arquivado && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Incluir comitê participante</summary>
            <div className="mt-4">
              <FormularioParticipacao projetoTemaId={id} comites={comitesDisponiveis} />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-stakeholders" className={classeCartao}>
        <h2 id="titulo-stakeholders" className="mb-1 text-lg font-semibold">
          Stakeholders associados
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Pessoas e instituições relacionadas a este {tipo.toLowerCase()}. A avaliação de poder e
          interesse será feita em etapa posterior, após a revisão dos critérios.
        </p>
        <ListaStakeholders
          titulo="Vigentes"
          stakeholders={stakeholdersVigentes}
          vazio="Nenhum stakeholder associado."
          encerravel={!arquivado}
        />
        {stakeholdersEncerrados.length > 0 && (
          <div className="mt-6">
            <ListaStakeholders titulo="Encerrados" stakeholders={stakeholdersEncerrados} vazio="" encerravel={false} />
          </div>
        )}
        {!arquivado && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Associar stakeholder</summary>
            <div className="mt-4">
              <FormularioAssociacao
                projetoTemaId={id}
                pessoas={opcoes.pessoas}
                instituicoes={opcoes.instituicoes}
              />
            </div>
          </details>
        )}
      </section>

      <SecaoAvaliacoes projetoTemaId={id} fichas={fichas} podeVer={permissao.ver} />

      <AtividadesDoProjetoTema projetoTemaId={id} arquivado={arquivado} />

      <section aria-labelledby="titulo-historico" className={classeCartao}>
        <h2 id="titulo-historico" className="mb-4 text-lg font-semibold">
          Histórico de alterações
        </h2>
        <ListaHistorico registros={historico} nomes={nomes} perspectiva="projeto" />
      </section>
    </div>
  );
}

/** Situação da avaliação de cada stakeholder do contexto, com acesso à ficha e à matriz. */
function SecaoAvaliacoes({
  projetoTemaId,
  fichas,
  podeVer,
}: {
  projetoTemaId: string;
  fichas: FichaParaMatriz[];
  podeVer: boolean;
}) {
  return (
    <section aria-labelledby="titulo-avaliacoes" className={classeCartao}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-avaliacoes" className="text-lg font-semibold">
          Avaliações estratégicas
        </h2>
        {podeVer && (
          <Link href={`/projetos-temas/${projetoTemaId}/matriz`} className={classeLink}>
            Abrir a matriz de poder × interesse
          </Link>
        )}
      </div>
      <p className="mb-4 text-sm text-texto-secundario">
        Demonstração com dados fictícios: resultados não homologados. Visíveis somente a quem tem permissão neste
        projeto ou tema.
      </p>
      {!podeVer ? (
        <p className="text-sm text-texto-secundario">Você não tem permissão para ver as avaliações deste contexto.</p>
      ) : fichas.length === 0 ? (
        <p className="text-sm text-texto-secundario">Associe stakeholders para poder avaliá-los.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda text-sm">
          {fichas.map((f) => (
            <li key={f.stakeholderId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link href={`/projetos-temas/${projetoTemaId}/avaliacoes/${f.stakeholderId}`} className={classeLink}>
                {f.nome}
              </Link>
              <span className="flex flex-wrap items-center gap-2 text-texto-secundario">
                {f.vigente ? (
                  <>
                    <SeloPosicionamento posicionamento={f.vigente.posicionamento} />
                    <span className="text-xs">versão {f.vigente.numeroVersao}</span>
                  </>
                ) : (
                  <span>Não avaliado</span>
                )}
                {f.temRascunho && <SeloSituacao tom="aviso">Rascunho</SeloSituacao>}
                {!f.associado && <SeloSituacao tom="neutro">Associação encerrada</SeloSituacao>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type StakeholderDoContexto = Awaited<ReturnType<typeof listarStakeholdersDoContexto>>[number];

function ListaStakeholders({
  titulo,
  stakeholders,
  vazio,
  encerravel,
}: {
  titulo: string;
  stakeholders: StakeholderDoContexto[];
  vazio: string;
  encerravel: boolean;
}) {
  return (
    <>
      <h3 className="mb-2 text-sm font-semibold text-texto-secundario">{titulo}</h3>
      {stakeholders.length === 0 ? (
        <p className="text-sm text-texto-secundario">{vazio}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda text-sm">
          {stakeholders.map((s) => (
            <li key={s.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  href={`/${s.tipoStakeholder === "pessoa" ? "pessoas" : "instituicoes"}/${s.stakeholderId}`}
                  className={classeLink}
                >
                  {s.nome}
                </Link>
                <span className="text-texto-secundario">· {ROTULOS_TIPO_RELACAO[s.tipoRelacao]}</span>
              </div>
              {s.descricao && <p className="mt-0.5 break-words">{s.descricao}</p>}
              <p className="text-xs text-texto-secundario">{descreverPeriodo(s.dataInicio, s.dataFim)}</p>
              {encerravel && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-texto-secundario hover:underline">
                    Encerrar associação
                  </summary>
                  <FormularioEncerramento acao={encerrarAssociacaoAcao} campo="associacaoId" id={s.id} />
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ItemDado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-texto-secundario">{rotulo}</dt>
      <dd className="mt-0.5 break-words">{valor || "—"}</dd>
    </div>
  );
}
