import type { Metadata } from "next";
import { podeEditarAlgum } from "@/modulos/acesso/capacidades";
import { SomenteConsulta } from "@/modulos/acesso/componentes/somente-consulta";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { FormularioInstituicao } from "@/modulos/stakeholders/componentes/formulario-instituicao";
import { opcoesInstituicoes } from "@/modulos/stakeholders/consultas";
import { opcoesPaises } from "@/modulos/stakeholders/paises";

export const metadata: Metadata = { title: "Nova instituição" };

export default function PaginaNovaInstituicao() {
  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        titulo="Nova instituição"
        voltar={{ href: "/instituicoes", rotulo: "Instituições" }}
      />
      <Suspense fallback={<Carregando />}>
        <Formulario />
      </Suspense>
    </div>
  );
}

async function Formulario() {
  const banco = await bancoDaRequisicao();
  if (!(await podeEditarAlgum(banco))) return <SomenteConsulta voltar={{ href: "/instituicoes", rotulo: "Instituições" }} />;
  return (
    <FormularioInstituicao
      opcoesSuperior={await opcoesInstituicoes(banco)}
      opcoesPaises={opcoesPaises()}
    />
  );
}
