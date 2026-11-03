import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { FormularioIniciativa } from "@/modulos/iniciativas/componentes/formulario-iniciativa";
import { iniciativaEhVisivel, obterIniciativa } from "@/modulos/iniciativas/consultas";

export const metadata: Metadata = { title: "Editar iniciativa" };

export default function PaginaEditarIniciativa({ params }: PageProps<"/iniciativas/[id]/editar">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Carregando />}>
        <EdicaoIniciativa params={params} />
      </Suspense>
    </div>
  );
}

async function EdicaoIniciativa({ params }: Pick<PageProps<"/iniciativas/[id]/editar">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const iniciativa = await obterIniciativa(banco, id);
  if (!iniciativa || iniciativa.arquivadoEm) notFound();
  if (!(await iniciativaEhVisivel(banco, id, await projetosVisiveis(banco, usuario.id)))) notFound();
  const usuarios = await opcoesUsuarios(banco);

  return (
    <>
      <CabecalhoPagina titulo="Editar iniciativa" voltar={{ href: `/iniciativas/${id}`, rotulo: iniciativa.titulo }} />
      <FormularioIniciativa
        inicial={{
          id,
          tipo: iniciativa.tipo,
          titulo: iniciativa.titulo,
          descricao: iniciativa.descricao,
          origem: iniciativa.origem,
          situacao: iniciativa.situacao,
          prioridade: iniciativa.prioridade,
          responsavelId: iniciativa.responsavelId,
          dataAbertura: iniciativa.dataAbertura,
          dataPrevistaConclusao: iniciativa.dataPrevistaConclusao,
          dataConclusao: iniciativa.dataConclusao,
        }}
        projetos={[]}
        usuarios={usuarios}
      />
    </>
  );
}
