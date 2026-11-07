import type { Metadata } from "next";
import { podeEditarAlgum } from "@/modulos/acesso/capacidades";
import { SomenteConsulta } from "@/modulos/acesso/componentes/somente-consulta";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { identificadorDoParametro } from "@/lib/parametros";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { FormularioIniciativa } from "@/modulos/iniciativas/componentes/formulario-iniciativa";
import { opcoesProjetosTemas } from "@/modulos/iniciativas/consultas";

export const metadata: Metadata = { title: "Nova iniciativa" };

export default function PaginaNovaIniciativa({ searchParams }: PageProps<"/iniciativas/nova">) {
  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina titulo="Nova iniciativa" voltar={{ href: "/iniciativas", rotulo: "Iniciativas" }} />
      <Suspense fallback={<Carregando />}>
        <CadastroIniciativa searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CadastroIniciativa({ searchParams }: Pick<PageProps<"/iniciativas/nova">, "searchParams">) {
  const parametros = await searchParams;
  const banco = await bancoDaRequisicao();
  if (!(await podeEditarAlgum(banco))) return <SomenteConsulta voltar={{ href: "/iniciativas", rotulo: "Iniciativas" }} />;
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const [projetos, usuarios] = await Promise.all([opcoesProjetosTemas(banco, visiveis), opcoesUsuarios(banco)]);
  // Vindo da página de um projeto ou tema, ele já aparece marcado.
  const projetoInicial = identificadorDoParametro(parametros, "projeto");

  return (
    <FormularioIniciativa
      inicial={{
        situacao: "registrada",
        dataAbertura: hojeEmBrasilia(),
        projetos: projetos.some((p) => p.id === projetoInicial) ? projetoInicial : undefined,
      }}
      projetos={projetos}
      usuarios={usuarios}
    />
  );
}
