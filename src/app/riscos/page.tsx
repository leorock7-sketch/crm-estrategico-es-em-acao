import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { identificadorDoParametro, valorDaLista } from "@/lib/parametros";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { Filtro } from "@/modulos/iniciativas/componentes/filtros-iniciativas";
import { opcoesProjetosTemas } from "@/modulos/iniciativas/consultas";
import {
  ComparacaoInerenteResidual,
  LegendaFaixas,
  MatrizRiscos,
  ResumoAvaliacao,
} from "@/modulos/riscos/componentes/matriz-riscos";
import { listarRiscos } from "@/modulos/riscos/consultas";
import {
  CLASSIFICACOES,
  FAIXAS,
  NIVEIS_5,
  ROTULOS_SITUACAO_RISCO,
  SITUACOES_RISCO,
  TIPOS_AVALIACAO,
} from "@/modulos/riscos/rotulos";

export const metadata: Metadata = { title: "Matriz de Riscos" };

export default function PaginaRiscos({ searchParams }: PageProps<"/riscos">) {
  return (
    <>
      <CabecalhoPagina
        titulo="Matriz de Riscos"
        descricao="Riscos dos projetos e temas na matriz 5 × 5 do Comitê de Infraestrutura, com avaliações inerente e residual."
        acoes={
          <Link href="/riscos/novo" className={classeBotaoPrimario}>
            Novo risco
          </Link>
        }
      />
      <Suspense fallback={<Carregando />}>
        <ListaRiscos searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const NIVEIS_TEXTO = NIVEIS_5.map(String);

async function ListaRiscos({ searchParams }: Pick<PageProps<"/riscos">, "searchParams">) {
  const parametros = await searchParams;
  const gatilho = valorDaLista(parametros, "gatilho", ["sim", "nao"] as const);
  const filtro = {
    projetoTemaId: identificadorDoParametro(parametros, "projeto"),
    classificacao: valorDaLista(parametros, "classificacao", CLASSIFICACOES),
    situacao: valorDaLista(parametros, "situacao", SITUACOES_RISCO),
    responsavelId: identificadorDoParametro(parametros, "responsavel"),
    gatilhoOcorrido: gatilho === undefined ? undefined : gatilho === "sim",
    arquivados: parametros.arquivados === "sim",
  };
  // Célula escolhida em uma das matrizes (tipo, probabilidade e impacto).
  const celula = {
    tipo: valorDaLista(parametros, "tipo", TIPOS_AVALIACAO),
    p: valorDaLista(parametros, "p", NIVEIS_TEXTO),
    i: valorDaLista(parametros, "i", NIVEIS_TEXTO),
  };

  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const hoje = hojeEmBrasilia();
  const [todos, projetos, usuarios] = await Promise.all([
    listarRiscos(banco, filtro, hoje, visiveis),
    opcoesProjetosTemas(banco, visiveis),
    opcoesUsuarios(banco),
  ]);
  const riscos =
    celula.tipo && celula.p && celula.i
      ? todos.filter((r) => {
          const a = r[celula.tipo!];
          return a && a.probabilidade === Number(celula.p) && a.impacto === Number(celula.i);
        })
      : todos;

  const parametrosBase = new URLSearchParams();
  for (const [nome, valor] of Object.entries(parametros)) {
    if (typeof valor === "string" && !["tipo", "p", "i"].includes(nome)) parametrosBase.set(nome, valor);
  }
  const linkCelula = (tipo: string) => (p: number, i: number) => {
    const novos = new URLSearchParams(parametrosBase);
    novos.set("tipo", tipo);
    novos.set("p", String(p));
    novos.set("i", String(i));
    return `/riscos?${novos.toString()}#lista-riscos`;
  };

  return (
    <div className="flex flex-col gap-6">
      <form role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Filtro id="filtro-projeto" nome="projeto" rotulo="Projeto ou tema" valor={filtro.projetoTemaId ?? ""} todos="Todos">
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Filtro>
        <Filtro id="filtro-classificacao" nome="classificacao" rotulo="Criticidade vigente" valor={filtro.classificacao ?? ""} todos="Todas">
          {CLASSIFICACOES.map((c) => (
            <option key={c} value={c}>
              {FAIXAS[c].rotulo} ({FAIXAS[c].minimo} a {FAIXAS[c].maximo})
            </option>
          ))}
        </Filtro>
        <Filtro id="filtro-situacao" nome="situacao" rotulo="Status" valor={filtro.situacao ?? ""} todos="Todos">
          {SITUACOES_RISCO.map((s) => (
            <option key={s} value={s}>
              {ROTULOS_SITUACAO_RISCO[s]}
            </option>
          ))}
        </Filtro>
        <Filtro id="filtro-responsavel" nome="responsavel" rotulo="Dono do risco" valor={filtro.responsavelId ?? ""} todos="Todos">
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </Filtro>
        <Filtro id="filtro-gatilho" nome="gatilho" rotulo="Gatilho" valor={gatilho ?? ""} todos="Todos">
          <option value="sim">Gatilho ocorrido</option>
          <option value="nao">Sem gatilho ocorrido</option>
        </Filtro>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="arquivados" value="sim" defaultChecked={filtro.arquivados} className="size-4" />
            Incluir arquivados
          </label>
          <button type="submit" className={classeBotaoSecundario}>
            Filtrar
          </button>
        </div>
      </form>

      <section aria-labelledby="titulo-matrizes" className={classeCartao}>
        <h2 id="titulo-matrizes" className="mb-1 text-lg font-semibold">
          Matrizes de probabilidade × impacto
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Última avaliação de cada risco filtrado. Clique numa célula com riscos para listá-los.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <MatrizRiscos
            titulo="Risco inerente"
            descricao="Antes dos controles e das medidas de mitigação."
            avaliacoes={todos.map((r) => r.inerente)}
            linkCelula={linkCelula("inerente")}
          />
          <MatrizRiscos
            titulo="Risco residual"
            descricao="Depois dos controles efetivamente implementados (só os riscos já reavaliados)."
            avaliacoes={todos.map((r) => r.residual)}
            linkCelula={linkCelula("residual")}
          />
        </div>
        <div className="mt-4 border-t border-borda pt-4">
          <LegendaFaixas />
        </div>
        <p className="mt-4 text-xs text-texto-secundario">
          A criticidade (probabilidade × impacto, de 1 a 25) é um índice ordinal: a diferença entre o inerente e o residual
          indica mudança de faixa e de pontos do índice, não uma redução percentual da exposição real ao risco.
        </p>
      </section>

      <section id="lista-riscos" aria-labelledby="titulo-lista" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-lista" className="text-lg font-semibold">
            Riscos
          </h2>
          <p className="text-sm text-texto-secundario" role="status">
            {riscos.length === 1 ? "1 risco encontrado" : `${riscos.length} riscos encontrados`}
            {celula.tipo && celula.p && celula.i && (
              <>
                {" "}
                na célula P{celula.p} × I{celula.i} ({celula.tipo}) ·{" "}
                <Link href={`/riscos?${parametrosBase.toString()}`} className={classeLink}>
                  ver todos
                </Link>
              </>
            )}
          </p>
        </div>
        {riscos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda p-8 text-center text-texto-secundario">Nenhum risco encontrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
            <table className={classeTabela}>
              <caption className="sr-only">Riscos</caption>
              <thead>
                <tr>
                  <th scope="col" className={classeCelulaCabecalho}>
                    Risco
                  </th>
                  <th scope="col" className={classeCelulaCabecalho}>
                    Inerente
                  </th>
                  <th scope="col" className={classeCelulaCabecalho}>
                    Residual
                  </th>
                  <th scope="col" className={`${classeCelulaCabecalho} hidden xl:table-cell`}>
                    Comparação
                  </th>
                  <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>
                    Status
                  </th>
                  <th scope="col" className={`${classeCelulaCabecalho} hidden lg:table-cell`}>
                    Dono
                  </th>
                </tr>
              </thead>
              <tbody>
                {riscos.map((r) => (
                  <tr key={r.id}>
                    <td className={classeCelula}>
                      <span className="block text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                        {r.codigo} · {r.projetoNome}
                        {r.eixoCodigo && ` · ${r.eixoCodigo}`}
                      </span>
                      <Link href={`/riscos/${r.id}`} className={classeLink}>
                        {r.titulo}
                      </Link>
                      {r.arquivadoEm && (
                        <span className="ml-2 align-middle">
                          <SeloSituacao tom="neutro">Arquivado</SeloSituacao>
                        </span>
                      )}
                      <span className="mt-1 block md:hidden">
                        <SeloSituacao tom={r.situacao === "escalonado" ? "aviso" : "neutro"}>{ROTULOS_SITUACAO_RISCO[r.situacao]}</SeloSituacao>
                      </span>
                      {r.reavaliacao.map((m) => (
                        <span key={m} className="mt-1 block text-xs font-semibold text-amber-800 dark:text-amber-300">
                          ⚠ {m} Reavalie o risco.
                        </span>
                      ))}
                    </td>
                    <td className={classeCelula}>
                      <ResumoAvaliacao avaliacao={r.inerente} />
                    </td>
                    <td className={classeCelula}>
                      <ResumoAvaliacao avaliacao={r.residual} />
                    </td>
                    <td className={`${classeCelula} hidden xl:table-cell`}>
                      <ComparacaoInerenteResidual inerente={r.inerente} residual={r.residual} />
                    </td>
                    <td className={`${classeCelula} hidden whitespace-nowrap md:table-cell`}>
                      <SeloSituacao tom={r.situacao === "escalonado" ? "aviso" : r.situacao === "mitigado" ? "sucesso" : "neutro"}>
                        {ROTULOS_SITUACAO_RISCO[r.situacao]}
                      </SeloSituacao>
                    </td>
                    <td className={`${classeCelula} hidden lg:table-cell`}>{r.responsavelNome ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
