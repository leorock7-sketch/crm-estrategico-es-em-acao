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
import { opcoesIniciativas, opcoesProjetosTemas } from "@/modulos/iniciativas/consultas";
import { FormularioRisco } from "@/modulos/riscos/componentes/formularios-risco";
import { opcoesEixos } from "@/modulos/riscos/consultas";

export const metadata: Metadata = { title: "Novo risco" };

export default function PaginaNovoRisco({ searchParams }: PageProps<"/riscos/novo">) {
  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        titulo="Novo risco"
        voltar={{ href: "/riscos", rotulo: "Matriz de Riscos" }}
        descricao="Todo risco nasce com a avaliação do risco inerente. A avaliação residual é registrada depois, na ficha do risco."
      />
      <Suspense fallback={<Carregando />}>
        <CadastroRisco searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CadastroRisco({ searchParams }: Pick<PageProps<"/riscos/novo">, "searchParams">) {
  const parametros = await searchParams;
  const banco = await bancoDaRequisicao();
  if (!(await podeEditarAlgum(banco))) return <SomenteConsulta voltar={{ href: "/riscos", rotulo: "Riscos" }} />;
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const [projetos, eixos, iniciativas, usuarios] = await Promise.all([
    opcoesProjetosTemas(banco, visiveis),
    opcoesEixos(banco, visiveis),
    opcoesIniciativas(banco, visiveis),
    opcoesUsuarios(banco),
  ]);
  const projetoInicial = identificadorDoParametro(parametros, "projeto");
  const iniciativaInicial = identificadorDoParametro(parametros, "iniciativa");
  return (
    <FormularioRisco
      inicial={{
        situacao: "aberto",
        dataAvaliacao: hojeEmBrasilia(),
        projetoTemaId: projetos.some((p) => p.id === projetoInicial) ? projetoInicial : undefined,
        iniciativaId: iniciativas.some((i) => i.id === iniciativaInicial) ? iniciativaInicial : undefined,
      }}
      projetos={projetos}
      eixos={eixos}
      iniciativas={iniciativas}
      usuarios={usuarios}
    />
  );
}
