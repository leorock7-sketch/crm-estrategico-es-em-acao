import { SeloSituacao } from "@/componentes/selo-situacao";
import { ROTULOS_SITUACAO_VERSAO, rotuloDaSituacaoAcao, type SituacaoAcao, type SituacaoVersaoPlano } from "../rotulos";

export function SeloVersao({ situacao }: { situacao: SituacaoVersaoPlano }) {
  const tom = situacao === "aprovada" ? "sucesso" : situacao === "em_aprovacao" || situacao === "rascunho" ? "aviso" : "neutro";
  return <SeloSituacao tom={tom}>{ROTULOS_SITUACAO_VERSAO[situacao]}</SeloSituacao>;
}

/** Situação da ação (sem registro, "Sem situação registrada", D-089) e o destaque de atraso. */
export function SeloAcao({ situacao, atrasada }: { situacao: SituacaoAcao | null; atrasada?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 whitespace-nowrap">
      <SeloSituacao tom={situacao === "concluida" ? "sucesso" : situacao === "suspensa" ? "aviso" : "neutro"}>{rotuloDaSituacaoAcao(situacao)}</SeloSituacao>
      {atrasada && (
        <span className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-3 py-1 text-sm font-semibold text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          Atrasada
        </span>
      )}
    </span>
  );
}

/** Marcos alcançados sobre os previstos, com barra proporcional (o percentual informado é à parte). */
export function ProgressoMarcos({ alcancados, previstos }: { alcancados: number; previstos: number }) {
  if (previstos === 0) return <span className="text-texto-secundario">Sem marcos</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        className="relative h-2 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="img"
        aria-label={`${alcancados} de ${previstos} marcos alcançados`}
      >
        <span className="absolute inset-y-0 left-0 bg-green-600" style={{ width: `${(alcancados / previstos) * 100}%` }} />
      </span>
      <span className="tabular-nums">
        {alcancados}/{previstos} marcos
      </span>
    </span>
  );
}
