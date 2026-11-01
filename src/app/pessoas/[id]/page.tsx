import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCartao, classeLink } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { descreverPeriodo, formatarDataHora } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { ListaContextos } from "@/modulos/projetos-temas/componentes/lista-contextos";
import { contextosDoStakeholder } from "@/modulos/projetos-temas/consultas";
import { alterarArquivamentoPessoa, encerrarVinculoPessoa } from "@/modulos/stakeholders/acoes";
import { BotaoArquivamento } from "@/modulos/stakeholders/componentes/botao-arquivamento";
import { FormularioContato } from "@/modulos/stakeholders/componentes/formulario-contato";
import { FormularioEncerramento } from "@/componentes/formulario-encerramento";
import { FormularioVinculo } from "@/modulos/stakeholders/componentes/formulario-vinculo";
import { ListaContatos } from "@/modulos/stakeholders/componentes/lista-contatos";
import { ListaHistorico } from "@/modulos/stakeholders/componentes/lista-historico";
import {
  historicoDoStakeholder,
  idsCitadosNoHistorico,
  listarContatos,
  listarVinculosDaPessoa,
  nomesDosRegistros,
  obterPessoa,
  opcoesInstituicoes,
} from "@/modulos/stakeholders/consultas";

export const metadata: Metadata = { title: "Pessoa" };

export default function PaginaPessoa({ params }: PageProps<"/pessoas/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalhePessoa params={params} />
    </Suspense>
  );
}

async function DetalhePessoa({ params }: Pick<PageProps<"/pessoas/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();

  const banco = await bancoDaRequisicao();
  const pessoa = await obterPessoa(banco, id);
  if (!pessoa) notFound();

  const [vinculos, contatos, historico, instituicoes, contextos] = await Promise.all([
    listarVinculosDaPessoa(banco, id),
    listarContatos(banco, id),
    historicoDoStakeholder(banco, id),
    opcoesInstituicoes(banco),
    contextosDoStakeholder(banco, id),
  ]);
  const nomes = await nomesDosRegistros(banco, idsCitadosNoHistorico(historico));
  const arquivada = pessoa.arquivadoEm !== null;
  const vinculosVigentes = vinculos
    .filter((v) => v.dataFim === null)
    .map((v) => ({ id: v.id, rotulo: [v.cargo, v.instituicaoSigla ?? v.instituicaoNome].filter(Boolean).join(" · ") }));

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={pessoa.nomeCompleto}
        voltar={{ href: "/pessoas", rotulo: "Pessoas" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            {pessoa.nomeTratamento && <span>{pessoa.nomeTratamento}</span>}
            {arquivada && <SeloSituacao tom="neutro">Arquivada</SeloSituacao>}
          </span>
        }
        acoes={
          <>
            {!arquivada && (
              <Link href={`/pessoas/${id}/editar`} className={classeBotaoPrimario}>
                Editar
              </Link>
            )}
            <BotaoArquivamento
              acao={alterarArquivamentoPessoa.bind(null, id, !arquivada)}
              arquivado={arquivada}
            />
          </>
        }
      />

      {arquivada && (
        <Alerta tom="aviso" titulo="Pessoa arquivada">
          Arquivada em {formatarDataHora(pessoa.arquivadoEm)}. Para editar ou registrar
          vínculos e contatos, reative o cadastro.
        </Alerta>
      )}

      <section aria-labelledby="titulo-dados" className={classeCartao}>
        <h2 id="titulo-dados" className="mb-4 text-lg font-semibold">
          Dados
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ItemDado rotulo="Observações" valor={pessoa.observacoes} />
          </div>
          <ItemDado rotulo="Cadastrada em" valor={formatarDataHora(pessoa.criadoEm)} />
          <ItemDado rotulo="Última alteração" valor={formatarDataHora(pessoa.atualizadoEm)} />
        </dl>
      </section>

      <section aria-labelledby="titulo-contatos" className={classeCartao}>
        <h2 id="titulo-contatos" className="mb-1 text-lg font-semibold">
          Contatos
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          E-mails e telefones com histórico próprio. Um mesmo contato pode ser compartilhado
          ou passar ao sucessor no cargo.
        </p>
        <ListaContatos contatos={contatos} somenteLeitura={arquivada} />
        {!arquivada && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Registrar contato</summary>
            <div className="mt-4">
              <FormularioContato
                stakeholderId={id}
                naturezaPadrao="institucional"
                vinculos={vinculosVigentes}
              />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-vinculos" className={classeCartao}>
        <h2 id="titulo-vinculos" className="mb-4 text-lg font-semibold">
          Vínculos institucionais
        </h2>
        {vinculos.length === 0 ? (
          <p className="text-sm text-texto-secundario">Nenhum vínculo registrado.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda">
            {vinculos.map((v) => {
              const vigente = v.dataFim === null;
              return (
                <li key={v.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/instituicoes/${v.instituicaoId}`} className={classeLink}>
                      {v.instituicaoNome}
                      {v.instituicaoSigla && ` (${v.instituicaoSigla})`}
                    </Link>
                    {vigente ? (
                      <SeloSituacao tom="sucesso">Vigente</SeloSituacao>
                    ) : (
                      <SeloSituacao tom="neutro">Encerrado</SeloSituacao>
                    )}
                    {v.principal && vigente && <SeloSituacao tom="aviso">Principal</SeloSituacao>}
                  </div>
                  <p className="mt-1 text-sm">
                    {[v.cargo, v.area].filter(Boolean).join(" · ") || "Cargo não informado"}
                  </p>
                  <p className="text-xs text-texto-secundario">
                    {descreverPeriodo(v.dataInicio, v.dataFim)}
                  </p>
                  {vigente && !arquivada && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-texto-secundario hover:underline">
                        Encerrar vínculo
                      </summary>
                      <FormularioEncerramento acao={encerrarVinculoPessoa} campo="vinculoId" id={v.id} />
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!arquivada && (
        <section aria-labelledby="titulo-novo-vinculo" className={classeCartao}>
          <h2 id="titulo-novo-vinculo" className="mb-4 text-lg font-semibold">
            Registrar vínculo
          </h2>
          {instituicoes.length === 0 ? (
            <p className="text-sm text-texto-secundario">
              Cadastre a instituição antes de registrar o vínculo.{" "}
              <Link href="/instituicoes/nova" className={classeLink}>
                Nova instituição
              </Link>
            </p>
          ) : (
            <FormularioVinculo pessoaId={id} instituicoes={instituicoes} />
          )}
        </section>
      )}

      <section aria-labelledby="titulo-contextos" className={classeCartao}>
        <h2 id="titulo-contextos" className="mb-1 text-lg font-semibold">
          Projetos e temas
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          As associações são registradas na página de cada projeto ou tema.
        </p>
        <ListaContextos contextos={contextos} />
      </section>

      <section aria-labelledby="titulo-historico" className={classeCartao}>
        <h2 id="titulo-historico" className="mb-4 text-lg font-semibold">
          Histórico de alterações
        </h2>
        <ListaHistorico registros={historico} nomes={nomes} perspectiva="pessoa" />
      </section>
    </div>
  );
}

function ItemDado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-texto-secundario">{rotulo}</dt>
      <dd className="mt-0.5 break-words whitespace-pre-line">{valor || "—"}</dd>
    </div>
  );
}
