import Link from "next/link";
import { classeLink } from "@/componentes/estilos";
import { formatarData } from "@/lib/formatacao";
import type { CompromissoDaLista } from "../consultas";
import { SeloCompromisso } from "./selos";

/** Nome e link do responsável (da equipe, externo ou ambos). */
export function ResponsavelCompromisso({ compromisso }: { compromisso: CompromissoDaLista }) {
  const externo = compromisso.responsavelStakeholderId && compromisso.responsavelStakeholderNome && (
    <Link
      href={`/${compromisso.responsavelStakeholderTipo === "pessoa" ? "pessoas" : "instituicoes"}/${compromisso.responsavelStakeholderId}`}
      className={classeLink}
    >
      {compromisso.responsavelStakeholderNome}
    </Link>
  );
  if (compromisso.responsavelUsuarioNome && externo) {
    return (
      <>
        {compromisso.responsavelUsuarioNome} e {externo}
      </>
    );
  }
  return <>{compromisso.responsavelUsuarioNome ?? externo ?? "—"}</>;
}

/**
 * Compromissos em lista: encaminhamento, responsável, prazo e situação, com o
 * prazo vencido em destaque. `mostrarOrigem` exibe a interação e a iniciativa.
 */
export function ListaCompromissos({
  compromissos,
  hoje,
  mostrarOrigem = true,
  vazio = "Nenhum compromisso.",
}: {
  compromissos: CompromissoDaLista[];
  hoje: string;
  mostrarOrigem?: boolean;
  vazio?: string;
}) {
  if (compromissos.length === 0) return <p className="text-sm text-texto-secundario">{vazio}</p>;
  return (
    <ul className="flex flex-col divide-y divide-borda text-sm">
      {compromissos.map((c) => (
        <li key={c.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={`/compromissos/${c.id}`} className={`${classeLink} min-w-0 break-words`}>
              {c.descricao}
            </Link>
            <SeloCompromisso situacao={c.situacao} prazo={c.prazo} hoje={hoje} />
          </div>
          <p className="text-texto-secundario">
            Responsável: <ResponsavelCompromisso compromisso={c} /> · Prazo: {c.prazo ? formatarData(c.prazo) : "sem prazo"}
            {c.concluidoEm && ` · Concluído em ${formatarData(c.concluidoEm)}`}
          </p>
          {mostrarOrigem && (c.interacaoId || c.iniciativaId) && (
            <p className="text-xs text-texto-secundario">
              {c.interacaoId && (
                <>
                  Interação:{" "}
                  <Link href={`/interacoes/${c.interacaoId}`} className={classeLink}>
                    {c.interacaoAssunto}
                  </Link>
                </>
              )}
              {c.interacaoId && c.iniciativaId && " · "}
              {c.iniciativaId && (
                <>
                  Iniciativa:{" "}
                  <Link href={`/iniciativas/${c.iniciativaId}`} className={classeLink}>
                    {c.iniciativaTitulo}
                  </Link>
                </>
              )}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
