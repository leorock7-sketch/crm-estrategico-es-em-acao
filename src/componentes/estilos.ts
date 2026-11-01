/** Classes visuais compartilhadas (Tailwind CSS), para manter a aparência uniforme. */

export const classeBotaoPrimario =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500";

export const classeBotaoSecundario =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-borda bg-superficie px-4 py-2 text-sm font-medium text-texto transition-colors hover:bg-fundo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

export const classeEntrada =
  "block w-full rounded-lg border border-borda bg-superficie px-3 py-2 text-sm text-texto shadow-sm placeholder:text-texto-secundario focus:border-blue-700 focus:outline-2 focus:outline-blue-700/30 aria-invalid:border-red-600";

export const classeCartao = "rounded-2xl border border-borda bg-superficie p-6 shadow-sm";

export const classeLink =
  "font-medium text-blue-800 underline-offset-2 hover:underline dark:text-blue-300";

export const classeTabela = "w-full border-collapse text-left text-sm";

export const classeCelulaCabecalho =
  "border-b border-borda px-3 py-2 text-xs font-semibold uppercase tracking-wide text-texto-secundario";

export const classeCelula = "border-b border-borda px-3 py-2 align-top";
