import type { Metadata } from "next";
import { podeEditarAlgum } from "@/modulos/acesso/capacidades";
import { SomenteConsulta } from "@/modulos/acesso/componentes/somente-consulta";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarCnpj } from "@/lib/validacao/cnpj";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { FormularioInstituicao } from "@/modulos/stakeholders/componentes/formulario-instituicao";
import { obterInstituicao, opcoesInstituicoes } from "@/modulos/stakeholders/consultas";
import { opcoesPaises } from "@/modulos/stakeholders/paises";

export const metadata: Metadata = { title: "Editar instituição" };

export default function PaginaEditarInstituicao({
  params,
}: PageProps<"/instituicoes/[id]/editar">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Carregando />}>
        <EdicaoInstituicao params={params} />
      </Suspense>
    </div>
  );
}

async function EdicaoInstituicao({
  params,
}: Pick<PageProps<"/instituicoes/[id]/editar">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const [instituicao, opcoes] = await Promise.all([
    obterInstituicao(banco, id),
    opcoesInstituicoes(banco),
  ]);
  if (!instituicao || instituicao.arquivadoEm) notFound();
  if (!(await podeEditarAlgum(banco))) return <SomenteConsulta voltar={{ href: `/instituicoes/${id}`, rotulo: "Instituição" }} />;

  return (
    <>
      <CabecalhoPagina
        titulo="Editar instituição"
        voltar={{ href: `/instituicoes/${id}`, rotulo: instituicao.nome }}
      />
      <FormularioInstituicao
        opcoesSuperior={opcoes}
        opcoesPaises={opcoesPaises()}
        inicial={{
          id: instituicao.id,
          nome: instituicao.nome,
          sigla: instituicao.sigla,
          natureza: instituicao.natureza,
          esfera: instituicao.esfera,
          pais: instituicao.pais,
          cnpj: instituicao.cnpj && formatarCnpj(instituicao.cnpj),
          uf: instituicao.uf,
          municipio: instituicao.municipio,
          site: instituicao.site,
          instituicaoSuperiorId: instituicao.instituicaoSuperiorId,
        }}
      />
    </>
  );
}
