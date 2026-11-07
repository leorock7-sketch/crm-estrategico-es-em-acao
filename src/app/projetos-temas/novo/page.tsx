import type { Metadata } from "next";
import { ehAdministrador } from "@/modulos/acesso/capacidades";
import { SomenteConsulta } from "@/modulos/acesso/componentes/somente-consulta";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { FormularioProjetoTema } from "@/modulos/projetos-temas/componentes/formulario-projeto-tema";
import { opcoesComites } from "@/modulos/projetos-temas/consultas";

export const metadata: Metadata = { title: "Novo projeto ou tema" };

export default function PaginaNovoProjetoTema({ searchParams }: PageProps<"/projetos-temas/novo">) {
  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        titulo="Novo projeto ou tema"
        voltar={{ href: "/projetos-temas", rotulo: "Projetos e temas" }}
        descricao="Comitês participantes e stakeholders são registrados depois, na página do projeto ou tema."
      />
      <Suspense fallback={<Carregando />}>
        <CadastroProjetoTema searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CadastroProjetoTema({
  searchParams,
}: Pick<PageProps<"/projetos-temas/novo">, "searchParams">) {
  const parametros = await searchParams;
  // A página do comitê pode abrir o cadastro com o comitê principal já escolhido.
  const comiteId = esquemaIdentificador.safeParse(parametros.comite).data;
  const banco = await bancoDaRequisicao();
  if (!(await ehAdministrador(banco))) return <SomenteConsulta voltar={{ href: "/projetos-temas", rotulo: "Projetos e temas" }} />;
  const comites = await opcoesComites(banco);

  return <FormularioProjetoTema inicial={{ comiteId }} opcoesComites={comites} />;
}
