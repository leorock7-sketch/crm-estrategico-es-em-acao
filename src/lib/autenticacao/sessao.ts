import "server-only";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { obterBancoBase } from "@/lib/banco/conexao";
import { comIdentidade } from "@/lib/banco/identidade";
import { clienteSupabaseDaRequisicao } from "./supabase-servidor";

export type UsuarioDaSessao = { id: string; nome: string; email: string; administrador: boolean };

export type SituacaoDaSessao =
  | { tipo: "sem_sessao" }
  | { tipo: "sem_acesso" }
  | { tipo: "ativa"; usuario: UsuarioDaSessao };

type LinhaIdentificada = UsuarioDaSessao & { situacao: "ativo" | "inativo" };

/**
 * Identidade autenticada. getClaims() confere a assinatura do token; getSession() não confere
 * e nunca é usada aqui. O cookie sozinho não prova nada.
 */
const identidadeConfirmada = cache(async (): Promise<string | null> => {
  const supabase = await clienteSupabaseDaRequisicao();
  const { data, error } = await supabase.auth.getClaims();
  if (error) return null;
  return data?.claims?.sub ?? null;
});

/**
 * Situação da sessão: identidade confirmada e usuário interno ativo, ligado por auth_id
 * (nunca pelo e-mail). Conta válida sem cadastro interno, ou inativa, não dá acesso a nada.
 */
export const consultarSessao = cache(async (): Promise<SituacaoDaSessao> => {
  const authId = await identidadeConfirmada();
  if (!authId) return { tipo: "sem_sessao" };
  const banco = comIdentidade(await obterBancoBase(), null);
  const resultado = await banco.execute(sql`select * from identificar_usuario(${authId}::uuid)`);
  const linha = resultado.rows[0] as LinhaIdentificada | undefined;
  if (!linha || linha.situacao !== "ativo") return { tipo: "sem_acesso" };
  return {
    tipo: "ativa",
    usuario: { id: linha.id, nome: linha.nome, email: linha.email, administrador: linha.administrador },
  };
});

/** Usuário da sessão, ou desvio para o login ou para o aviso de falta de acesso. */
export async function usuarioDaSessao(): Promise<UsuarioDaSessao> {
  const sessao = await consultarSessao();
  if (sessao.tipo === "sem_sessao") redirect("/login");
  if (sessao.tipo === "sem_acesso") redirect("/sem-acesso");
  return sessao.usuario;
}
