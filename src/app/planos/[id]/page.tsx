import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { BotaoAcaoRegistro } from "@/componentes/botao-acao-registro";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import {
  classeBotaoPrimario,
  classeBotaoSecundario,
  classeCartao,
  classeCelula,
  classeCelulaCabecalho,
  classeLink,
  classeTabela,
} from "@/componentes/estilos";
import { AreaConformePermissao } from "@/modulos/acesso/componentes/area-conforme-permissao";
import { podeEditarRegistro } from "@/modulos/acesso/capacidades";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData, formatarDataHora, hojeEmBrasilia } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { HistoricoAtividade } from "@/modulos/iniciativas/componentes/historico-atividade";
import { nomesDoHistorico } from "@/modulos/iniciativas/historico";
import { arquivarEixoAcao, criarNovaVersaoAcao } from "@/modulos/plano-acao/acoes";
import { RegrasDeVersao } from "@/modulos/plano-acao/componentes/diferencas-versao";
import { FormularioEixo } from "@/modulos/plano-acao/componentes/formularios-plano";
import { ProgressoMarcos, SeloAcao, SeloVersao } from "@/modulos/plano-acao/componentes/selos";
import {
  type AcaoVigente,
  acoesVigentes,
  decisoesDoPlano,
  eixosDoPlano,
  historicoDoPlano,
  listarVersoes,
  obterPlano,
  planoEhVisivel,
  versaoEmElaboracao,
} from "@/modulos/plano-acao/consultas";
import { ROTULOS_DECISAO } from "@/modulos/plano-acao/rotulos";

export const metadata: Metadata = { title: "Plano de ação" };

export default function PaginaPlano({ params }: PageProps<"/planos/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalhePlano params={params} />
    </Suspense>
  );
}

