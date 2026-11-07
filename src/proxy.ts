/**
 * Renova a sessão do Supabase Auth a cada requisição e leva ao login quem não tem sessão.
 * É só a primeira barreira, para o usuário não ver telas vazias: a proteção efetiva está no
 * servidor (lib/autenticacao/sessao.ts) e no banco (regras de acesso da migração 0009).
 */
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { modoDeAcesso } from "@/lib/banco/ambiente";

const ROTAS_PUBLICAS = ["/login", "/sem-acesso"];

export async function proxy(requisicao: NextRequest) {
  if (modoDeAcesso() !== "supabase") return NextResponse.next();

  let resposta = NextResponse.next({ request: requisicao });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      cookieOptions: { httpOnly: true, sameSite: "lax" },
      cookies: {
        getAll: () => requisicao.cookies.getAll(),
        setAll: (novos) => {
          for (const { name, value } of novos) requisicao.cookies.set(name, value);
          resposta = NextResponse.next({ request: requisicao });
          for (const { name, value, options } of novos) resposta.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const autenticado = !error && Boolean(data?.claims?.sub);
  const caminho = requisicao.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.includes(caminho);

  if (!autenticado && !publica) {
    const login = requisicao.nextUrl.clone();
    login.pathname = "/login";
    login.search = caminho === "/" ? "" : `?destino=${encodeURIComponent(caminho + requisicao.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }
  if (autenticado && caminho === "/login") {
    const inicio = requisicao.nextUrl.clone();
    inicio.pathname = "/";
    inicio.search = "";
    return NextResponse.redirect(inicio);
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
