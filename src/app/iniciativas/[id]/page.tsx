import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { BotaoAcaoRegistro } from "@/componentes/botao-acao-registro";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeBotaoSecundario, classeCartao, classeLink } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData, formatarDataHora, hojeEmBrasilia } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import {
  alterarArquivamentoIniciativa,
  retirarProjetoDaIniciativaAcao,
  retirarStakeholderDaIniciativaAcao,
} from "@/modulos/iniciativas/acoes";
import { FormularioProjetoDaIniciativa, FormularioStakeholderDaIniciativa } from "@/modulos/iniciativas/componentes/formularios-ligacao";
import { HistoricoAtividade } from "@/modulos/iniciativas/componentes/historico-atividade";
import {
  historicoDaIniciativa,
  iniciativaEhVisivel,
  obterIniciativa,
  opcoesProjetosTemas,
  projetosDaIniciativa,
  stakeholdersDaIniciativa,
} from "@/modulos/iniciativas/consultas";
import { nomesDoHistorico } from "@/modulos/iniciativas/historico";
import {
  ROTULOS_PAPEL_INICIATIVA,
  ROTULOS_PRIORIDADE_INICIATIVA,
  ROTULOS_TIPO_INICIATIVA,
} from "@/modulos/iniciativas/rotulos";
import { FormularioCompromisso } from "@/modulos/interacoes/componentes/formularios-compromisso";
import { ListaCompromissos } from "@/modulos/interacoes/componentes/lista-compromissos";
import { SeloIniciativa, SeloInteracao } from "@/modulos/interacoes/componentes/selos";
import { compromissosDaIniciativa, interacoesDaIniciativa } from "@/modulos/interacoes/consultas";
import { ROTULOS_TIPO_INTERACAO } from "@/modulos/interacoes/rotulos";
import { opcoesStakeholders } from "@/modulos/projetos-temas/consultas";
import { ROTULOS_TIPO_PROJETO_TEMA } from "@/modulos/projetos-temas/rotulos";
import { BotaoArquivamento } from "@/modulos/stakeholders/componentes/botao-arquivamento";

export const metadata: Metadata = { title: "Iniciativa" };

export default function PaginaIniciativa({ params }: PageProps<"/iniciativas/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheIniciativa params={params} />
    </Suspense>
  );
}

