import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { opcoesDosCookiesDaSessao } from "./cookies-da-sessao";

/**
 * Cliente do Supabase Auth ligado aos cookies da requisição. Usa somente a chave pública
 * (publishable): não acessa tabelas, porque o CRM não usa a API automática do Supabase.
 */
export async function clienteSupabaseDaRequisicao() {
  const armazenamento = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      // O navegador não usa o cliente do Supabase; os programas da página não precisam do cookie.
      cookieOptions: opcoesDosCookiesDaSessao(),
      cookies: {
        getAll: () => armazenamento.getAll(),
        setAll: (novos) => {
          try {
            for (const { name, value, options } of novos) armazenamento.set(name, value, options);
          } catch {
            // Componentes do servidor não gravam cookies; quem renova a sessão é o proxy.ts.
          }
        },
      },
    },
  );
}
