import type { Metadata } from "next";
import { podeEditarNoProjeto } from "@/modulos/acesso/capacidades";
import { SomenteConsulta } from "@/modulos/acesso/componentes/somente-consulta";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { FormularioProjetoTema } from "@/modulos/projetos-temas/componentes/formulario-projeto-tema";
import { obterProjetoTema, opcoesComites } from "@/modulos/projetos-temas/consultas";

export const metadata: Metadata = { title: "Editar projeto ou tema" };

export default function PaginaEditarProjetoTema({ params }: PageProps<"/projetos-temas/[id]/editar">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Carregando />}>
        <EdicaoProjetoTema params={params} />
      </Suspense>
    </div>
  );
}

async function EdicaoProjetoTema({ params }: Pick<PageProps<"/projetos-temas/[id]/editar">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const [projeto, comites] = await Promise.all([obterProjetoTema(banco, id), opcoesComites(banco)]);
  if (!projeto || projeto.arquivadoEm) notFound();
  if (!(await podeEditarNoProjeto(banco, id))) return <SomenteConsulta voltar={{ href: `/projetos-temas/${id}`, rotulo: "Projeto ou tema" }} />;

  return (
    <>
      <CabecalhoPagina
        titulo="Editar projeto ou tema"
        voltar={{ href: `/projetos-temas/${id}`, rotulo: projeto.nome }}
      />
      <FormularioProjetoTema
        inicial={{
          id: projeto.id,
          tipo: projeto.tipo,
          nome: projeto.nome,
          descricao: projeto.descricao,
          comiteId: projeto.comiteId,
          situacao: projeto.situacao,
          dataInicio: projeto.dataInicio,
          dataFim: projeto.dataFim,
        }}
        opcoesComites={comites}
      />
    </>
  );
}
