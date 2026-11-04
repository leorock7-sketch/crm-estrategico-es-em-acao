import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeCartao, classeLink } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData, formatarDataHora, hojeEmBrasilia } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { HistoricoAtividade } from "@/modulos/iniciativas/componentes/historico-atividade";
import { opcoesIniciativas } from "@/modulos/iniciativas/consultas";
import { nomesDoHistorico } from "@/modulos/iniciativas/historico";
import { alterarArquivamentoCompromisso } from "@/modulos/interacoes/acoes";
import { FormularioAcompanhamento, FormularioCompromisso } from "@/modulos/interacoes/componentes/formularios-compromisso";
import { ResponsavelCompromisso } from "@/modulos/interacoes/componentes/lista-compromissos";
import { SeloCompromisso } from "@/modulos/interacoes/componentes/selos";
import {
  acompanhamentosDoCompromisso,
  compromissoEhVisivel,
  historicoDoCompromisso,
  iniciativasDaInteracao,
  obterCompromisso,
  projetosDeUmCompromisso,
} from "@/modulos/interacoes/consultas";
import { ROTULOS_SITUACAO_COMPROMISSO } from "@/modulos/interacoes/rotulos";
import { FormularioConversaoCompromisso } from "@/modulos/plano-acao/componentes/formularios-plano";
import { acaoDoCompromisso, eixosDoPlano, obterAcao, opcoesPlanos } from "@/modulos/plano-acao/consultas";
import { opcoesStakeholders } from "@/modulos/projetos-temas/consultas";
import { BotaoArquivamento } from "@/modulos/stakeholders/componentes/botao-arquivamento";

export const metadata: Metadata = { title: "Compromisso" };

export default function PaginaCompromisso({ params }: PageProps<"/compromissos/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheCompromisso params={params} />
    </Suspense>
  );
}

