/**
 * Qual caminho de acesso vale neste ambiente. A escolha é explícita e, na dúvida em produção,
 * o sistema se recusa a iniciar: o administrador fictício só existe no modo local.
 *
 * - "supabase": login real (Supabase Auth) e conexão com o papel crm_app.
 * - "local": PGlite e administrador fictício, sem login. Só em desenvolvimento e testes, ou na
 *   versão compilada com autorização explícita (CRM_BANCO=pglite), para testes locais.
 */
export type ModoDeAcesso = "supabase" | "local";

export function modoDeAcesso(ambiente: Record<string, string | undefined> = process.env): ModoDeAcesso {
  if (ambiente.CRM_BANCO === "pglite") return "local";
  if (ambiente.CRM_BANCO_URL && ambiente.NEXT_PUBLIC_SUPABASE_URL && ambiente.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return "supabase";
  }
  if (ambiente.NODE_ENV === "production") {
    throw new Error(
      "Ambiente sem configuração de acesso: informe a conexão do Supabase (CRM_BANCO_URL, " +
        "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ou, apenas para testes " +
        "locais da versão compilada, CRM_BANCO=pglite.",
    );
  }
  return "local";
}
