/**
 * Plano de Ação e Matriz de Riscos nas páginas dos módulos anteriores
 * (projeto ou tema, pessoa, instituição e iniciativa): visão integrada, sem
 * duplicar registros.
 */
import Link from "next/link";
import { classeCartao, classeLink } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { SeloClassificacao } from "@/modulos/riscos/componentes/matriz-riscos";
import { resumoRiscosDoProjetoTema, riscosDaIniciativa, riscosDoStakeholder } from "@/modulos/riscos/consultas";
import { CLASSIFICACOES, ROTULOS_SITUACAO_RISCO, type Classificacao, type SituacaoRisco } from "@/modulos/riscos/rotulos";
import { acoesDaIniciativa, acoesDoStakeholder, listarPlanos } from "../consultas";
import { type SituacaoAcao } from "../rotulos";
import { ProgressoMarcos, SeloAcao } from "./selos";

type AcaoResumo = { id: string; codigo: string; titulo: string | null; projetoNome: string; situacao: SituacaoAcao | null };
type RiscoResumo = {
  id: string;
  codigo: string;
  titulo: string;
  situacao: SituacaoRisco;
  projetoNome: string;
  vigente: { classificacao: Classificacao; criticidade: number } | null;
};

function ListaAcoes({ acoes, vazio }: { acoes: AcaoResumo[]; vazio: string }) {
  if (acoes.length === 0) return <p className="text-sm text-texto-secundario">{vazio}</p>;
  return (
    <ul className="flex flex-col divide-y divide-borda text-sm">
      {acoes.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
          <span>
            <span className="block text-xs text-texto-secundario">
              {a.codigo} · {a.projetoNome}
            </span>
            <Link href={`/acoes/${a.id}`} className={classeLink}>
              {a.titulo ?? a.codigo}
            </Link>
          </span>
          <SeloAcao situacao={a.situacao} />
        </li>
      ))}
    </ul>
  );
}

function ListaRiscos({ riscos, vazio }: { riscos: RiscoResumo[]; vazio: string }) {
  if (riscos.length === 0) return <p className="text-sm text-texto-secundario">{vazio}</p>;
  return (
    <ul className="flex flex-col divide-y divide-borda text-sm">
      {riscos.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
          <span>
            <span className="block text-xs text-texto-secundario">
              {r.codigo} · {r.projetoNome} · {ROTULOS_SITUACAO_RISCO[r.situacao]}
            </span>
            <Link href={`/riscos/${r.id}`} className={classeLink}>
              {r.titulo}
            </Link>
          </span>
          {r.vigente && <SeloClassificacao classificacao={r.vigente.classificacao} valor={r.vigente.criticidade} />}
        </li>
      ))}
    </ul>
  );
}