async function DetalheCompromisso({ params }: Pick<PageProps<"/compromissos/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();

  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const compromisso = await obterCompromisso(banco, id);
  if (!compromisso || !(await compromissoEhVisivel(banco, id, visiveis))) notFound();

  const [acompanhamentos, historico, usuarios, opcoes, iniciativas] = await Promise.all([
    acompanhamentosDoCompromisso(banco, id),
    historicoDoCompromisso(banco, id),
    opcoesUsuarios(banco),
    opcoesStakeholders(banco),
    // Com interação de origem, a iniciativa é escolhida entre as dela; sem interação, entre as visíveis.
    compromisso.interacaoId
      ? iniciativasDaInteracao(banco, compromisso.interacaoId).then((l) => l.map((i) => ({ id: i.iniciativaId, titulo: i.titulo })))
      : opcoesIniciativas(banco, visiveis),
  ]);
  const nomes = await nomesDoHistorico(banco, historico);
  const hoje = hojeEmBrasilia();
  const arquivado = compromisso.arquivadoEm !== null;
  // Integração com o Plano de Ação: a ação em que foi convertido ou os planos dos seus projetos e temas.
  const acaoId = await acaoDoCompromisso(banco, id);
  const acaoConvertida = acaoId ? await obterAcao(banco, acaoId) : null;
  const planos = acaoConvertida ? [] : await opcoesPlanos(banco, await projetosDeUmCompromisso(banco, id));
  const eixos = (await Promise.all(planos.map(async (p) => (await eixosDoPlano(banco, p.id)).map((e) => ({ ...e, planoAcaoId: p.id }))))).flat();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Compromisso"
        voltar={{ href: "/compromissos", rotulo: "Compromissos" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <SeloCompromisso situacao={compromisso.situacao} prazo={compromisso.prazo} hoje={hoje} />
            {arquivado && <SeloSituacao tom="neutro">Arquivado</SeloSituacao>}
          </span>
        }
        acoes={<BotaoArquivamento acao={alterarArquivamentoCompromisso.bind(null, id, !arquivado)} arquivado={arquivado} />}
      />

      {arquivado && (
        <Alerta tom="aviso" titulo="Compromisso arquivado">
          Arquivado em {formatarDataHora(compromisso.arquivadoEm)}. Para alterar ou acompanhar, reative o compromisso.
        </Alerta>
      )}

      <section aria-labelledby="titulo-dados" className={classeCartao}>
        <h2 id="titulo-dados" className="mb-4 text-lg font-semibold">
          Encaminhamento
        </h2>
        <p className="mb-4 whitespace-pre-line break-words">{compromisso.descricao}</p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-texto-secundario">Responsável</dt>
            <dd className="mt-0.5">
              <ResponsavelCompromisso compromisso={compromisso} />
            </dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Prazo</dt>
            <dd className="mt-0.5">{compromisso.prazo ? formatarData(compromisso.prazo) : "Sem prazo"}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Situação</dt>
            <dd className="mt-0.5">
              {ROTULOS_SITUACAO_COMPROMISSO[compromisso.situacao]}
              {compromisso.concluidoEm && ` em ${formatarData(compromisso.concluidoEm)}`}
            </dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Origem</dt>
            <dd className="mt-0.5 flex flex-col gap-0.5">
              {compromisso.interacaoId && (
                <span>
                  Interação:{" "}
                  <Link href={`/interacoes/${compromisso.interacaoId}`} className={classeLink}>
                    {compromisso.interacaoAssunto}
                  </Link>
                </span>
              )}
              {compromisso.iniciativaId && (
                <span>
                  Iniciativa:{" "}
                  <Link href={`/iniciativas/${compromisso.iniciativaId}`} className={classeLink}>
                    {compromisso.iniciativaTitulo}
                  </Link>
                </span>
              )}
            </dd>
          </div>
        </dl>
        {!arquivado && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Editar encaminhamento, responsáveis ou prazo</summary>
            <div className="mt-4">
              <FormularioCompromisso
                inicial={{
                  id,
                  descricao: compromisso.descricao,
                  interacaoId: compromisso.interacaoId,
                  iniciativaId: compromisso.iniciativaId,
                  responsavelUsuarioId: compromisso.responsavelUsuarioId,
                  responsavelStakeholderId: compromisso.responsavelStakeholderId,
                  prazo: compromisso.prazo,
                }}
                iniciativas={iniciativas}
                usuarios={usuarios}
                pessoas={opcoes.pessoas}
                instituicoes={opcoes.instituicoes}
                voltarPara={`/compromissos/${id}`}
                rotuloBotao="Salvar alterações"
              />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-acompanhamento" className={classeCartao}>
        <h2 id="titulo-acompanhamento" className="mb-1 text-lg font-semibold">
          Acompanhamento
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Cada registro é preservado. A situação do compromisso muda por aqui, para que todo o andamento fique no histórico.
        </p>
        {acompanhamentos.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhum acompanhamento registrado.</p>
        ) : (
          <ol className="mb-4 flex flex-col gap-3">
            {acompanhamentos.map((a) => (
              <li key={a.id} className="border-l-2 border-borda pl-4 text-sm">
                <p className="text-xs text-texto-secundario">
                  {formatarData(a.data)} · {a.autorNome ?? "—"}
                  {a.situacao && (
                    <>
                      {" · "}
                      <span className="font-medium text-texto">situação: {ROTULOS_SITUACAO_COMPROMISSO[a.situacao]}</span>
                    </>
                  )}
                </p>
                <p className="mt-0.5 whitespace-pre-line break-words">{a.registro}</p>
              </li>
            ))}
          </ol>
        )}
        {!arquivado && (
          <div className="mt-4 rounded-lg border border-borda p-4">
            <h3 className="mb-3 font-medium">Registrar acompanhamento</h3>
            <FormularioAcompanhamento compromissoId={id} hoje={hoje} />
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-plano" className={classeCartao}>
        <h2 id="titulo-plano" className="mb-1 text-lg font-semibold">
          Plano de Ação
        </h2>
        {acaoConvertida ? (
          <p className="text-sm">
            Convertido na ação{" "}
            <Link href={`/acoes/${acaoConvertida.id}`} className={classeLink}>
              {acaoConvertida.codigo}
            </Link>{" "}
            do plano{" "}
            <Link href={`/planos/${acaoConvertida.planoAcaoId}`} className={classeLink}>
              {acaoConvertida.planoTitulo}
            </Link>
            . O compromisso continua registrado como origem.
          </p>
        ) : planos.length === 0 ? (
          <p className="text-sm text-texto-secundario">
            Os projetos e temas deste compromisso ainda não têm plano de ação.{" "}
            <Link href="/planos/novo" className={classeLink}>
              Criar plano
            </Link>
          </p>
        ) : arquivado ? (
          <p className="text-sm text-texto-secundario">Reative o compromisso para convertê-lo em ação do plano.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-texto-secundario">
              Se o encaminhamento passou a ser uma ação estruturada, converta-o em ação do plano de ação, sem duplicar o registro.
            </p>
            <details className="rounded-lg border border-borda p-4">
              <summary className="cursor-pointer font-medium">Converter em ação do plano</summary>
              <div className="mt-4">
                <FormularioConversaoCompromisso compromissoId={id} planos={planos} eixos={eixos} />
              </div>
            </details>
          </>
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
