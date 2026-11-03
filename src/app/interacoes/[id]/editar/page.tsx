import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { FormularioInteracao } from "@/modulos/interacoes/componentes/formulario-interacao";
import { interacaoEhVisivel, obterInteracao } from "@/modulos/interacoes/consultas";
import { valorDataHoraBrasilia } from "@/modulos/interacoes/datas";

export const metadata: Metadata = { title: "Editar interação" };

export default function PaginaEditarInteracao({ params }: PageProps<"/interacoes/[id]/editar">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Carregando />}>
        <EdicaoInteracao params={params} />
      </Suspense>
    </div>
  );
}

async function EdicaoInteracao({ params }: Pick<PageProps<"/interacoes/[id]/editar">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const interacao = await obterInteracao(banco, id);
  if (!interacao || interacao.arquivadoEm) notFound();
  if (!(await interacaoEhVisivel(banco, id, await projetosVisiveis(banco, usuario.id)))) notFound();

  return (
    <>
      <CabecalhoPagina titulo="Editar interação" voltar={{ href: `/interacoes/${id}`, rotulo: interacao.assunto }} />
      <FormularioInteracao
        inicial={{
          id,
          tipo: interacao.tipo,
          assunto: interacao.assunto,
          inicio: valorDataHoraBrasilia(interacao.inicio),
          fim: interacao.fim ? valorDataHoraBrasilia(interacao.fim) : "",
          local: interacao.local,
          resumo: interacao.resumo,
          situacao: interacao.situacao,
        }}
        projetos={[]}
        iniciativas={[]}
        pessoas={[]}
        instituicoes={[]}
        usuarios={[]}
      />
    </>
  );
}
