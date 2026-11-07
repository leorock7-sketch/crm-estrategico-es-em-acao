import type { Metadata } from "next";
import { podeEditarRegistro } from "@/modulos/acesso/capacidades";
import { SomenteConsulta } from "@/modulos/acesso/componentes/somente-consulta";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { FormularioPlano } from "@/modulos/plano-acao/componentes/formularios-plano";
import { obterPlano, planoEhVisivel } from "@/modulos/plano-acao/consultas";

export const metadata: Metadata = { title: "Editar plano de ação" };

export default function PaginaEditarPlano({ params }: PageProps<"/planos/[id]/editar">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Carregando />}>
        <EdicaoPlano params={params} />
      </Suspense>
    </div>
  );
}

async function EdicaoPlano({ params }: Pick<PageProps<"/planos/[id]/editar">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const plano = await obterPlano(banco, id);
  if (!plano || plano.arquivadoEm || !(await planoEhVisivel(banco, id, await projetosVisiveis(banco, usuario.id)))) notFound();
  if (!(await podeEditarRegistro(banco, "plano", id))) return <SomenteConsulta voltar={{ href: `/planos/${id}`, rotulo: "Plano de ação" }} />;
  const usuarios = await opcoesUsuarios(banco);
  return (
    <>
      <CabecalhoPagina
        titulo="Editar dados do plano"
        voltar={{ href: `/planos/${id}`, rotulo: plano.titulo }}
        descricao="Título, objetivo geral e responsável. As ações e os marcos mudam por nova versão."
      />
      <FormularioPlano inicial={{ id, titulo: plano.titulo, objetivo: plano.objetivo, responsavelId: plano.responsavelId }} projetos={[]} usuarios={usuarios} />
    </>
  );
}
