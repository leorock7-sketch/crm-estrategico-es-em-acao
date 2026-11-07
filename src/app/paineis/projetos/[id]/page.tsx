import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoSecundario, classeCartao, classeLink } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { MatrizTresPorTres } from "@/modulos/avaliacoes/componentes/matriz-tres-por-tres";
import { BlocoIndicadores, FiltrosDoPainel, IndiceDosBlocos } from "@/modulos/paineis/componentes/blocos";
import { BotaoImprimir } from "@/modulos/paineis/componentes/botao-imprimir";
import { ComparacaoDosRiscos, MatrizesDeRiscos } from "@/modulos/paineis/componentes/matrizes";
import { carregarDadosDoPainel } from "@/modulos/paineis/dados";
import { lerFiltros, parametrosDosFiltros } from "@/modulos/paineis/filtros";
import { calcularBlocos, classificacoesDoEscopo, riscosDoEscopo } from "@/modulos/paineis/indicadores";
import { ROTULOS_TIPO_PROJETO_TEMA } from "@/modulos/projetos-temas/rotulos";

export const metadata: Metadata = { title: "Painel do projeto ou tema" };

export default function PaginaPainelDoProjeto({ params, searchParams }: PageProps<"/paineis/projetos/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/paineis/projetos/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const lidos = lerFiltros(await searchParams);
  const filtros = { ...lidos.filtros, comiteId: undefined, projetoTemaId: id };
  const banco = await bancoDaRequisicao();
  const hoje = hojeEmBrasilia();
  const dados = await carregarDadosDoPainel(banco, hoje);
  // Projeto que as regras de acesso não entregam é tratado como inexistente.
  const projeto = dados.projetos.find((p) => p.id === id);
  if (!projeto) notFound();

  const escopo = new Set([id]);
  const contexto = { dados, escopo, filtros, hoje };
  const blocos = calcularBlocos(dados, escopo, filtros, hoje).filter((b) => b.id !== "comites");
  const riscos = riscosDoEscopo(contexto);
  const matriz = classificacoesDoEscopo(contexto)[0]?.matriz;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={projeto.nome}
        voltar={{ href: "/paineis", rotulo: "Painéis executivos" }}
        descricao={`${ROTULOS_TIPO_PROJETO_TEMA[projeto.tipo]} · ${projeto.comiteNome}`}
        acoes={
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <Link href={`/paineis/relatorios${parametrosDosFiltros(filtros)}`} className={`${classeBotaoSecundario} whitespace-nowrap print:hidden`}>
              Relatórios e exportações
            </Link>
            <BotaoImprimir />
          </div>
        }
      />
      <FiltrosDoPainel filtros={lidos.filtros} periodoInvertido={lidos.periodoInvertido} usuarios={dados.usuarios} caminho={`/paineis/projetos/${id}`} />
      <IndiceDosBlocos blocos={blocos} />
      {blocos.map((bloco) => (
        <BlocoIndicadores key={bloco.id} bloco={bloco}>
          {bloco.id === "riscos" && (
            <div className="flex flex-col gap-4">
              <MatrizesDeRiscos riscos={riscos} />
              <ComparacaoDosRiscos riscos={riscos} />
            </div>
          )}
          {bloco.id === "stakeholders" && matriz && dados.metodologia?.ordinal && matriz.noGrafico.length > 0 && (
            <MatrizTresPorTres fichas={matriz.noGrafico} caminhoFicha={(stakeholderId) => `/projetos-temas/${id}/avaliacoes/${stakeholderId}`} />
          )}
        </BlocoIndicadores>
      ))}
      <section className={`${classeCartao} text-sm print:hidden`}>
        <Link href={`/projetos-temas/${id}`} className={classeLink}>
          Abrir a página completa do {projeto.tipo === "tema" ? "tema" : "projeto"}
        </Link>
      </section>
    </div>
  );
}
