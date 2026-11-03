import type { Metadata } from "next";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeCartao } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { identificadorDoParametro, textoDoParametro, valorDaLista } from "@/lib/parametros";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { opcoesUsuarios, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { opcoesIniciativas, opcoesProjetosTemas } from "@/modulos/iniciativas/consultas";
import { FiltrosCompromissos } from "@/modulos/interacoes/componentes/filtros";
import { ListaCompromissos } from "@/modulos/interacoes/componentes/lista-compromissos";
import { listarCompromissos } from "@/modulos/interacoes/consultas";
import { FILTROS_COMPROMISSO, situacaoDoPrazo } from "@/modulos/interacoes/rotulos";
import { opcoesStakeholders } from "@/modulos/projetos-temas/consultas";

export const metadata: Metadata = { title: "Compromissos" };

export default function PaginaCompromissos({ searchParams }: PageProps<"/compromissos">) {
  return (
    <>
      <CabecalhoPagina
        titulo="Compromissos"
        descricao="Encaminhamentos das interações e das iniciativas: responsáveis, prazos e acompanhamento."
      />
      <Suspense fallback={<Carregando />}>
        <ListaDeCompromissos searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ListaDeCompromissos({ searchParams }: Pick<PageProps<"/compromissos">, "searchParams">) {
  const parametros = await searchParams;
  const responsavel = textoDoParametro(parametros, "responsavel");
  const filtro = {
    prazo: valorDaLista(parametros, "prazo", FILTROS_COMPROMISSO) ?? "pendentes",
    responsavel: /^[su]:[0-9a-f-]{36}$/i.test(responsavel) ? responsavel : undefined,
    projetoTemaId: identificadorDoParametro(parametros, "projeto"),
    iniciativaId: identificadorDoParametro(parametros, "iniciativa"),
    busca: textoDoParametro(parametros, "busca"),
  };
  const hoje = hojeEmBrasilia();

  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const [compromissos, usuarios, stakeholders, projetos, iniciativas] = await Promise.all([
    listarCompromissos(banco, filtro, hoje, visiveis),
    opcoesUsuarios(banco),
    opcoesStakeholders(banco),
    opcoesProjetosTemas(banco, visiveis),
    opcoesIniciativas(banco, visiveis),
  ]);
  const vencidos = compromissos.filter((c) => situacaoDoPrazo(c, hoje) === "vencido").length;

  return (
    <>
      <FiltrosCompromissos
        valores={{
          prazo: filtro.prazo,
          responsavel: filtro.responsavel ?? "",
          projeto: filtro.projetoTemaId ?? "",
          iniciativa: filtro.iniciativaId ?? "",
          busca: filtro.busca,
        }}
        usuarios={usuarios}
        pessoas={stakeholders.pessoas}
        instituicoes={stakeholders.instituicoes}
        projetos={projetos}
        iniciativas={iniciativas}
      />
      <p className="mb-2 text-sm text-texto-secundario" role="status">
        {compromissos.length === 1 ? "1 compromisso encontrado" : `${compromissos.length} compromissos encontrados`}
        {vencidos > 0 && ` · ${vencidos} com prazo vencido`}
      </p>
      <section className={classeCartao} aria-label="Lista de compromissos">
        <ListaCompromissos compromissos={compromissos} hoje={hoje} vazio="Nenhum compromisso encontrado." />
      </section>
    </>
  );
}
