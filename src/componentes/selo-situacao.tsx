import type { ReactNode } from "react";

const TONS = {
  aviso:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  neutro:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  sucesso:
    "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
} as const;

const PONTOS = {
  aviso: "bg-amber-500",
  neutro: "bg-slate-400",
  sucesso: "bg-green-600",
} as const;

type PropriedadesSeloSituacao = {
  children: ReactNode;
  tom?: keyof typeof TONS;
};

/** Selo que indica a situação de um item, por exemplo "Em desenvolvimento" ou "Arquivada". */
export function SeloSituacao({ children, tom = "aviso" }: PropriedadesSeloSituacao) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${TONS[tom]}`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${PONTOS[tom]}`} />
      {children}
    </span>
  );
}
