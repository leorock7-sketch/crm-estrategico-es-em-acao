import type { Executor } from "@/lib/banco/conexao";
import { usuario } from "@/lib/banco/esquema";

/**
 * PROVISÓRIO até a etapa de autenticação: enquanto não há login, todas as
 * operações são atribuídas a um administrador fictício de desenvolvimento.
 * Esta função será substituída pela identificação do usuário do Supabase Auth.
 */
export const USUARIO_DESENVOLVIMENTO = {
  id: "0a000000-0000-4000-8000-000000000001",
  nome: "Administrador (desenvolvimento)",
  email: "administrador@exemplo.invalid",
} as const;

const bancosPreparados = new WeakSet<object>();

export async function obterUsuarioAtual(banco: Executor) {
  if (!bancosPreparados.has(banco)) {
    await banco
      .insert(usuario)
      .values({ ...USUARIO_DESENVOLVIMENTO, administrador: true })
      .onConflictDoNothing();
    bancosPreparados.add(banco);
  }
  return USUARIO_DESENVOLVIMENTO;
}
