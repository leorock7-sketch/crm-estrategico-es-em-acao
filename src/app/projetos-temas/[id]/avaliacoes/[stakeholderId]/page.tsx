import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCartao, classeLink } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { permissaoNoContexto } from "@/modulos/acesso/permissoes";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { iniciarAvaliacao } from "@/modulos/avaliacoes/acoes";
import { metodologiasComparaveis, tendenciaDoPosicionamento } from "@/modulos/avaliacoes/calculo";
import { AvisoDaMetodologia, AvisoSeguranca } from "@/modulos/avaliacoes/componentes/avisos";
import { ResumoVersao } from "@/modulos/avaliacoes/componentes/resumo-versao";
import { ligacoesDasMetodologias, obterFicha } from "@/modulos/avaliacoes/consultas";
import { obterProjetoTema } from "@/modulos/projetos-temas/consultas";

export const metadata: Metadata = { title: "Ficha de avaliação" };

export default function PaginaFicha({ params }: PageProps<"/projetos-temas/[id]/avaliacoes/[stakeholderId]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Ficha params={params} />
    </Suspense>
  );
}

async function Ficha({ params }: Pick<PageProps<"/projetos-temas/[id]/avaliacoes/[stakeholderId]">, "params">) {
  const { id, stakeholderId } = await params;
  if (!esquemaIdentificador.safeParse(id).success || !esquemaIdentificador.safeParse(stakeholderId).success) notFound();

  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const projeto = await obterProjetoTema(banco, id);
  if (!projeto) notFound();
  const permissao = await permissaoNoContexto(banco, usuario.id, id);
  if (!permissao.ver) {
    return <Alerta tom="erro">Você não tem permissão para ver as avaliações deste projeto ou tema.</Alerta>;
  }
  const [ficha, ligacoes] = await Promise.all([obterFicha(banco, id, stakeholderId), ligacoesDasMetodologias(banco)]);
  if (!ficha) notFound();

  const hoje = hojeEmBrasilia();
  const publicadas = ficha.versoes.filter((v) => v.situacao !== "rascunho");
  const vigente = publicadas.find((v) => v.situacao === "vigente") ?? null;
  const anterior = vigente ? publicadas.find((v) => v.numeroVersao < vigente.numeroVersao) : undefined;
  const rascunho = ficha.versoes.find((v) => v.situacao === "rascunho" && !v.arquivadoEm);
  const caminho = `/projetos-temas/${id}/avaliacoes/${stakeholderId}`;
  const perfilStakeholder = `/${ficha.stakeholder.tipo === "pessoa" ? "pessoas" : "instituicoes"}/${stakeholderId}`;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={ficha.stakeholder.nome}
        voltar={{ href: `/projetos-temas/${id}`, rotulo: projeto.nome }}
        descricao={
          <>
            Ficha de avaliação em <span className="font-medium text-texto">{projeto.nome}</span> ·{" "}
            <Link href={perfilStakeholder} className={classeLink}>
              Cadastro
            </Link>{" "}
            ·{" "}
            <Link href={`/projetos-temas/${id}/matriz`} className={classeLink}>
              Matriz do contexto
            </Link>
          </>
        }
        acoes={
          permissao.editar &&
          (rascunho ? (
            <Link href={`${caminho}/rascunho`} className={classeBotaoPrimario}>
              Continuar rascunho
            </Link>
          ) : (
            ficha.associado && (
              <form action={iniciarAvaliacao.bind(null, id, stakeholderId)}>
                <button type="submit" className={classeBotaoPrimario}>
                  {vigente ? "Nova versão da avaliação" : "Iniciar avaliação"}
                </button>
              </form>
            )
          ))
        }
      />

      <AvisoDaMetodologia
        metodologia={
          vigente?.metodologiaId
            ? { id: vigente.metodologiaId, nome: vigente.metodologiaNome ?? "", homologada: Boolean(vigente.metodologiaHomologada) }
            : null
        }
      />

      {!ficha.associado && (
        <Alerta tom="aviso" titulo="Sem associação vigente a este projeto ou tema">
          Para registrar nova avaliação, associe a pessoa ou instituição na página do projeto ou tema. As versões já
          publicadas continuam preservadas abaixo.
        </Alerta>
      )}

      <section aria-labelledby="titulo-vigente" className={classeCartao}>
        <h2 id="titulo-vigente" className="mb-4 text-lg font-semibold">
          Avaliação vigente
        </h2>
        {vigente ? (
          <ResumoVersao
            versao={vigente}
            hoje={hoje}
            tendencia={tendenciaDoPosicionamento(
              vigente.posicionamento,
              anterior?.posicionamento ?? null,
              anterior ? metodologiasComparaveis(vigente.metodologiaId, anterior.metodologiaId, ligacoes) : true,
            )}
          />
        ) : (
          <p className="text-sm text-texto-secundario">
            Não avaliado: ainda não há versão publicada neste projeto ou tema.
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-historico" className={classeCartao}>
        <h2 id="titulo-historico" className="mb-1 text-lg font-semibold">
          Histórico de versões
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Todas as versões ficam preservadas, inclusive as feitas com metodologias e escalas anteriores. Avaliações de
          metodologias diferentes só são comparadas com equivalência declarada.
        </p>
        {ficha.versoes.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhuma versão registrada.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {ficha.versoes.map((v) => (
              <li key={v.id}>
                <details className="rounded-lg border border-borda p-4" open={v.situacao === "rascunho" && !v.arquivadoEm}>
                  <summary className="cursor-pointer text-sm font-medium">
                    Versão {v.numeroVersao} ·{" "}
                    {v.arquivadoEm
                      ? "rascunho descartado"
                      : v.situacao === "vigente"
                        ? "vigente"
                        : v.situacao === "substituida"
                          ? "substituída"
                          : "rascunho em andamento"}
                    {v.metodologiaNome && ` · ${v.metodologiaNome}`}
                  </summary>
                  <div className="mt-4">
                    <ResumoVersao versao={v} hoje={hoje} />
                  </div>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>

      <AvisoSeguranca />
    </div>
  );
}
