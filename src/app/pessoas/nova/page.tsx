import type { Metadata } from "next";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { ehAdministrador, podeEditarAlgum } from "@/modulos/acesso/capacidades";
import { SomenteConsulta } from "@/modulos/acesso/componentes/somente-consulta";
import { FormularioPessoa } from "@/modulos/stakeholders/componentes/formulario-pessoa";

export const metadata: Metadata = { title: "Nova pessoa" };

export default function PaginaNovaPessoa() {
  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        titulo="Nova pessoa"
        voltar={{ href: "/pessoas", rotulo: "Pessoas" }}
        descricao="Os vínculos com instituições são registrados depois, na página da pessoa."
      />
      <Suspense fallback={<Carregando />}>
        <NovaPessoa />
      </Suspense>
    </div>
  );
}

/** Pessoa nova ainda não está associada a nenhum contexto: observações, só pelo administrador. */
async function NovaPessoa() {
  const banco = await bancoDaRequisicao();
  if (!(await podeEditarAlgum(banco))) return <SomenteConsulta voltar={{ href: "/pessoas", rotulo: "Pessoas" }} />;
  return <FormularioPessoa mostrarObservacoes={await ehAdministrador(banco)} />;
}
