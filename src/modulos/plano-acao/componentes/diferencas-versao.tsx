import { formatarData } from "@/lib/formatacao";
import type { DiferencaAcao } from "../diferencas";

const DATAS = /^\d{4}-\d{2}-\d{2}$/;

function formatar(valor: string | null) {
  if (!valor) return "—";
  return DATAS.test(valor) ? formatarData(valor) : valor;
}

/** Lista do que muda entre duas versões do plano: ações incluídas, retiradas e alteradas. */
export function DiferencasVersao({ diferencas, vazio }: { diferencas: DiferencaAcao[]; vazio: string }) {
  if (diferencas.length === 0) return <p className="text-sm text-texto-secundario">{vazio}</p>;
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {diferencas.map((d) => (
        <li key={`${d.tipo}-${d.codigo}`} className="rounded-lg border border-borda p-3">
          <p>
            <span
              className={`mr-2 inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                d.tipo === "incluida"
                  ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200"
                  : d.tipo === "retirada"
                    ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              }`}
            >
              {d.tipo === "incluida" ? "Incluída" : d.tipo === "retirada" ? "Retirada" : "Alterada"}
            </span>
            <span className="font-semibold">{d.codigo}</span> {d.titulo}
          </p>
          {d.tipo === "alterada" && (
            <dl className="mt-2 grid gap-1">
              {d.alteracoes.map((a) => (
                <div key={a.campo} className="grid gap-x-3 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-texto-secundario">{a.campo}</dt>
                  <dd className="break-words">
                    <span className="text-texto-secundario line-through">{formatar(a.antes)}</span> → <span>{formatar(a.depois)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Tabela provisória (D-072, item 2.3) do que exige nova versão aprovada e do que é acompanhamento. */
export function RegrasDeVersao() {
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <p className="font-semibold">Exige nova versão aprovada</p>
        <ul className="mt-1 list-disc pl-5 text-texto-secundario">
          <li>Incluir ou retirar ação ou marco</li>
          <li>Alterar prazo previsto</li>
          <li>Trocar responsável</li>
          <li>Alterar descrição, escopo ou pilar da ação</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold">Não exige aprovação (acompanhamento)</p>
        <ul className="mt-1 list-disc pl-5 text-texto-secundario">
          <li>Registrar situação e percentual</li>
          <li>Registrar marco alcançado</li>
          <li>Incluir observação de acompanhamento</li>
          <li>Ligar a ação a uma iniciativa ou a stakeholders</li>
        </ul>
      </div>
      <p className="text-xs text-texto-secundario sm:col-span-2">
        Regras adotadas provisoriamente. A correção de erro de digitação numa versão aprovada ainda depende de definição;
        por ora, também é feita por nova versão.
      </p>
    </div>
  );
}
