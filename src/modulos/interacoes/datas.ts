/**
 * Data e hora das interações. O campo do formulário ("AAAA-MM-DDTHH:MM") é
 * lido no horário de Brasília, que não tem horário de verão desde 2019.
 */

const FUSO_HORARIO = "America/Sao_Paulo";
const DESLOCAMENTO_BRASILIA = "-03:00";

/** Formato do campo "data e hora" do navegador, sem segundos. */
export const FORMATO_DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "2026-11-05T14:30" (Brasília) → instante. */
export function instanteDeBrasilia(valor: string): Date {
  return new Date(`${valor}:00${DESLOCAMENTO_BRASILIA}`);
}

/** Instante → "2026-11-05T14:30", no horário de Brasília (para preencher o campo). */
export function valorDataHoraBrasilia(instante: Date | string): string {
  const data = typeof instante === "string" ? new Date(instante) : instante;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_HORARIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(data);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}T${parte("hour")}:${parte("minute")}`;
}

/** Início do dia (00:00 em Brasília) de uma data "AAAA-MM-DD". */
export function inicioDoDia(data: string): Date {
  return instanteDeBrasilia(`${data}T00:00`);
}
