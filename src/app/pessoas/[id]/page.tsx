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
import { alterarArquivamentoPessoa } from "@/modulos/stakeholders/acoes";
import { BotaoArquivamento } from "@/modulos/stakeholders/componentes/botao-arquivamento";
import { FormularioEncerramento } from "@/modulos/stakeholders/componentes/formulario-encerramento";
import { FormularioVinculo } from "@/modulos/stakeholders/componentes/formulario-vinculo";
import { ListaHistorico } from "@/modulos/stakeholders/componentes/lista-historico";
import {
  historicoDoStakeholder,
  idsCitadosNoHistorico,
  listarVinculosDaPessoa,
  nomesDosStakeholders,
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

  const [vinculos, historico, instituicoes] = await Promise.all([
    listarVinculosDaPessoa(banco, id),
    historicoDoStakeholder(banco, id),
    opcoesInstituicoes(banco),
  ]);
  const nomes = await nomesDosStakeholders(banco, idsCitadosNoHistorico(historico));
  const arquivada = pessoa.arquivadoEm !== null;

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
          vínculos, reative o cadastro.
        </Alerta>
      )}

      <section aria-labelledby="titulo-dados" className={classeCartao}>
        <h2 id="titulo-dados" className="mb-4 text-lg font-semibold">
          Dados
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <ItemDado rotulo="E-mail" valor={pessoa.email} />
          <ItemDado rotulo="Telefone" valor={pessoa.telefone} />
          <div className="sm:col-span-2">
            <ItemDado rotulo="Observações" valor={pessoa.observacoes} />
          </div>
          <ItemDado rotulo="Cadastrada em" valor={formatarDataHora(pessoa.criadoEm)} />
          <ItemDado rotulo="Última alteração" valor={formatarDataHora(pessoa.atualizadoEm)} />
        </dl>
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
                      <FormularioEncerramento vinculoId={v.id} />
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
