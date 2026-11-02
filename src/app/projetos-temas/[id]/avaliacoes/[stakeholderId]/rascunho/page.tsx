import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoSecundario, classeCartao } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { permissaoNoContexto } from "@/modulos/acesso/permissoes";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { descartarRascunhoAcao } from "@/modulos/avaliacoes/acoes";
import { AvisoNaoHomologado, AvisoSeguranca } from "@/modulos/avaliacoes/componentes/avisos";
import { FormularioEvidencia } from "@/modulos/avaliacoes/componentes/formulario-evidencia";
import { FormularioRascunho } from "@/modulos/avaliacoes/componentes/formulario-rascunho";
import { ListaEvidencias } from "@/modulos/avaliacoes/componentes/lista-evidencias";
import { criteriosDaMetodologia, obterFicha } from "@/modulos/avaliacoes/consultas";
import { obterProjetoTema } from "@/modulos/projetos-temas/consultas";

export const metadata: Metadata = { title: "Rascunho de avaliação" };

type Props = PageProps<"/projetos-temas/[id]/avaliacoes/[stakeholderId]/rascunho">;

export default function PaginaRascunho({ params }: Props) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<Carregando />}>
        <Rascunho params={params} />
      </Suspense>
    </div>
  );
}

async function Rascunho({ params }: Pick<Props, "params">) {
  const { id, stakeholderId } = await params;
  if (!esquemaIdentificador.safeParse(id).success || !esquemaIdentificador.safeParse(stakeholderId).success) notFound();

  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const projeto = await obterProjetoTema(banco, id);
  if (!projeto) notFound();
  const permissao = await permissaoNoContexto(banco, usuario.id, id);
  if (!permissao.editar) {
    return <Alerta tom="erro">Você não tem permissão para alterar as avaliações deste projeto ou tema.</Alerta>;
  }
  const ficha = await obterFicha(banco, id, stakeholderId);
  if (!ficha) notFound();
  const caminhoFicha = `/projetos-temas/${id}/avaliacoes/${stakeholderId}`;
  const rascunho = ficha.versoes.find((v) => v.situacao === "rascunho" && !v.arquivadoEm);
  if (!rascunho) redirect(caminhoFicha);

  const criterios = rascunho.metodologiaId ? await criteriosDaMetodologia(banco, rascunho.metodologiaId) : [];

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={`Rascunho da versão ${rascunho.numeroVersao}`}
        voltar={{ href: caminhoFicha, rotulo: ficha.stakeholder.nome }}
        descricao={`${ficha.stakeholder.nome} · ${projeto.nome}`}
        acoes={
          <form action={descartarRascunhoAcao.bind(null, rascunho.id)}>
            <button type="submit" className={classeBotaoSecundario}>
              Descartar rascunho
            </button>
          </form>
        }
      />

      <AvisoNaoHomologado
        metodologia={rascunho.metodologiaId ? { id: rascunho.metodologiaId, nome: rascunho.metodologiaNome ?? "" } : null}
      />
      {!rascunho.metodologiaId && (
        <Alerta tom="aviso">
          Não há metodologia vigente: esta versão terá posicionamento, confiança, justificativa e evidências, mas não
          terá pontuação de poder e interesse.
        </Alerta>
      )}

      <section aria-labelledby="titulo-evidencias" className={classeCartao}>
        <h2 id="titulo-evidencias" className="mb-1 text-lg font-semibold">
          Evidências
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Pelo menos uma evidência é obrigatória para publicar. Use somente informações fictícias nesta etapa.
        </p>
        <ListaEvidencias evidencias={rascunho.evidencias} editavel />
        <details className="mt-4 rounded-lg border border-borda p-4" open={rascunho.evidencias.length === 0}>
          <summary className="cursor-pointer font-medium">Registrar evidência</summary>
          <div className="mt-4">
            <FormularioEvidencia versaoId={rascunho.id} />
          </div>
        </details>
      </section>

      <FormularioRascunho
        versaoId={rascunho.id}
        instituicao={ficha.stakeholder.tipo === "instituicao"}
        criterios={criterios}
        inicial={{
          posicionamento: rascunho.posicionamento,
          grauConfianca: rascunho.grauConfianca,
          justificativaConfianca: rascunho.justificativaConfianca,
          justificativa: rascunho.justificativa,
          validacaoInstitucional: rascunho.validacaoInstitucional,
          dataReferencia: rascunho.dataReferencia,
          notas: Object.fromEntries(rascunho.notas.map((n) => [n.criterioId, n.nota])),
        }}
      />

      <AvisoSeguranca />
    </div>
  );
}
