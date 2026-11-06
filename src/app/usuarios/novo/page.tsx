import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeCartao } from "@/componentes/estilos";
import { modoDeAcesso } from "@/lib/banco/ambiente";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { ehAdministrador } from "@/modulos/acesso/capacidades";
import { FormularioNovoUsuario } from "@/modulos/acesso/componentes/formularios-usuarios";

export const metadata: Metadata = { title: "Novo usuário" };

export default function PaginaNovoUsuario() {
  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina
        titulo="Novo usuário"
        voltar={{ href: "/usuarios", rotulo: "Usuários e permissões" }}
        descricao="Cadastre a pessoa e, em seguida, conceda as permissões por projeto ou tema."
      />
      <Suspense fallback={<Carregando />}>
        <NovoUsuario />
      </Suspense>
    </div>
  );
}

async function NovoUsuario() {
  const banco = await bancoDaRequisicao();
  if (!(await ehAdministrador(banco))) notFound();
  return (
    <div className={classeCartao}>
      <FormularioNovoUsuario modoLocal={modoDeAcesso() === "local"} />
    </div>
  );
}
