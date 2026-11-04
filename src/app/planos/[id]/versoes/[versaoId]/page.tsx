import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { BotaoAcaoRegistro } from "@/componentes/botao-acao-registro";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeCartao, classeLink } from "@/componentes/estilos";
import { usuario as tabelaUsuario } from "@/lib/banco/esquema";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { opcoesIniciativas } from "@/modulos/iniciativas/consultas";
import { descartarRascunhoAcao, retirarAcaoDaVersaoAcao, retirarMarcoAcao } from "@/modulos/plano-acao/acoes";
import { DiferencasVersao, RegrasDeVersao } from "@/modulos/plano-acao/componentes/diferencas-versao";
import {
  FormularioAcaoPlanejada,
  FormularioDecisao,
  FormularioEnvio,
  FormularioMarco,
} from "@/modulos/plano-acao/componentes/formularios-plano";
import { SeloVersao } from "@/modulos/plano-acao/componentes/selos";
import {
  type AcaoDaVersao,
  eixosDoPlano,
  listarVersoes,
  obterPlano,
  obterVersao,
  planejamentoDaVersao,
  planoEhVisivel,
} from "@/modulos/plano-acao/consultas";
import { diferencasEntreVersoes } from "@/modulos/plano-acao/diferencas";
import { ROTULOS_PERIODICIDADE } from "@/modulos/plano-acao/rotulos";
import { opcoesStakeholders } from "@/modulos/projetos-temas/consultas";

export const metadata: Metadata = { title: "Versão do plano de ação" };

export default function PaginaVersaoPlano({ params }: PageProps<"/planos/[id]/versoes/[versaoId]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheVersao params={params} />
    </Suspense>
  );
}

const EXPLICACOES = {
  rascunho: "Versão em elaboração: inclua, altere ou retire ações e marcos e, quando estiver pronta, envie para aprovação.",
  em_aprovacao: "Versão aguardando decisão. Para alterá-la, é preciso devolvê-la para ajustes.",
  aprovada: "Versão vigente: as ações dela recebem acompanhamento. Para mudar o planejamento, crie uma nova versão.",
  rejeitada: "Versão rejeitada, preservada para consulta.",
  substituida: "Versão substituída por outra aprovada depois, preservada para consulta.",
} as const;

