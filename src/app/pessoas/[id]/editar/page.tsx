import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { podeVerDadosRestritos } from "@/modulos/acesso/capacidades";
import { FormularioPessoa } from "@/modulos/stakeholders/componentes/formulario-pessoa";
import { obterPessoa } from "@/modulos/stakeholders/consultas";

export const metadata: Metadata = { title: "Editar pessoa" };

export default function PaginaEditarPessoa({ params }: PageProps<"/pessoas/[id]/editar">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Carregando />}>
        <EdicaoPessoa params={params} />
      </Suspense>
    </div>
  );
}

async function EdicaoPessoa({ params }: Pick<PageProps<"/pessoas/[id]/editar">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const pessoa = await obterPessoa(banco, id);
  if (!pessoa || pessoa.arquivadoEm) notFound();
  const mostrarObservacoes = await podeVerDadosRestritos(banco, id);

  return (
    <>
      <CabecalhoPagina
        titulo="Editar pessoa"
        voltar={{ href: `/pessoas/${id}`, rotulo: pessoa.nomeCompleto }}
      />
      <FormularioPessoa
        mostrarObservacoes={mostrarObservacoes}
        inicial={{
          id: pessoa.id,
          nomeCompleto: pessoa.nomeCompleto,
          nomeTratamento: pessoa.nomeTratamento,
          observacoes: pessoa.observacoes,
        }}
      />
    </>
  );
}
