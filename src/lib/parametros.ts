import { esquemaIdentificador } from "@/lib/validacao/comuns";

type Parametros = Record<string, string | string[] | undefined>;

/** Texto de um parâmetro do endereço da página (vazio se ausente). */
export function textoDoParametro(parametros: Parametros, nome: string): string {
  const valor = parametros[nome];
  return typeof valor === "string" ? valor : "";
}

/** Valor do parâmetro, se pertencer à lista permitida. */
export function valorDaLista<T extends string>(parametros: Parametros, nome: string, lista: readonly T[]): T | undefined {
  const valor = parametros[nome];
  return typeof valor === "string" && (lista as readonly string[]).includes(valor) ? (valor as T) : undefined;
}

/** Identificador (UUID) do parâmetro, se válido. */
export function identificadorDoParametro(parametros: Parametros, nome: string): string | undefined {
  return esquemaIdentificador.safeParse(parametros[nome]).data;
}
