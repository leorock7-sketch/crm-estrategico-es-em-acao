/**
 * Troca obrigatória da senha provisória (P-056, Etapa 7). A marca fica nos metadados da conta que
 * só o servidor, com a chave secreta, consegue alterar (app_metadata): o próprio usuário não a
 * remove. Ela segue no token de acesso; por isso, o proxy a lê sem consultar o banco.
 */
export const MARCA_TROCA_OBRIGATORIA = "troca_senha_obrigatoria";

/** Única página disponível enquanto a senha provisória não for trocada. */
export const PAGINA_DA_TROCA = "/minha-conta";
export const DESTINO_DA_TROCA = `${PAGINA_DA_TROCA}?troca=obrigatoria`;

export function exigeTrocaDeSenha(claims: unknown): boolean {
  const metadados = (claims as { app_metadata?: Record<string, unknown> } | null | undefined)?.app_metadata;
  return metadados?.[MARCA_TROCA_OBRIGATORIA] === true;
}
