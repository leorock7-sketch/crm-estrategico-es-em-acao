import type { ReactNode } from "react";

const TONS = {
  erro: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  aviso:
    "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
  sucesso:
    "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
} as const;

type PropriedadesAlerta = {
  tom: keyof typeof TONS;
  titulo?: string;
  children?: ReactNode;
};

/** Mensagem destacada; erros e avisos são anunciados por leitores de tela. */
export function Alerta({ tom, titulo, children }: PropriedadesAlerta) {
  return (
    <div
      role={tom === "sucesso" ? "status" : "alert"}
      className={`rounded-lg border px-4 py-3 text-sm ${TONS[tom]}`}
    >
      {titulo && <p className="font-semibold">{titulo}</p>}
      {children && <div className={titulo ? "mt-1" : undefined}>{children}</div>}
    </div>
  );
}
