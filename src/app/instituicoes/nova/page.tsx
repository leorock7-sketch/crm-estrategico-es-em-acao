import type { Metadata } from "next";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { FormularioInstituicao } from "@/modulos/stakeholders/componentes/formulario-instituicao";
import { opcoesInstituicoes } from "@/modulos/stakeholders/consultas";

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
  return <FormularioInstituicao opcoesSuperior={await opcoesInstituicoes(banco)} />;
}
