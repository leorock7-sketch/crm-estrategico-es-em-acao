import { SeloSituacao } from "@/componentes/selo-situacao";
import { ROTULOS_SITUACAO_INICIATIVA, type SituacaoIniciativa } from "@/modulos/iniciativas/rotulos";
import {
  ROTULOS_SITUACAO_COMPROMISSO,
  ROTULOS_SITUACAO_INTERACAO,
  ROTULOS_SITUACAO_PRAZO,
  type SituacaoCompromisso,
  type SituacaoInteracao,
  situacaoDoPrazo,
} from "../rotulos";

export function SeloIniciativa({ situacao }: { situacao: SituacaoIniciativa }) {
  const tom = situacao === "concluida" ? "sucesso" : situacao === "suspensa" ? "aviso" : "neutro";
  return <SeloSituacao tom={tom}>{ROTULOS_SITUACAO_INICIATIVA[situacao]}</SeloSituacao>;
}

export function SeloInteracao({ situacao }: { situacao: SituacaoInteracao }) {
  const tom = situacao === "realizada" ? "sucesso" : situacao === "agendada" ? "aviso" : "neutro";
  return <SeloSituacao tom={tom}>{ROTULOS_SITUACAO_INTERACAO[situacao]}</SeloSituacao>;
}

/** Situação do compromisso e, se pendente, a situação do prazo (vencido em destaque). */
export function SeloCompromisso({
  situacao,
  prazo,
  hoje,
}: {
  situacao: SituacaoCompromisso;
  prazo: string | null;
  hoje: string;
}) {
  const prazoSituacao = situacaoDoPrazo({ situacao, prazo }, hoje);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <SeloSituacao tom={situacao === "concluido" ? "sucesso" : "neutro"}>{ROTULOS_SITUACAO_COMPROMISSO[situacao]}</SeloSituacao>
      {(prazoSituacao === "vencido" || prazoSituacao === "vence_hoje") && (
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${
            prazoSituacao === "vencido"
              ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
              : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          }`}
        >
          {ROTULOS_SITUACAO_PRAZO[prazoSituacao]}
        </span>
      )}
    </span>
  );
}
