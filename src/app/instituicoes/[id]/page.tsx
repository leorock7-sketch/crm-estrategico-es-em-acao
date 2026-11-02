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
import { formatarCnpj } from "@/lib/validacao/cnpj";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { ListaContextos } from "@/modulos/projetos-temas/componentes/lista-contextos";
import { contextosDoStakeholder } from "@/modulos/projetos-temas/consultas";
import { alterarArquivamentoInstituicao } from "@/modulos/stakeholders/acoes";
import { BotaoArquivamento } from "@/modulos/stakeholders/componentes/botao-arquivamento";
import { FormularioContato } from "@/modulos/stakeholders/componentes/formulario-contato";
import { ListaContatos } from "@/modulos/stakeholders/componentes/lista-contatos";
import { ListaHistorico } from "@/modulos/stakeholders/componentes/lista-historico";
import {
  historicoDoStakeholder,
  idsCitadosNoHistorico,
  listarContatos,
  listarSubordinadas,
  listarVinculosDaInstituicao,
  nomesDosRegistros,
  obterInstituicao,
} from "@/modulos/stakeholders/consultas";
import { nomePais } from "@/modulos/stakeholders/paises";
import { ROTULOS_ESFERA, ROTULOS_NATUREZA } from "@/modulos/stakeholders/rotulos";

export const metadata: Metadata = { title: "Instituição" };

export default function PaginaInstituicao({ params }: PageProps<"/instituicoes/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheInstituicao params={params} />
    </Suspense>
  );
}

async function DetalheInstituicao({ params }: Pick<PageProps<"/instituicoes/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();

  const banco = await bancoDaRequisicao();
  const instituicao = await obterInstituicao(banco, id);
  if (!instituicao) notFound();

  const [vinculos, subordinadas, contatos, historico, contextos] = await Promise.all([
    listarVinculosDaInstituicao(banco, id),
    listarSubordinadas(banco, id),
    listarContatos(banco, id),
    historicoDoStakeholder(banco, id),
    contextosDoStakeholder(banco, id),
  ]);
  const nomes = await nomesDosRegistros(banco, idsCitadosNoHistorico(historico));
  const arquivada = instituicao.arquivadoEm !== null;
  const vigentes = vinculos.filter((v) => v.dataFim === null);
  const encerrados = vinculos.filter((v) => v.dataFim !== null);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={instituicao.nome}
        voltar={{ href: "/instituicoes", rotulo: "Instituições" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            {instituicao.sigla && <span>{instituicao.sigla}</span>}
            <span>· {ROTULOS_NATUREZA[instituicao.natureza]}</span>
            {arquivada && <SeloSituacao tom="neutro">Arquivada</SeloSituacao>}
          </span>
        }
        acoes={
          <>
            {!arquivada && (
              <Link href={`/instituicoes/${id}/editar`} className={classeBotaoPrimario}>
                Editar
              </Link>
            )}
            <BotaoArquivamento
              acao={alterarArquivamentoInstituicao.bind(null, id, !arquivada)}
              arquivado={arquivada}
            />
          </>
        }
      />

      {arquivada && (
        <Alerta tom="aviso" titulo="Instituição arquivada">
          Arquivada em {formatarDataHora(instituicao.arquivadoEm)}. Ela deixa de aparecer nas
          listas de seleção de novos vínculos. Para editar, reative o cadastro.
        </Alerta>
      )}

      <section aria-labelledby="titulo-dados" className={classeCartao}>
        <h2 id="titulo-dados" className="mb-4 text-lg font-semibold">
          Dados
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <ItemDado rotulo="Esfera" valor={instituicao.esfera && ROTULOS_ESFERA[instituicao.esfera]} />
          <ItemDado rotulo="País" valor={nomePais(instituicao.pais)} />
          <ItemDado rotulo="CNPJ" valor={instituicao.cnpj && formatarCnpj(instituicao.cnpj)} />
          <ItemDado
            rotulo="Local"
            valor={[instituicao.municipio, instituicao.uf].filter(Boolean).join(" – ")}
          />
          <div>
            <dt className="text-texto-secundario">Site</dt>
            <dd className="mt-0.5 break-all">
              {instituicao.site ? (
                <a href={instituicao.site} target="_blank" rel="noopener noreferrer" className={classeLink}>
                  {instituicao.site}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Instituição superior</dt>
            <dd className="mt-0.5">
              {instituicao.instituicaoSuperiorId ? (
                <Link href={`/instituicoes/${instituicao.instituicaoSuperiorId}`} className={classeLink}>
                  {instituicao.superiorNome}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Instituições subordinadas</dt>
            <dd className="mt-0.5">
              {subordinadas.length === 0
                ? "—"
                : subordinadas.map((s, posicao) => (
                    <span key={s.id}>
                      {posicao > 0 && ", "}
                      <Link href={`/instituicoes/${s.id}`} className={classeLink}>
                        {s.sigla ?? s.nome}
                      </Link>
                    </span>
                  ))}
            </dd>
          </div>
          <ItemDado rotulo="Cadastrada em" valor={formatarDataHora(instituicao.criadoEm)} />
          <ItemDado rotulo="Última alteração" valor={formatarDataHora(instituicao.atualizadoEm)} />
        </dl>
      </section>

      <section aria-labelledby="titulo-pessoas" className={classeCartao}>
        <h2 id="titulo-pessoas" className="mb-1 text-lg font-semibold">
          Pessoas vinculadas
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Os vínculos são registrados na página de cada pessoa.
        </p>
        <ListaVinculos titulo="Vigentes" vinculos={vigentes} vazio="Nenhum vínculo vigente." />
        {encerrados.length > 0 && (
          <div className="mt-6">
            <ListaVinculos titulo="Encerrados" vinculos={encerrados} vazio="" />
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-contatos" className={classeCartao}>
        <h2 id="titulo-contatos" className="mb-1 text-lg font-semibold">
          Contatos institucionais
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          Telefones, e-mails e sites da instituição, com histórico próprio.
        </p>
        <ListaContatos contatos={contatos} somenteLeitura={arquivada} />
        {!arquivada && (
          <details className="mt-4 rounded-lg border border-borda p-4">
            <summary className="cursor-pointer font-medium">Registrar contato</summary>
            <div className="mt-4">
              <FormularioContato stakeholderId={id} naturezaPadrao="institucional" />
            </div>
          </details>
        )}
      </section>

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
        <ListaHistorico registros={historico} nomes={nomes} perspectiva="instituicao" />
      </section>
    </div>
  );
}

type VinculoDaInstituicao = Awaited<ReturnType<typeof listarVinculosDaInstituicao>>[number];

function ListaVinculos({
  titulo,
  vinculos,
  vazio,
}: {
  titulo: string;
  vinculos: VinculoDaInstituicao[];
  vazio: string;
}) {
  return (
    <>
      <h3 className="mb-2 text-sm font-semibold text-texto-secundario">{titulo}</h3>
      {vinculos.length === 0 ? (
        <p className="text-sm text-texto-secundario">{vazio}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda text-sm">
          {vinculos.map((v) => (
            <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span>
                <Link href={`/pessoas/${v.pessoaId}`} className={classeLink}>
                  {v.pessoaNome}
                </Link>
                {v.cargo && <span className="text-texto-secundario"> · {v.cargo}</span>}
              </span>
              <span className="text-xs text-texto-secundario">
                {descreverPeriodo(v.dataInicio, v.dataFim)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ItemDado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-texto-secundario">{rotulo}</dt>
      <dd className="mt-0.5 break-words">{valor || "—"}</dd>
    </div>
  );
}
