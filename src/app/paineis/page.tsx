import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoSecundario } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { BlocoIndicadores, FiltrosDoPainel, IndiceDosBlocos, TabelaPanorama, TabelaProjetos } from "@/modulos/paineis/componentes/blocos";
import { BotaoImprimir } from "@/modulos/paineis/componentes/botao-imprimir";
import { MatrizesDeRiscos } from "@/modulos/paineis/componentes/matrizes";
import { carregarDadosDoPainel } from "@/modulos/paineis/dados";
import { lerFiltros, parametrosDosFiltros } from "@/modulos/paineis/filtros";
import { calcularBlocos, calcularPanorama, calcularPorProjeto, projetosNoEscopo, riscosDoEscopo } from "@/modulos/paineis/indicadores";

export const metadata: Metadata = { title: "Painéis" };

const REGISTROS: Record<string, string> = {
  comites: "/projetos-temas",
  iniciativas: "/iniciativas",
  interacoes: "/interacoes",
  compromissos: "/compromissos",
  planos: "/planos",
  riscos: "/riscos",
};

export default function PaginaPaineis({ searchParams }: PageProps<"/paineis">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/paineis">, "searchParams">) {
  const { filtros, periodoInvertido } = lerFiltros(await searchParams);
  const banco = await bancoDaRequisicao();
  const hoje = hojeEmBrasilia();
  const dados = await carregarDadosDoPainel(banco, hoje);
  const escopo = projetosNoEscopo(dados, filtros);
  const contexto = { dados, escopo, filtros, hoje };
  const panorama = calcularPanorama(dados, escopo, filtros, hoje);
  const blocos = calcularBlocos(dados, escopo, filtros, hoje);
  const porProjeto = calcularPorProjeto(dados, escopo, filtros, hoje);
  const riscos = riscosDoEscopo(contexto);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Painéis executivos"
        descricao="Situação consolidada, com as informações registradas no CRM. Os números consideram só os projetos e temas que o seu perfil pode ver."
        acoes={
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <Link href={`/paineis/relatorios${parametrosDosFiltros(filtros)}`} className={`${classeBotaoSecundario} whitespace-nowrap print:hidden`}>
              Relatórios e exportações
            </Link>
            <BotaoImprimir />
          </div>
        }
      />
      <FiltrosDoPainel filtros={filtros} periodoInvertido={periodoInvertido} comites={dados.comites} projetos={dados.projetos} usuarios={dados.usuarios} caminho="/paineis" />
      {escopo.size === 0 && (
        <Alerta tom="aviso">Nenhum projeto ou tema disponível com estes filtros. Peça acesso ao administrador do sistema, se precisar.</Alerta>
      )}
      <IndiceDosBlocos blocos={blocos} />
      <TabelaPanorama linhas={panorama.linhas} total={panorama.total} />
      <TabelaProjetos linhas={porProjeto} projetos={dados.projetos.filter((p) => escopo.has(p.id))} />
      {blocos.map((bloco) => (
        <BlocoIndicadores key={bloco.id} bloco={bloco} verRegistros={REGISTROS[bloco.id]}>
          {bloco.id === "riscos" && <MatrizesDeRiscos riscos={riscos} />}
        </BlocoIndicadores>
      ))}
    </div>
  );
}
