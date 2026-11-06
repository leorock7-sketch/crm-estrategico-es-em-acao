import { SeRegistra } from "@/modulos/acesso/componentes/conforme-perfil";
import Link from "next/link";
import { classeCartao, classeLink } from "@/componentes/estilos";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarDataHora, hojeEmBrasilia } from "@/lib/formatacao";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { projetosVisiveis } from "@/modulos/acesso/visibilidade";
import { ListaCompromissos } from "@/modulos/interacoes/componentes/lista-compromissos";
import { SeloIniciativa, SeloInteracao } from "@/modulos/interacoes/componentes/selos";
import {
  compromissosDoStakeholder,
  interacoesDoProjetoTema,
  interacoesDoStakeholder,
  resumoDoProjetoTema,
} from "@/modulos/interacoes/consultas";
import { ROTULOS_PRESENCA, ROTULOS_TIPO_INTERACAO } from "@/modulos/interacoes/rotulos";
import { iniciativasDoProjetoTema, iniciativasDoStakeholder } from "../consultas";
import { ROTULOS_PAPEL_INICIATIVA, ROTULOS_TIPO_INICIATIVA, type PapelIniciativa } from "../rotulos";

/** Iniciativas, interações e compromissos de um projeto ou tema (com atalhos para registrar). */
export async function AtividadesDoProjetoTema({ projetoTemaId, arquivado }: { projetoTemaId: string; arquivado: boolean }) {
  const banco = await bancoDaRequisicao();
  const hoje = hojeEmBrasilia();
  const [iniciativas, interacoes, resumo] = await Promise.all([
    iniciativasDoProjetoTema(banco, projetoTemaId),
    interacoesDoProjetoTema(banco, projetoTemaId),
    resumoDoProjetoTema(banco, projetoTemaId, hoje),
  ]);
  return (
    <section aria-labelledby="titulo-atividades" className={classeCartao}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-atividades" className="text-lg font-semibold">
          Iniciativas, interações e compromissos
        </h2>
        {!arquivado && (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href={`/iniciativas/nova?projeto=${projetoTemaId}`} className={classeLink}>
              Nova iniciativa
            </Link>
            <Link href={`/interacoes/nova?projeto=${projetoTemaId}`} className={classeLink}>
              Registrar interação
            </Link>
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-texto-secundario">
        {resumo.interacoes} interaç{resumo.interacoes === 1 ? "ão" : "ões"} ·{" "}
        <Link href={`/compromissos?projeto=${projetoTemaId}`} className={classeLink}>
          {resumo.pendentes} compromisso{resumo.pendentes === 1 ? "" : "s"} pendente{resumo.pendentes === 1 ? "" : "s"}
        </Link>
        {resumo.vencidos > 0 && (
          <>
            {" · "}
            <Link href={`/compromissos?projeto=${projetoTemaId}&prazo=vencidos`} className="font-semibold text-red-800 underline dark:text-red-300">
              {resumo.vencidos} com prazo vencido
            </Link>
          </>
        )}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-texto-secundario">Iniciativas</h3>
          {iniciativas.length === 0 ? (
            <p className="text-sm text-texto-secundario">Nenhuma iniciativa.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda text-sm">
              {iniciativas.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span>
                    <span className="block text-xs text-texto-secundario">{ROTULOS_TIPO_INICIATIVA[i.tipo]}</span>
                    <Link href={`/iniciativas/${i.id}`} className={classeLink}>
                      {i.titulo}
                    </Link>
                  </span>
                  <SeloIniciativa situacao={i.situacao} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-texto-secundario">Interações recentes</h3>
          {interacoes.length === 0 ? (
            <p className="text-sm text-texto-secundario">Nenhuma interação.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda text-sm">
              {interacoes.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span>
                    <span className="block text-xs text-texto-secundario">
                      {ROTULOS_TIPO_INTERACAO[i.tipo]} · {formatarDataHora(i.inicio)}
                    </span>
                    <Link href={`/interacoes/${i.id}`} className={classeLink}>
                      {i.assunto}
                    </Link>
                  </span>
                  <SeloInteracao situacao={i.situacao} />
                </li>
              ))}
            </ul>
          )}
          {resumo.interacoes > interacoes.length && (
            <Link href={`/interacoes?projeto=${projetoTemaId}`} className={`${classeLink} mt-2 inline-block text-sm`}>
              Ver todas as interações
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/** Iniciativas, interações e compromissos de uma pessoa ou instituição. */
export async function AtividadesDoStakeholder({ stakeholderId }: { stakeholderId: string }) {
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const visiveis = await projetosVisiveis(banco, usuario.id);
  const hoje = hojeEmBrasilia();
  const [iniciativas, interacoes, compromissos] = await Promise.all([
    iniciativasDoStakeholder(banco, stakeholderId, visiveis),
    interacoesDoStakeholder(banco, stakeholderId, visiveis),
    compromissosDoStakeholder(banco, stakeholderId),
  ]);
  return (
    <section aria-labelledby="titulo-atividades" className={classeCartao}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-atividades" className="text-lg font-semibold">
          Iniciativas, interações e compromissos
        </h2>
        <SeRegistra>
          <Link href={`/interacoes/nova?stakeholder=${stakeholderId}`} className={`${classeLink} text-sm`}>
            Registrar interação
          </Link>
        </SeRegistra>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-texto-secundario">Iniciativas</h3>
          {iniciativas.length === 0 ? (
            <p className="text-sm text-texto-secundario">Não participa de nenhuma iniciativa.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda text-sm">
              {iniciativas.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span>
                    <Link href={`/iniciativas/${i.id}`} className={classeLink}>
                      {i.titulo}
                    </Link>
                    <span className="block text-xs text-texto-secundario">
                      {ROTULOS_TIPO_INICIATIVA[i.tipo]} · {i.papeis.map((p) => ROTULOS_PAPEL_INICIATIVA[p as PapelIniciativa]).join(", ")}
                    </span>
                  </span>
                  <SeloIniciativa situacao={i.situacao} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-texto-secundario">Interações</h3>
          {interacoes.length === 0 ? (
            <p className="text-sm text-texto-secundario">Nenhuma interação registrada.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda text-sm">
              {interacoes.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span>
                    <Link href={`/interacoes/${i.id}`} className={classeLink}>
                      {i.assunto}
                    </Link>
                    <span className="block text-xs text-texto-secundario">
                      {ROTULOS_TIPO_INTERACAO[i.tipo]} · {formatarDataHora(i.inicio)} · {ROTULOS_PRESENCA[i.presenca]}
                    </span>
                  </span>
                  <SeloInteracao situacao={i.situacao} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <h3 className="mb-2 mt-6 text-sm font-semibold text-texto-secundario">Compromissos sob sua responsabilidade</h3>
      <ListaCompromissos compromissos={compromissos} hoje={hoje} vazio="Nenhum compromisso." />
    </section>
  );
}
