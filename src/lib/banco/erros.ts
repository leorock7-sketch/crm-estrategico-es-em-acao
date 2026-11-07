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
    const candidato = atual as Partial<ErroBanco> & { cause?: unknown; constraint_name?: string };
    if (typeof candidato.code === "string") {
      // O driver postgres informa a regra em constraint_name; o PGlite, em constraint.
      return { code: candidato.code, constraint: candidato.constraint ?? candidato.constraint_name, message: candidato.message };
    }
    atual = candidato.cause;
  }
  return undefined;
}
