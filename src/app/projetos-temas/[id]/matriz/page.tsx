import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeCartao, classeCelula, classeCelulaCabecalho, classeLink, classeTabela } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData, formatarNumero, hojeEmBrasilia } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { permissaoNoContexto } from "@/modulos/acesso/permissoes";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { AvisoNaoHomologado, AvisoSeguranca } from "@/modulos/avaliacoes/componentes/avisos";
import { MatrizPoderInteresse } from "@/modulos/avaliacoes/componentes/matriz-poder-interesse";
import { SeloPosicionamento } from "@/modulos/avaliacoes/componentes/selo-posicionamento";
import { fichasDoContexto, metodologiaVigente } from "@/modulos/avaliacoes/consultas";
import { classificarParaMatriz, type FichaParaMatriz } from "@/modulos/avaliacoes/matriz";
import { obterProjetoTema } from "@/modulos/projetos-temas/consultas";

export const metadata: Metadata = { title: "Matriz de poder × interesse" };

export default function PaginaMatriz({ params }: PageProps<"/projetos-temas/[id]/matriz">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Matriz params={params} />
    </Suspense>
  );
}

async function Matriz({ params }: Pick<PageProps<"/projetos-temas/[id]/matriz">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const projeto = await obterProjetoTema(banco, id);
  if (!projeto) notFound();
  const permissao = await permissaoNoContexto(banco, usuario.id, id);
  if (!permissao.ver) {
    return <Alerta tom="erro">Você não tem permissão para ver as avaliações deste projeto ou tema.</Alerta>;
  }

  const [fichas, vigente] = await Promise.all([fichasDoContexto(banco, id), metodologiaVigente(banco)]);
  const matriz = classificarParaMatriz(fichas, vigente?.id ?? null, hojeEmBrasilia());
  const associados = fichas.filter((f) => f.associado).length;
  const caminhoFicha = (stakeholderId: string) => `/projetos-temas/${id}/avaliacoes/${stakeholderId}`;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Matriz de poder × interesse"
        voltar={{ href: `/projetos-temas/${id}`, rotulo: projeto.nome }}
        descricao={`Somente as avaliações deste ${projeto.tipo === "tema" ? "tema" : "projeto"}, na versão vigente de cada ficha.`}
      />

      {(!vigente || !vigente.homologada) && <AvisoNaoHomologado metodologia={vigente} />}

      <section aria-labelledby="titulo-grafico" className={classeCartao}>
        <h2 id="titulo-grafico" className="mb-1 text-lg font-semibold">
          {vigente ? `Metodologia vigente: ${vigente.nome}` : "Sem metodologia vigente"}
        </h2>
        <p className="mb-4 text-sm text-texto-secundario" role="status">
          {matriz.noGrafico.length} de {associados} stakeholders associados estão no gráfico (avaliação publicada na
          metodologia vigente, com poder e interesse).
        </p>
        {matriz.noGrafico.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda p-8 text-center text-texto-secundario">
            Nenhuma avaliação da metodologia vigente com poder e interesse.
          </p>
        ) : (
          <MatrizPoderInteresse pontos={matriz.noGrafico} caminhoFicha={caminhoFicha} />
        )}
      </section>

      <section aria-labelledby="titulo-reavaliacao" className={classeCartao}>
        <h2 id="titulo-reavaliacao" className="mb-1 text-lg font-semibold">
          Exigem reavaliação ({matriz.exigemReavaliacao.length})
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Avaliações feitas com metodologia anterior ou com a revisão anual vencida.
        </p>
        {matriz.exigemReavaliacao.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhuma.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {matriz.exigemReavaliacao.map(({ ficha, motivo }) => (
              <li key={`${ficha.stakeholderId}-${motivo}`} className="flex flex-wrap justify-between gap-2 py-2">
                <Link href={caminhoFicha(ficha.stakeholderId)} className={classeLink}>
                  {ficha.nome}
                </Link>
                <span className="text-texto-secundario">
                  {motivo === "metodologia_anterior"
                    ? `Metodologia anterior (${ficha.vigente.metodologiaNome})`
                    : `Revisão anual vencida em ${formatarData(ficha.vigente.proximaRevisao)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-historicas" className={classeCartao}>
        <h2 id="titulo-historicas" className="mb-1 text-lg font-semibold">
          Avaliações históricas — metodologia anterior ({matriz.metodologiaAnterior.length})
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Preservadas e visíveis, mas fora do gráfico: suas pontuações seguem outra metodologia e não são comparadas
          automaticamente com as da metodologia vigente.
        </p>
        {matriz.metodologiaAnterior.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhuma.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda">
            <table className={classeTabela}>
              <thead>
                <tr>
                  <th scope="col" className={classeCelulaCabecalho}>Stakeholder</th>
                  <th scope="col" className={classeCelulaCabecalho}>Metodologia</th>
                  <th scope="col" className={`${classeCelulaCabecalho} text-right`}>Poder</th>
                  <th scope="col" className={`${classeCelulaCabecalho} text-right`}>Interesse</th>
                  <th scope="col" className={classeCelulaCabecalho}>Posicionamento</th>
                </tr>
              </thead>
              <tbody>
                {matriz.metodologiaAnterior.map((f) => (
                  <tr key={f.stakeholderId}>
                    <td className={classeCelula}>
                      <Link href={caminhoFicha(f.stakeholderId)} className={classeLink}>
                        {f.nome}
                      </Link>
                    </td>
                    <td className={classeCelula}>{f.vigente.metodologiaNome}</td>
                    <td className={`${classeCelula} text-right tabular-nums`}>{f.vigente.poder === null ? "—" : formatarNumero(f.vigente.poder)}</td>
                    <td className={`${classeCelula} text-right tabular-nums`}>{f.vigente.interesse === null ? "—" : formatarNumero(f.vigente.interesse)}</td>
                    <td className={classeCelula}>
                      <SeloPosicionamento posicionamento={f.vigente.posicionamento} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <ListaSimples
          titulo="Sem pontuação"
          descricao="Publicadas sem todas as notas de poder e interesse."
          fichas={matriz.semPontuacao}
          caminhoFicha={caminhoFicha}
        />
        <ListaSimples
          titulo="Não avaliados"
          descricao="Associados ao contexto, sem avaliação publicada."
          fichas={matriz.naoAvaliados}
          caminhoFicha={caminhoFicha}
        />
        <ListaSimples
          titulo="Associação encerrada"
          descricao="Avaliações publicadas de quem não está mais associado."
          fichas={matriz.associacaoEncerrada}
          caminhoFicha={caminhoFicha}
        />
      </div>

      <AvisoSeguranca />
    </div>
  );
}

function ListaSimples({
  titulo,
  descricao,
  fichas,
  caminhoFicha,
}: {
  titulo: string;
  descricao: string;
  fichas: FichaParaMatriz[];
  caminhoFicha: (stakeholderId: string) => string;
}) {
  return (
    <section className={classeCartao}>
      <h2 className="mb-1 text-base font-semibold">
        {titulo} ({fichas.length})
      </h2>
      <p className="mb-3 text-xs text-texto-secundario">{descricao}</p>
      {fichas.length === 0 ? (
        <p className="text-sm text-texto-secundario">Nenhum.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {fichas.map((f) => (
            <li key={f.stakeholderId}>
              <Link href={caminhoFicha(f.stakeholderId)} className={classeLink}>
                {f.nome}
              </Link>
              {f.temRascunho && <span className="text-xs text-texto-secundario"> · rascunho em andamento</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