async function DetalhePlano({ params }: Pick<PageProps<"/planos/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const plano = await obterPlano(banco, id);
  if (!plano || !(await planoEhVisivel(banco, id, await projetosVisiveis(banco, usuario.id)))) notFound();
  const hoje = hojeEmBrasilia();

  const [vigentes, eixos, versoes, emElaboracao, decisoes, historico] = await Promise.all([
    acoesVigentes(banco, id, hoje),
    eixosDoPlano(banco, id),
    listarVersoes(banco, id),
    versaoEmElaboracao(banco, id),
    decisoesDoPlano(banco, id),
    historicoDoPlano(banco, id),
  ]);
  const nomes = await nomesDoHistorico(banco, historico);
  const acoes = vigentes.acoes;
  const atrasadas = acoes.filter((a) => a.atrasada).length;
  const marcosPrevistos = acoes.reduce((t, a) => t + a.marcos.length, 0);
  const marcosAlcancados = acoes.reduce((t, a) => t + a.marcos.filter((m) => m.alcancadoEm).length, 0);
  // Ações agrupadas por pilar ou eixo, na ordem do plano; sem pilar, ao final.
  const grupos = [
    ...eixos.map((e) => ({ chave: e.id, titulo: `${e.codigo} – ${e.nome}`, objetivo: e.objetivo, acoes: acoes.filter((a) => a.eixoId === e.id) })),
    { chave: "sem-eixo", titulo: "Sem pilar ou eixo", objetivo: null, acoes: acoes.filter((a) => !a.eixoId || !eixos.some((e) => e.id === a.eixoId)) },
  ].filter((g) => g.acoes.length > 0);

  const podeEditar = await podeEditarRegistro(banco, "plano", id);
  return (
    <AreaConformePermissao podeEditar={podeEditar}>
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={plano.titulo}
        voltar={{ href: "/planos", rotulo: "Planos de ação" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/projetos-temas/${plano.projetoTemaId}`} className={classeLink}>
              {plano.projetoNome}
            </Link>
            <span>· {plano.comiteNome}</span>
            {vigentes.versao ? <SeloVersao situacao="aprovada" /> : <span>· nenhuma versão aprovada</span>}
            {vigentes.versao && <span>Versão {vigentes.versao.numeroVersao}</span>}
          </span>
        }
        acoes={
          <>
            {emElaboracao ? (
              <Link href={`/planos/${id}/versoes/${emElaboracao.id}`} className={classeBotaoPrimario}>
                Abrir versão {emElaboracao.numeroVersao} ({emElaboracao.situacao === "rascunho" ? "rascunho" : "em aprovação"})
              </Link>
            ) : (
              <BotaoAcaoRegistro
                acao={criarNovaVersaoAcao}
                campos={{ planoAcaoId: id }}
                rotulo="Criar nova versão"
                rotuloEnviando="Criando…"
                classeBotao={classeBotaoPrimario}
              />
            )}
            <Link href={`/planos/${id}/editar`} className={classeBotaoSecundario}>
              Editar dados
            </Link>
          </>
        }
      />

      {emElaboracao?.situacao === "em_aprovacao" && (
        <Alerta tom="aviso" titulo={`Versão ${emElaboracao.numeroVersao} aguardando decisão`}>
          A versão proposta está em aprovação. Enquanto isso, a versão vigente continua valendo.{" "}
          <Link href={`/planos/${id}/versoes/${emElaboracao.id}`} className={classeLink}>
            Ver as mudanças e decidir
          </Link>
        </Alerta>
      )}

      <section aria-labelledby="titulo-dados" className={classeCartao}>
        <h2 id="titulo-dados" className="mb-4 text-lg font-semibold">
          Dados gerais
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-texto-secundario">Objetivo geral</dt>
            <dd className="mt-0.5 whitespace-pre-line">{plano.objetivo || "—"}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Responsável (equipe)</dt>
            <dd className="mt-0.5">{plano.responsavelNome || "—"}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Andamento da versão vigente</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-3">
              <span>{acoes.length} ações</span>
              <span className={atrasadas > 0 ? "font-semibold text-red-800 dark:text-red-300" : undefined}>{atrasadas} atrasadas</span>
              <ProgressoMarcos alcancados={marcosAlcancados} previstos={marcosPrevistos} />
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="titulo-acoes" className={classeCartao}>
        <h2 id="titulo-acoes" className="mb-1 text-lg font-semibold">
          Ações da versão vigente
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Por pilar ou eixo. O acompanhamento (situação, marcos, percentual e observações) é registrado na página de cada ação,
          sem aprovação.
        </p>
        {!vigentes.versao ? (
          <p className="text-sm text-texto-secundario">
            Ainda não há versão aprovada. Inclua as ações na versão em rascunho e envie-a para aprovação.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {grupos.map((g) => (
              <div key={g.chave}>
                <h3 className="font-semibold">{g.titulo}</h3>
                {g.objetivo && <p className="mb-2 text-sm text-texto-secundario">{g.objetivo}</p>}
                <TabelaAcoes acoes={g.acoes} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-eixos" className={classeCartao}>
        <h2 id="titulo-eixos" className="mb-1 text-lg font-semibold">
          Pilares ou eixos
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Organização própria deste projeto ou tema (os pilares do Comitê de Infraestrutura são apenas um modelo de referência).
        </p>
        {eixos.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhum pilar ou eixo.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {eixos.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span>
                    <span className="font-semibold">
                      {e.codigo} – {e.nome}
                    </span>
                    {e.objetivo && <span className="block text-texto-secundario">{e.objetivo}</span>}
                    {e.descricao && <span className="block text-xs text-texto-secundario">{e.descricao}</span>}
                  </span>
                  <BotaoAcaoRegistro acao={arquivarEixoAcao} campos={{ id: e.id, planoAcaoId: id }} rotulo="Arquivar" rotuloEnviando="Arquivando…" />
                </div>
                <details className="rounded-lg border border-borda p-3">
                  <summary className="cursor-pointer font-medium">Alterar</summary>
                  <div className="mt-3">
                    <FormularioEixo planoId={id} eixo={e} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4 rounded-lg border border-borda p-4">
          <summary className="cursor-pointer font-medium">Incluir pilar ou eixo</summary>
          <div className="mt-4">
            <FormularioEixo planoId={id} />
          </div>
        </details>
      </section>

      <section aria-labelledby="titulo-versoes" className={classeCartao}>
        <h2 id="titulo-versoes" className="mb-1 text-lg font-semibold">
          Versões
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Mudanças estruturais criam nova versão, que só vigora depois de aprovada. As versões anteriores ficam preservadas.
        </p>
        <ul className="flex flex-col divide-y divide-borda text-sm">
          {versoes.map((v) => (
            <li key={v.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/planos/${id}/versoes/${v.id}`} className={classeLink}>
                  Versão {v.numeroVersao}
                </Link>
                {v.arquivadoEm ? <span className="text-texto-secundario">(rascunho descartado)</span> : <SeloVersao situacao={v.situacao} />}
              </div>
              {v.motivoAlteracao && <p className="text-texto-secundario">Motivo: {v.motivoAlteracao}</p>}
              {v.decididaEm && (
                <p className="text-texto-secundario">
                  Decidida em {formatarDataHora(v.decididaEm)}
                  {v.decididaPorNome && ` por ${v.decididaPorNome}`}
                  {v.parecer && ` · Parecer: ${v.parecer}`}
                </p>
              )}
            </li>
          ))}
        </ul>
        <details className="mt-4 rounded-lg border border-borda p-4">
          <summary className="cursor-pointer font-medium">O que exige nova versão</summary>
          <div className="mt-4">
            <RegrasDeVersao />
          </div>
        </details>
      </section>

      <section aria-labelledby="titulo-decisoes" className={classeCartao}>
        <h2 id="titulo-decisoes" className="mb-1 text-lg font-semibold">
          Fluxo de aprovação
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Aprovação em nível único pelo administrador ou pelo gestor do projeto ou tema; quem decidiu, a data e o parecer ficam
          registrados.
        </p>
        {decisoes.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhum envio para aprovação até agora.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {decisoes.map((d) => (
              <li key={d.id} className="py-2 first:pt-0 last:pb-0">
                <span className="font-medium">
                  Versão {d.numeroVersao}: {ROTULOS_DECISAO[d.decisao]}
                </span>
                <span className="text-texto-secundario">
                  {" "}
                  · {formatarDataHora(d.em)}
                  {d.porNome && ` · ${d.porNome}`}
                </span>
                {d.parecer && <span className="block text-texto-secundario">Parecer: {d.parecer}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-historico" className={classeCartao}>
        <h2 id="titulo-historico" className="mb-4 text-lg font-semibold">
          Histórico de alterações do plano
        </h2>
        <HistoricoAtividade registros={historico} nomes={nomes} />
      </section>
    </div>
    </AreaConformePermissao>
  );
}

function TabelaAcoes({ acoes }: { acoes: AcaoVigente[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-borda">
      <table className={classeTabela}>
        <thead>
          <tr>
            <th scope="col" className={classeCelulaCabecalho}>
              Ação
            </th>
            <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>
              Responsável
            </th>
            <th scope="col" className={`${classeCelulaCabecalho} hidden sm:table-cell`}>
              Prazo
            </th>
            <th scope="col" className={classeCelulaCabecalho}>
              Situação
            </th>
            <th scope="col" className={`${classeCelulaCabecalho} hidden lg:table-cell`}>
              Marcos
            </th>
          </tr>
        </thead>
        <tbody>
          {acoes.map((a) => (
            <tr key={a.acaoId}>
              <td className={classeCelula}>
                <span className="block text-xs font-semibold text-texto-secundario">{a.codigo}</span>
                <Link href={`/acoes/${a.acaoId}`} className={classeLink}>
                  {a.titulo}
                </Link>
                <span className="block text-xs text-texto-secundario sm:hidden">{a.fimPrevisto ? `Prazo ${formatarData(a.fimPrevisto)}` : "Sem prazo"}</span>
              </td>
              <td className={`${classeCelula} hidden md:table-cell`}>
                {[a.responsavelUsuarioNome, a.responsavelStakeholderNome].filter(Boolean).join(" / ") || "—"}
              </td>
              <td className={`${classeCelula} hidden whitespace-nowrap sm:table-cell`}>{a.fimPrevisto ? formatarData(a.fimPrevisto) : "—"}</td>
              <td className={classeCelula}>
                <SeloAcao situacao={a.andamento.situacao} atrasada={a.atrasada} />
                {a.andamento.percentual !== null && (
                  <span className="mt-1 block text-xs text-texto-secundario tabular-nums">{a.andamento.percentual}% informado</span>
                )}
              </td>
              <td className={`${classeCelula} hidden lg:table-cell`}>
                <ProgressoMarcos alcancados={a.marcos.filter((m) => m.alcancadoEm).length} previstos={a.marcos.length} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
