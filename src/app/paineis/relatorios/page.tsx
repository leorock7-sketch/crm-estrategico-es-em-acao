import type { Metadata } from "next";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCartao } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { FiltrosDoPainel } from "@/modulos/paineis/componentes/blocos";
import { BotaoImprimir } from "@/modulos/paineis/componentes/botao-imprimir";
import { carregarDadosDoPainel } from "@/modulos/paineis/dados";
import { lerFiltros, parametrosDosFiltros } from "@/modulos/paineis/filtros";
import { CODIGOS_RELATORIO, escopoDeExportacao, RELATORIOS } from "@/modulos/paineis/relatorios";

export const metadata: Metadata = { title: "Relatórios e exportações" };

export default function PaginaRelatorios({ searchParams }: PageProps<"/paineis/relatorios">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/paineis/relatorios">, "searchParams">) {
  const { filtros, periodoInvertido } = lerFiltros(await searchParams);
  const banco = await bancoDaRequisicao();
  const dados = await carregarDadosDoPainel(banco, hojeEmBrasilia());
  const escopo = await escopoDeExportacao(banco);
  const parametros = parametrosDosFiltros(filtros);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Relatórios e exportações"
        voltar={{ href: `/paineis${parametros}`, rotulo: "Painéis executivos" }}
        descricao="Arquivos XLSX com os filtros abaixo, a data da extração e o usuário responsável."
        acoes={<BotaoImprimir />}
      />
      <FiltrosDoPainel filtros={filtros} periodoInvertido={periodoInvertido} comites={dados.comites} projetos={dados.projetos} usuarios={dados.usuarios} caminho="/paineis/relatorios" />
      {!escopo.podeExportar ? (
        <Alerta tom="aviso" titulo="Exportação pelo sistema indisponível para o seu perfil">
          O perfil de leitor consulta os painéis na tela. A exportação pelo CRM é de administrador, gestor e colaborador. Esta regra vale para os recursos do sistema: ela não impede capturas ou impressões feitas pelo próprio navegador.
        </Alerta>
      ) : (
        <>
          {escopo.projetos !== "todos" && (
            <p className="text-sm text-texto-secundario">
              Os arquivos trazem só os projetos e temas em que você é gestor ou colaborador. Avaliações nominais de stakeholders, só onde você é gestor.
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {CODIGOS_RELATORIO.map((codigo) => (
              <li key={codigo} className={`${classeCartao} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <h2 className="font-semibold">{RELATORIOS[codigo].titulo}</h2>
                  <p className="text-sm text-texto-secundario">{RELATORIOS[codigo].descricao}</p>
                </div>
                {/* Link comum: o arquivo é gerado e autorizado no servidor a cada clique. */}
                <a href={`/paineis/relatorios/${codigo}${parametros}`} className={classeBotaoPrimario} download>
                  Exportar XLSX
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
