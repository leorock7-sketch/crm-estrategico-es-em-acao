import type { Metadata } from "next";
import { podeEditarAlgum } from "@/modulos/acesso/capacidades";
import { SomenteConsulta } from "@/modulos/acesso/componentes/somente-consulta";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { identificadorDoParametro } from "@/lib/parametros";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { opcoesIniciativas, opcoesProjetosTemas } from "@/modulos/iniciativas/consultas";
import { FormularioInteracao } from "@/modulos/interacoes/componentes/formulario-interacao";
import { opcoesStakeholders } from "@/modulos/projetos-temas/consultas";

export const metadata: Metadata = { title: "Registrar interação" };

export default function PaginaNovaInteracao({ searchParams }: PageProps<"/interacoes/nova">) {
  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        titulo="Registrar interação"
        descricao="Registre cada reunião ou contato uma única vez e marque todas as iniciativas para as quais contribuiu."
        voltar={{ href: "/interacoes", rotulo: "Interações" }}
      />
      <Suspense fallback={<Carregando />}>
        <CadastroInteracao searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CadastroInteracao({ searchParams }: Pick<PageProps<"/interacoes/nova">, "searchParams">) {
  const parametros = await searchParams;
  const banco = await bancoDaRequisicao();
  if (!(await podeEditarAlgum(banco))) return <SomenteConsulta voltar={{ href: "/interacoes", rotulo: "Interações" }} />;
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const [projetos, iniciativas, stakeholders, usuarios] = await Promise.all([
    opcoesProjetosTemas(banco, visiveis),
    opcoesIniciativas(banco, visiveis),
    opcoesStakeholders(banco),
    opcoesUsuarios(banco),
  ]);
  // Vindo de uma iniciativa, projeto ou stakeholder, ele já aparece marcado.
  const iniciativa = identificadorDoParametro(parametros, "iniciativa");
  const projeto = identificadorDoParametro(parametros, "projeto");
  const stakeholder = identificadorDoParametro(parametros, "stakeholder");
  const externos = [...stakeholders.pessoas, ...stakeholders.instituicoes];

  return (
    <FormularioInteracao
      inicial={{
        situacao: "realizada",
        iniciativas: iniciativas.some((i) => i.id === iniciativa) ? iniciativa : undefined,
        projetos: projetos.some((p) => p.id === projeto) ? projeto : undefined,
        participantesExternos: externos.some((s) => s.id === stakeholder) ? stakeholder : undefined,
      }}
      projetos={projetos}
      iniciativas={iniciativas}
      pessoas={stakeholders.pessoas}
      instituicoes={stakeholders.instituicoes}
      usuarios={usuarios}
    />
  );
}
