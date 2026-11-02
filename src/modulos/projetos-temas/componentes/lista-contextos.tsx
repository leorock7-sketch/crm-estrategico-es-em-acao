import Link from "next/link";
import { classeLink } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { descreverPeriodo } from "@/lib/formatacao";
import type { ContextoDoStakeholder } from "../consultas";
import { ROTULOS_TIPO_PROJETO_TEMA, ROTULOS_TIPO_RELACAO } from "../rotulos";

/** Projetos e temas a que uma pessoa ou instituição está associada (somente leitura). */
export function ListaContextos({ contextos }: { contextos: ContextoDoStakeholder[] }) {
  if (contextos.length === 0) {
    return <p className="text-sm text-texto-secundario">Nenhuma associação a projetos ou temas.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-borda text-sm">
      {contextos.map((contexto) => (
        <li key={contexto.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-texto-secundario">
              {ROTULOS_TIPO_PROJETO_TEMA[contexto.tipo]}
            </span>
            <Link href={`/projetos-temas/${contexto.projetoTemaId}`} className={classeLink}>
              {contexto.projetoTemaNome}
            </Link>
            {contexto.dataFim === null ? (
              <SeloSituacao tom="sucesso">Vigente</SeloSituacao>
            ) : (
              <SeloSituacao tom="neutro">Encerrada</SeloSituacao>
            )}
            {contexto.projetoArquivado && <SeloSituacao tom="neutro">Projeto arquivado</SeloSituacao>}
          </div>
          <p className="mt-1">
            {ROTULOS_TIPO_RELACAO[contexto.tipoRelacao]}
            {contexto.descricao && <span className="text-texto-secundario"> · {contexto.descricao}</span>}
          </p>
          <p className="text-xs text-texto-secundario">
            {contexto.comiteNome} · {descreverPeriodo(contexto.dataInicio, contexto.dataFim)}
          </p>
        </li>
      ))}
    </ul>
  );
}
