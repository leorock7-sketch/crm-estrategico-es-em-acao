import { modoDeAcesso } from "@/lib/banco/ambiente";
import { sql } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";
import { temIdentidade } from "@/lib/banco/identidade";

export type UsuarioAtual = { id: string; nome: string; email: string; administrador?: boolean };

/**
 * Administrador fictício, autor dos dados de demonstração. Só é usado no modo local (PGlite,
 * sem login): no modo Supabase, não participa de nenhuma operação e não tem como entrar no
 * sistema, porque a entrada exige uma identidade ligada por auth_id, que ele não tem.
 */
export const USUARIO_DESENVOLVIMENTO = {
  id: "0a000000-0000-4000-8000-000000000001",
  nome: "Administrador (desenvolvimento)",
  email: "administrador@exemplo.invalid",
} as const;

const bancosPreparados = new WeakSet<object>();

/** Garante o administrador fictício. Só com a conexão-base: as regras recusariam esta inclusão. */
export async function prepararBancoLocal(banco: Executor) {
  if (bancosPreparados.has(banco)) return;
  // Só as colunas originais: serve também a bancos ainda não atualizados.
  const { id, nome, email } = USUARIO_DESENVOLVIMENTO;
  await banco.execute(
    sql`insert into usuario (id, nome, email, administrador) values (${id}, ${nome}, ${email}, true) on conflict do nothing`,
  );
  bancosPreparados.add(banco);
}

/**
 * Usuário responsável pelas operações. No modo Supabase, é o usuário da sessão, com a identidade
 * confirmada; no modo local, o administrador fictício. Um banco com identidade já teve o
 * administrador fictício preparado em bancoDaSessao().
 */
export async function obterUsuarioAtual(banco: Executor): Promise<UsuarioAtual> {
  if (modoDeAcesso() === "supabase") {
    const { usuarioDaSessao } = await import("@/lib/autenticacao/sessao");
    // Só identifica o usuário; a recusa durante a troca obrigatória de senha (P-056) fica em bancoDaSessao.
    return usuarioDaSessao({ permitirTrocaPendente: true });
  }
  if (!temIdentidade(banco)) await prepararBancoLocal(banco);
  return USUARIO_DESENVOLVIMENTO;
}
