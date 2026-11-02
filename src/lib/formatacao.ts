const FUSO_HORARIO = "America/Sao_Paulo";

/** "2026-10-31" → "31/10/2026". */
export function formatarData(data: string | null | undefined): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Período de um vínculo, por exemplo "De 01/02/2025 até 31/10/2026" ou "Desde 01/02/2025". */
export function descreverPeriodo(inicio: string | null, fim: string | null): string {
  if (inicio && fim) return `De ${formatarData(inicio)} até ${formatarData(fim)}`;
  if (inicio) return `Desde ${formatarData(inicio)}`;
  if (fim) return `Até ${formatarData(fim)}`;
  return "Período não informado";
}

const FORMATO_NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Número no padrão brasileiro, com até duas casas decimais: 87.5 → "87,5". */
export function formatarNumero(valor: number): string {
  return FORMATO_NUMERO.format(valor);
}

/** Data de hoje no fuso de Brasília, no formato AAAA-MM-DD. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_HORARIO }).format(agora);
}

/** Data e hora no fuso de Brasília, por exemplo "31/10/2026 21:45". */
export function formatarDataHora(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_HORARIO,
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}
