import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
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
      <FormularioPessoa />
    </div>
  );
}
