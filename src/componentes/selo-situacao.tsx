import type { ReactNode } from "react";

type PropriedadesSeloSituacao = {
  children: ReactNode;
};

/** Selo que indica a situação de um item, por exemplo "Em desenvolvimento". */
export function SeloSituacao({ children }: PropriedadesSeloSituacao) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
      {children}
    </span>
  );
}
