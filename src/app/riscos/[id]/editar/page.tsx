import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { opcoesIniciativas } from "@/modulos/iniciativas/consultas";
import { FormularioRisco } from "@/modulos/riscos/componentes/formularios-risco";
import { obterRisco, opcoesEixos, riscoEhVisivel } from "@/modulos/riscos/consultas";

export const metadata: Metadata = { title: "Editar risco" };

export default function PaginaEditarRisco({ params }: PageProps<"/riscos/[id]/editar">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Carregando />}>
        <EdicaoRisco params={params} />
      </Suspense>
    </div>
  );
}

async function EdicaoRisco({ params }: Pick<PageProps<"/riscos/[id]/editar">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const risco = await obterRisco(banco, id);
  if (!risco || risco.arquivadoEm || !(await riscoEhVisivel(banco, id, visiveis))) notFound();
  const [eixos, iniciativas, usuarios] = await Promise.all([opcoesEixos(banco, visiveis), opcoesIniciativas(banco, visiveis), opcoesUsuarios(banco)]);

  return (
    <>
      <CabecalhoPagina
        titulo="Editar risco"
        voltar={{ href: `/riscos/${id}`, rotulo: `${risco.codigo} – ${risco.titulo}` }}
        descricao="A probabilidade e o impacto não mudam aqui: registre uma nova avaliação, fundamentada, na ficha do risco."
      />
      <FormularioRisco
        inicial={{
          id,
          projetoTemaId: risco.projetoTemaId,
          titulo: risco.titulo,
          descricao: risco.descricao,
          causa: risco.causa,
          consequencia: risco.consequencia,
          controlesExistentes: risco.controlesExistentes,
          eixoId: risco.eixoId,
          iniciativaId: risco.iniciativaId,
          responsavelId: risco.responsavelId,
          situacao: risco.situacao,
          proximaRevisao: risco.proximaRevisao,
        }}
        projetos={[]}
        eixos={eixos}
        iniciativas={iniciativas}
        usuarios={usuarios}
      />
    </>
  );
}
