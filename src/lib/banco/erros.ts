export type ErroBanco = {
  code: string;
  constraint?: string;
  message?: string;
};

/**
 * Localiza o erro original do PostgreSQL. O Drizzle envolve esse erro em outro,
 * acessível pela propriedade "cause".
 */
export function erroDoBanco(erro: unknown): ErroBanco | undefined {
  let atual: unknown = erro;
  for (let nivel = 0; nivel < 5 && typeof atual === "object" && atual !== null; nivel++) {
    const candidato = atual as Partial<ErroBanco> & { cause?: unknown };
    if (typeof candidato.code === "string") return candidato as ErroBanco;
    atual = candidato.cause;
  }
  return undefined;
}