async function DetalheVersao({ params }: Pick<PageProps<"/planos/[id]/versoes/[versaoId]">, "params">) {
  const { id, versaoId } = await params;
  if (!esquemaIdentificador.safeParse(id).success || !esquemaIdentificador.safeParse(versaoId).success) notFound();
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const [plano, versao] = await Promise.all([obterPlano(banco, id), obterVersao(banco, versaoId)]);
  if (!plano || !versao || versao.planoAcaoId !== id || !(await planoEhVisivel(banco, id, visiveis))) notFound();

  const versoes = await listarVersoes(banco, id);
  // Base da comparação: a última versão aprovada (vigente ou substituída) anterior a esta.
  const base = versoes.find(
    (v) => v.numeroVersao < versao.numeroVersao && (v.situacao === "aprovada" || v.situacao === "substituida") && !v.arquivadoEm,
  );
  const [planejadas, anteriores, eixos, usuarios, opcoes, iniciativas, perfil] = await Promise.all([
    planejamentoDaVersao(banco, versaoId),
    base ? planejamentoDaVersao(banco, base.id) : Promise.resolve([]),
    eixosDoPlano(banco, id),
    opcoesUsuarios(banco),
    opcoesStakeholders(banco),
    opcoesIniciativas(banco, visiveis),
    banco.select({ administrador: tabelaUsuario.administrador }).from(tabelaUsuario).where(eq(tabelaUsuario.id, usuario.id)),
  ]);
  const diferencas = diferencasEntreVersoes(anteriores, planejadas);
  const descartada = versao.arquivadoEm !== null;
  const editavel = versao.situacao === "rascunho" && !descartada && !plano.arquivadoEm;
  const administrador = perfil[0]?.administrador === true;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={`Versão ${versao.numeroVersao} do plano`}
        voltar={{ href: `/planos/${id}`, rotulo: plano.titulo }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <span>{plano.projetoNome}</span>
            {descartada ? <span>· rascunho descartado</span> : <SeloVersao situacao={versao.situacao} />}
          </span>
        }
        acoes={
          editavel && versao.numeroVersao > 1 ? (
            <BotaoAcaoRegistro acao={descartarRascunhoAcao} campos={{ versaoId }} rotulo="Descartar rascunho" rotuloEnviando="Descartando…" />
          ) : undefined
        }
      />

      {!descartada && <Alerta tom={versao.situacao === "aprovada" ? "sucesso" : "aviso"}>{EXPLICACOES[versao.situacao]}</Alerta>}

      {(versao.motivoAlteracao || versao.decididaEm || versao.propostaEm) && (
        <section aria-labelledby="titulo-registro" className={classeCartao}>
          <h2 id="titulo-registro" className="mb-3 text-lg font-semibold">
            Registro da versão
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {versao.motivoAlteracao && (
              <div className="sm:col-span-2">
                <dt className="text-texto-secundario">Motivo da alteração</dt>
                <dd className="mt-0.5 whitespace-pre-line">{versao.motivoAlteracao}</dd>
              </div>
            )}
            {versao.propostaEm && (
              <div>
                <dt className="text-texto-secundario">Enviada para aprovação</dt>
                <dd className="mt-0.5">{formatarDataHora(versao.propostaEm)}</dd>
              </div>
            )}
            {versao.decididaEm && (
              <div>
                <dt className="text-texto-secundario">Decisão</dt>
                <dd className="mt-0.5">
                  {formatarDataHora(versao.decididaEm)}
                  {versao.decididaPorNome && ` · ${versao.decididaPorNome}`}
                </dd>
              </div>
            )}
            {versao.parecer && (
              <div className="sm:col-span-2">
                <dt className="text-texto-secundario">Parecer</dt>
                <dd className="mt-0.5 whitespace-pre-line">{versao.parecer}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {versao.situacao === "em_aprovacao" && (
        <section aria-labelledby="titulo-decisao" className={`${classeCartao} border-amber-400`}>
          <h2 id="titulo-decisao" className="mb-1 text-lg font-semibold">
            Decisão sobre a versão
          </h2>
          <p className="mb-4 text-sm text-texto-secundario">
            Aprovação em nível único pelo administrador do sistema (provisória, até a autenticação). Confira as mudanças
            abaixo antes de decidir.
          </p>
          {administrador ? (
            <FormularioDecisao versaoId={versaoId} />
          ) : (
            <p className="text-sm text-texto-secundario">Somente o administrador do sistema decide sobre versões do plano.</p>
          )}
        </section>
      )}

      <section aria-labelledby="titulo-diferencas" className={classeCartao}>
        <h2 id="titulo-diferencas" className="mb-1 text-lg font-semibold">
          O que muda {base ? `em relação à versão ${base.numeroVersao}` : "(primeira versão)"}
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          {base ? "Comparação com a versão aprovada anterior, campo a campo." : "Todas as ações desta versão são novas."}
        </p>
        <DiferencasVersao diferencas={diferencas} vazio="Nenhuma diferença em relação à versão aprovada anterior." />
      </section>

      {editavel && (
        <section aria-labelledby="titulo-envio" className={classeCartao}>
          <h2 id="titulo-envio" className="mb-1 text-lg font-semibold">
            Enviar para aprovação
          </h2>
          <p className="mb-4 text-sm text-texto-secundario">Depois de enviada, a versão só muda se for devolvida para ajustes.</p>
          <FormularioEnvio versaoId={versaoId} exigeMotivo={versao.numeroVersao > 1} />
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">O que exige nova versão</summary>
            <div className="mt-4">
              <RegrasDeVersao />
            </div>
          </details>
        </section>
      )}

      <section aria-labelledby="titulo-planejamento" className={classeCartao}>
        <h2 id="titulo-planejamento" className="mb-1 text-lg font-semibold">
          Ações e marcos desta versão
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          {planejadas.length === 1 ? "1 ação" : `${planejadas.length} ações`}. Os códigos (A-01, M1…) são permanentes entre as versões.
        </p>
        {planejadas.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhuma ação nesta versão.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {planejadas.map((a) => (
              <ItemAcao
                key={a.id}
                acao={a}
                versaoId={versaoId}
                editavel={editavel}
                eixos={eixos}
                usuarios={usuarios}
                opcoes={opcoes}
                iniciativas={iniciativas}
              />
            ))}
          </ul>
        )}
        {editavel && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Incluir nova ação</summary>
            <div className="mt-4">
              <FormularioAcaoPlanejada
                versaoId={versaoId}
                eixos={eixos}
                usuarios={usuarios}
                pessoas={opcoes.pessoas}
                instituicoes={opcoes.instituicoes}
                iniciativas={iniciativas}
              />
            </div>
          </details>
        )}
      </section>
    </div>
  );
}

function ItemAcao({
  acao: a,
  versaoId,
  editavel,
  eixos,
  usuarios,
  opcoes,
  iniciativas,
}: {
  acao: AcaoDaVersao;
  versaoId: string;
  editavel: boolean;
  eixos: { id: string; codigo: string; nome: string }[];
  usuarios: { id: string; nome: string }[];
  opcoes: { pessoas: { id: string; nome: string }[]; instituicoes: { id: string; nome: string }[] };
  iniciativas: { id: string; titulo: string }[];
}) {
  return (
    <li className="rounded-lg border border-borda p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-texto-secundario">
            {a.codigo}
            {a.eixoCodigo && ` · ${a.eixoCodigo} – ${a.eixoNome}`}
          </span>
          <Link href={`/acoes/${a.acaoId}`} className={classeLink}>
            {a.titulo}
          </Link>
        </div>
        {editavel && (
          <BotaoAcaoRegistro acao={retirarAcaoDaVersaoAcao} campos={{ planejamentoId: a.id }} rotulo="Retirar desta versão" rotuloEnviando="Retirando…" />
        )}
      </div>
      <p className="mt-1 text-texto-secundario">
        {[a.responsavelUsuarioNome, a.responsavelStakeholderNome].filter(Boolean).join(" / ")}
        {a.inicioPrevisto && ` · início ${formatarData(a.inicioPrevisto)}`}
        {a.fimPrevisto && ` · prazo ${formatarData(a.fimPrevisto)}`}
        {a.periodicidade && ` · acompanhamento ${ROTULOS_PERIODICIDADE[a.periodicidade].toLowerCase()}`}
        {a.iniciativaTitulo && ` · iniciativa: ${a.iniciativaTitulo}`}
      </p>
      {a.descricao && <p className="mt-1 whitespace-pre-line">{a.descricao}</p>}
      {a.justificativa && <p className="mt-1 text-texto-secundario">Justificativa: {a.justificativa}</p>}
      <div className="mt-3">
        <p className="font-medium">Marcos</p>
        {a.marcos.length === 0 ? (
          <p className="text-texto-secundario">Nenhum marco.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-2">
            {a.marcos.map((m) => (
              <li key={m.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{m.codigo}</span> {m.descricao}
                    {m.prazoPrevisto && <span className="text-texto-secundario"> · prazo {formatarData(m.prazoPrevisto)}</span>}
                  </span>
                  {editavel && (
                    <BotaoAcaoRegistro acao={retirarMarcoAcao} campos={{ marcoPlanejamentoId: m.id }} rotulo="Retirar" rotuloEnviando="Retirando…" />
                  )}
                </div>
                {editavel && (
                  <details className="rounded-lg border border-borda p-2">
                    <summary className="cursor-pointer text-xs font-medium">Alterar marco</summary>
                    <div className="mt-2">
                      <FormularioMarco versaoId={versaoId} acaoId={a.acaoId} marco={m} />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {editavel && (
        <div className="mt-3 flex flex-col gap-2">
          <details className="rounded-lg border border-borda p-3">
            <summary className="cursor-pointer font-medium">Incluir marco</summary>
            <div className="mt-3">
              <FormularioMarco versaoId={versaoId} acaoId={a.acaoId} />
            </div>
          </details>
          <details className="rounded-lg border border-borda p-3">
            <summary className="cursor-pointer font-medium">Alterar planejamento da ação</summary>
            <div className="mt-3">
              <FormularioAcaoPlanejada
                versaoId={versaoId}
                inicial={{
                  planejamentoId: a.id,
                  eixoId: a.eixoId,
                  titulo: a.titulo,
                  descricao: a.descricao,
                  justificativa: a.justificativa,
                  responsavelUsuarioId: a.responsavelUsuarioId,
                  responsavelStakeholderId: a.responsavelStakeholderId,
                  inicioPrevisto: a.inicioPrevisto,
                  fimPrevisto: a.fimPrevisto,
                  periodicidade: a.periodicidade,
                }}
                eixos={eixos}
                usuarios={usuarios}
                pessoas={opcoes.pessoas}
                instituicoes={opcoes.instituicoes}
                iniciativas={iniciativas}
              />
            </div>
          </details>
        </div>
      )}
    </li>
  );
}
