import "server-only";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Administração de contas no Supabase Auth, com a chave secreta. Usada SOMENTE aqui, nas
 * operações do administrador do sistema, depois de conferida a permissão. A chave ignora as
 * regras de acesso; por isso, não serve para nenhuma consulta do CRM nem chega ao navegador.
 */
function clienteAdministrativo() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error("Chave secreta do Supabase não configurada neste servidor.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Senha provisória forte; é mostrada uma única vez ao administrador e não é guardada. */
export function gerarSenhaProvisoria(): string {
  return randomBytes(18).toString("base64url");
}

/** Cria a conta já confirmada, sem enviar e-mail: o serviço institucional de e-mail fica para a Etapa 7. */
export async function criarConta(email: string, senha: string): Promise<string> {
  const { data, error } = await clienteAdministrativo().auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.code === "email_exists" ? "CONTA_EXISTENTE" : "FALHA_AO_CRIAR_CONTA");
  return data.user.id;
}

export async function excluirConta(authId: string): Promise<void> {
  await clienteAdministrativo().auth.admin.deleteUser(authId);
}

/** Impede novos logins e renovações. O bloqueio imediato vem do banco, que confere a situação a cada consulta. */
export async function suspenderConta(authId: string): Promise<void> {
  const { error } = await clienteAdministrativo().auth.admin.updateUserById(authId, { ban_duration: "876000h" });
  if (error) throw new Error("FALHA_AO_SUSPENDER_CONTA");
}

export async function reativarConta(authId: string): Promise<void> {
  const { error } = await clienteAdministrativo().auth.admin.updateUserById(authId, { ban_duration: "none" });
  if (error) throw new Error("FALHA_AO_REATIVAR_CONTA");
}

export async function redefinirSenha(authId: string, senha: string): Promise<void> {
  const { error } = await clienteAdministrativo().auth.admin.updateUserById(authId, { password: senha });
  if (error) throw new Error("FALHA_AO_REDEFINIR_SENHA");
}