/** Plano de ação e riscos de um projeto ou tema (resumo com atalhos). */
export async function PlanoERiscosDoProjetoTema({ projetoTemaId, arquivado }: { projetoTemaId: string; arquivado: boolean }) {
  const banco = await bancoDaRequisicao();
  const hoje = hojeEmBrasilia();
  const [[plano], riscos] = await Promise.all([listarPlanos(banco, hoje, "todos", projetoTemaId), resumoRiscosDoProjetoTema(banco, projetoTemaId, hoje)]);
  return (
    <section aria-labelledby="titulo-plano-riscos" className={classeCartao}>
      <h2 id="titulo-plano-riscos" className="mb-4 text-lg font-semibold">
        Plano de ação e riscos
      </h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="text-sm">
          <h3 className="mb-2 font-semibold text-texto-secundario">Plano de ação</h3>
          {plano ? (
            <>
              <Link href={`/planos/${plano.id}`} className={classeLink}>
                {plano.titulo}
              </Link>
              <p className="mt-1 text-texto-secundario">
                {plano.versaoVigente ? `Versão ${plano.versaoVigente} vigente` : "Nenhuma versão aprovada"} · {plano.acoes} ações ·{" "}
                <span className={plano.atrasadas > 0 ? "font-semibold text-red-800 dark:text-red-300" : undefined}>{plano.atrasadas} atrasadas</span>
              </p>
              <p className="mt-1">
                <ProgressoMarcos alcancados={plano.marcosAlcancados} previstos={plano.marcosPrevistos} />
              </p>
            </>
          ) : (
            <p className="text-texto-secundario">
              Sem plano de ação.{" "}
              {!arquivado && (
                <Link href={`/planos/novo?projeto=${projetoTemaId}`} className={classeLink}>
                  Criar plano
                </Link>
              )}
            </p>
          )}
        </div>
        <div className="text-sm">
          <h3 className="mb-2 font-semibold text-texto-secundario">Matriz de riscos</h3>
          {riscos.total === 0 ? (
            <p className="text-texto-secundario">Nenhum risco registrado.</p>
          ) : (
            <>
              <ul className="flex flex-wrap gap-2">
                {CLASSIFICACOES.filter((c) => riscos.porClassificacao[c] > 0)
                  .reverse()
                  .map((c) => (
                    <li key={c}>
                      <Link href={`/riscos?projeto=${projetoTemaId}&classificacao=${c}`}>
                        <SeloClassificacao classificacao={c} valor={riscos.porClassificacao[c]} />
                      </Link>
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-texto-secundario">
                {riscos.total} risco{riscos.total === 1 ? "" : "s"}, pela classificação vigente
                {riscos.escalonados > 0 && ` · ${riscos.escalonados} escalonado${riscos.escalonados === 1 ? "" : "s"}`}
                {riscos.reavaliar > 0 && (
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    {" "}
                    · {riscos.reavaliar} a reavaliar
                  </span>
                )}
              </p>
            </>
          )}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link href={`/riscos?projeto=${projetoTemaId}`} className={classeLink}>
              Ver matriz do projeto
            </Link>
            {!arquivado && (
              <Link href={`/riscos/novo?projeto=${projetoTemaId}`} className={classeLink}>
                Novo risco
              </Link>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Ações e riscos de que uma pessoa ou instituição participa ou é responsável. */
export async function AcoesERiscosDoStakeholder({ stakeholderId }: { stakeholderId: string }) {
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const [acoes, riscos] = await Promise.all([acoesDoStakeholder(banco, stakeholderId, visiveis), riscosDoStakeholder(banco, stakeholderId, visiveis)]);
  return (
    <section aria-labelledby="titulo-acoes-riscos" className={classeCartao}>
      <h2 id="titulo-acoes-riscos" className="mb-1 text-lg font-semibold">
        Ações do plano e riscos
      </h2>
      <p className="mb-4 text-sm text-texto-secundario">
        Ações de que é responsável (na versão vigente) ou com que se relaciona, e riscos em que está envolvido.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-texto-secundario">Ações</h3>
          <ListaAcoes acoes={acoes} vazio="Nenhuma ação." />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-texto-secundario">Riscos</h3>
          <ListaRiscos riscos={riscos} vazio="Nenhum risco." />
        </div>
      </div>
    </section>
  );
}

/** Ações do plano e riscos ligados a uma iniciativa. */
export async function AcoesERiscosDaIniciativa({ iniciativaId, arquivada }: { iniciativaId: string; arquivada: boolean }) {
  const banco = await bancoDaRequisicao();
  const [acoes, riscos] = await Promise.all([acoesDaIniciativa(banco, iniciativaId), riscosDaIniciativa(banco, iniciativaId)]);
  return (
    <section aria-labelledby="titulo-acoes-riscos" className={classeCartao}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-acoes-riscos" className="text-lg font-semibold">
          Ações do plano e riscos
        </h2>
        {!arquivada && (
          <Link href={`/riscos/novo?iniciativa=${iniciativaId}`} className={classeLink}>
            Registrar risco
          </Link>
        )}
      </div>
      <p className="mb-4 text-sm text-texto-secundario">
        Ações dos planos de ação ligadas a esta iniciativa (inclusive as convertidas de compromissos) e riscos relacionados.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-texto-secundario">Ações</h3>
          <ListaAcoes acoes={acoes} vazio="Nenhuma ação ligada." />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-texto-secundario">Riscos</h3>
          <ListaRiscos riscos={riscos} vazio="Nenhum risco ligado." />
        </div>
      </div>
    </section>
  );
}