async function DetalheIniciativa({ params }: Pick<PageProps<"/iniciativas/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();

  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const iniciativa = await obterIniciativa(banco, id);
  if (!iniciativa || !(await iniciativaEhVisivel(banco, id, visiveis))) notFound();

  const [projetos, stakeholders, interacoes, compromissos, historico, opcoesProjetos, opcoes, usuarios] = await Promise.all([
    projetosDaIniciativa(banco, id),
    stakeholdersDaIniciativa(banco, id),
    interacoesDaIniciativa(banco, id),
    compromissosDaIniciativa(banco, id),
    historicoDaIniciativa(banco, id),
    opcoesProjetosTemas(banco, visiveis),
    opcoesStakeholders(banco),
    opcoesUsuarios(banco),
  ]);
  const nomes = await nomesDoHistorico(banco, historico);
  const hoje = hojeEmBrasilia();
  const arquivada = iniciativa.arquivadoEm !== null;
  const ligados = new Set(projetos.map((p) => p.projetoTemaId));

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={iniciativa.titulo}
        voltar={{ href: "/iniciativas", rotulo: "Iniciativas" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <span>{ROTULOS_TIPO_INICIATIVA[iniciativa.tipo]}</span>
            <SeloIniciativa situacao={iniciativa.situacao} />
            {arquivada && <SeloSituacao tom="neutro">Arquivada</SeloSituacao>}
          </span>
        }
        acoes={
          <>
            {!arquivada && (
              <>
                <Link href={`/iniciativas/${id}/editar`} className={classeBotaoPrimario}>
                  Editar
                </Link>
                <Link href={`/interacoes/nova?iniciativa=${id}`} className={classeBotaoSecundario}>
                  Registrar interação
                </Link>
              </>
            )}
            <BotaoArquivamento acao={alterarArquivamentoIniciativa.bind(null, id, !arquivada)} arquivado={arquivada} />
          </>
        }
      />

      {arquivada && (
        <Alerta tom="aviso" titulo="Iniciativa arquivada">
          Arquivada em {formatarDataHora(iniciativa.arquivadoEm)}. As ligações continuam visíveis, mas não podem ser
          alteradas. Para alterar, reative a iniciativa.
        </Alerta>
      )}

      <section aria-labelledby="titulo-dados" className={classeCartao}>
        <h2 id="titulo-dados" className="mb-4 text-lg font-semibold">
          Dados
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-texto-secundario">Descrição</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words">{iniciativa.descricao || "—"}</dd>
          </div>
          <ItemDado rotulo="Origem" valor={iniciativa.origem} />
          <ItemDado rotulo="Responsável (equipe)" valor={iniciativa.responsavelNome} />
          <ItemDado rotulo="Prioridade" valor={iniciativa.prioridade && ROTULOS_PRIORIDADE_INICIATIVA[iniciativa.prioridade]} />
          <ItemDado rotulo="Abertura" valor={formatarData(iniciativa.dataAbertura)} />
          <ItemDado rotulo="Previsão de conclusão" valor={iniciativa.dataPrevistaConclusao && formatarData(iniciativa.dataPrevistaConclusao)} />
          <ItemDado rotulo="Conclusão" valor={iniciativa.dataConclusao && formatarData(iniciativa.dataConclusao)} />
        </dl>
        {iniciativa.tipo === "reuniao_relevante" && (
          <p className="mt-4 text-sm text-texto-secundario">
            Esta iniciativa representa o assunto acompanhado. Cada encontro é registrado uma única vez em Interações e
            ligado a ela.
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-projetos" className={classeCartao}>
        <h2 id="titulo-projetos" className="mb-1 text-lg font-semibold">
          Projetos e temas
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Definem o contexto e quem pode ver a iniciativa. É preciso manter pelo menos um.
        </p>
        <ul className="flex flex-col divide-y divide-borda text-sm">
          {projetos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
              <span>
                <span className="text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                  {ROTULOS_TIPO_PROJETO_TEMA[p.tipo]}{" "}
                </span>
                <Link href={`/projetos-temas/${p.projetoTemaId}`} className={classeLink}>
                  {p.nome}
                </Link>
                <span className="text-texto-secundario"> · {p.comiteNome}</span>
              </span>
              {!arquivada && projetos.length > 1 && (
                <BotaoAcaoRegistro
                  acao={retirarProjetoDaIniciativaAcao}
                  campos={{ ligacaoId: p.id, iniciativaId: id }}
                  rotulo="Retirar"
                  rotuloEnviando="Retirando…"
                />
              )}
            </li>
          ))}
        </ul>
        {!arquivada && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Incluir projeto ou tema</summary>
            <div className="mt-4">
              <FormularioProjetoDaIniciativa iniciativaId={id} projetos={opcoesProjetos.filter((p) => !ligados.has(p.id))} />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-stakeholders" className={classeCartao}>
        <h2 id="titulo-stakeholders" className="mb-1 text-lg font-semibold">
          Stakeholders envolvidos
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Pessoas e instituições do Cadastro Mestre e o seu papel na iniciativa (lista de papéis provisória).
        </p>
        {stakeholders.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhum stakeholder incluído.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {stakeholders.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <span>
                  <Link href={`/${s.tipoStakeholder === "pessoa" ? "pessoas" : "instituicoes"}/${s.stakeholderId}`} className={classeLink}>
                    {s.nome}
                  </Link>
                  <span className="text-texto-secundario"> · {ROTULOS_PAPEL_INICIATIVA[s.papel]}</span>
                  {s.observacao && <span className="block text-xs text-texto-secundario">{s.observacao}</span>}
                </span>
                {!arquivada && (
                  <BotaoAcaoRegistro
                    acao={retirarStakeholderDaIniciativaAcao}
                    campos={{ ligacaoId: s.id, iniciativaId: id }}
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
            <summary className="cursor-pointer font-medium">Incluir stakeholder</summary>
            <div className="mt-4">
              <FormularioStakeholderDaIniciativa iniciativaId={id} pessoas={opcoes.pessoas} instituicoes={opcoes.instituicoes} />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-interacoes" className={classeCartao}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-interacoes" className="text-lg font-semibold">
            Interações
          </h2>
          {!arquivada && (
            <Link href={`/interacoes/nova?iniciativa=${id}`} className={classeLink}>
              Registrar interação
            </Link>
          )}
        </div>
        <p className="mb-4 text-sm text-texto-secundario">
          Reuniões e contatos que contribuíram para esta iniciativa. Uma interação já registrada pode ser ligada a esta
          iniciativa na página dela, sem novo registro.
        </p>
        {interacoes.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhuma interação ligada.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {interacoes.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/interacoes/${i.id}`} className={classeLink}>
                    {i.assunto}
                  </Link>
                  <SeloInteracao situacao={i.situacao} />
                </div>
                <p className="text-texto-secundario">
                  {ROTULOS_TIPO_INTERACAO[i.tipo]} · {formatarDataHora(i.inicio)}
                  {i.contribuicao && ` · ${i.contribuicao}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-compromissos" className={classeCartao}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-compromissos" className="text-lg font-semibold">
            Compromissos
          </h2>
          <Link href={`/compromissos?iniciativa=${id}&prazo=todos`} className={classeLink}>
            Ver na lista de compromissos
          </Link>
        </div>
        <p className="mb-4 text-sm text-texto-secundario">
          Encaminhamentos ligados à iniciativa ou gerados pelas suas interações sem indicar outra iniciativa.
        </p>
        <ListaCompromissos compromissos={compromissos} hoje={hoje} vazio="Nenhum compromisso." />
        {!arquivada && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Registrar compromisso da iniciativa</summary>
            <div className="mt-4">
              <FormularioCompromisso
                inicial={{ iniciativaId: id }}
                iniciativas={[]}
                usuarios={usuarios}
                pessoas={opcoes.pessoas}
                instituicoes={opcoes.instituicoes}
                voltarPara={`/iniciativas/${id}`}
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
