import type { Metadata } from "next";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { identificadorDoParametro } from "@/lib/parametros";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { opcoesProjetosTemas } from "@/modulos/iniciativas/consultas";
import { FormularioPlano } from "@/modulos/plano-acao/componentes/formularios-plano";
import { listarPlanos } from "@/modulos/plano-acao/consultas";

export const metadata: Metadata = { title: "Novo plano de ação" };

export default function PaginaNovoPlano({ searchParams }: PageProps<"/planos/novo">) {
  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        titulo="Novo plano de ação"
        voltar={{ href: "/planos", rotulo: "Planos de ação" }}
        descricao="O plano nasce com a versão 1 em rascunho; as ações e os marcos são incluídos nela e enviados para aprovação."
      />
      <Suspense fallback={<Carregando />}>
        <CadastroPlano searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CadastroPlano({ searchParams }: Pick<PageProps<"/planos/novo">, "searchParams">) {
  const parametros = await searchParams;
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const [projetos, planos, usuarios] = await Promise.all([
    opcoesProjetosTemas(banco, visiveis),
    listarPlanos(banco, hojeEmBrasilia(), visiveis),
    opcoesUsuarios(banco),
  ]);
  const comPlano = new Set(planos.map((p) => p.projetoTemaId));
  const disponiveis = projetos.filter((p) => !comPlano.has(p.id));
  const projetoInicial = identificadorDoParametro(parametros, "projeto");
  return (
    <FormularioPlano
      inicial={{ projetoTemaId: disponiveis.some((p) => p.id === projetoInicial) ? projetoInicial : undefined }}
      projetos={disponiveis}
      usuarios={usuarios}
    />
  );
}
