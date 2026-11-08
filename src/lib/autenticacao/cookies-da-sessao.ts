/**
 * Opções dos cookies da sessão do Supabase Auth, usadas pelo proxy e pelo servidor (D-087, T8):
 * - httpOnly: os programas da página não leem o cookie (o navegador não usa o cliente do Supabase);
 * - sameSite lax: o cookie não acompanha requisições iniciadas por outros sites;
 * - secure: o cookie só trafega por HTTPS. Fica de fora apenas no desenvolvimento local (next dev,
 *   em http://localhost), que não tem HTTPS.
 */
export function opcoesDosCookiesDaSessao(ambiente: string | undefined = process.env.NODE_ENV) {
  return { httpOnly: true, sameSite: "lax", secure: ambiente === "production" } as const;
}
