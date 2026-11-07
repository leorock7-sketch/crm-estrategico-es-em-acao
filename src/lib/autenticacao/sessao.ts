import "server-only";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { obterBancoBase } from "@/lib/banco/conexao";
import { comIdentidade } from "@/lib/banco/identidade";
import { clienteSupabaseDaRequisicao } from "./supabase-servidor";
import { DESTINO_DA_TROCA, exigeTrocaDeSenha } from "./troca-obrigatoria";

export type UsuarioDaSessao = { id: string; nome: string; email: string; administrador: boolean };

export type SituacaoDaSessao =
  | { tipo: "sem_sessao" }
  | { tipo: "sem_acesso" }
  | { tipo: "ativa"; usuario: UsuarioDaSessao; trocaDeSenhaPendente: boolean };

type LinhaIdentificada = UsuarioDaSessao & { situacao: "ativo" | "inativo" };

/**
 * Identidade autenticada. getClaims() confere a assinatura do token; getSession() não confere
 * e nunca é usada aqui. O cookie sozinho não prova nada.
 */
const identidadeConfirmada = cache(async (): Promise<{ authId: string; trocaDeSenhaPendente: boolean } | null> => {
  const supabase = await clienteSupabaseDaRequisicao();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { authId: data.claims.sub, trocaDeSenhaPendente: exigeTrocaDeSenha(data.claims) };
});

/**
 * Situação da sessão: identidade confirmada e usuário interno ativo, ligado por auth_id
 * (nunca pelo e-mail). Conta válida sem cadastro interno, ou inativa, não dá acesso a nada.
 */
export const consultarSessao = cache(async (): Promise<SituacaoDaSessao> => {
  const identidade = await identidadeConfirmada();
  if (!identidade) return { tipo: "sem_sessao" };
  const { authId, trocaDeSenhaPendente } = identidade;
  const banco = comIdentidade(await obterBancoBase(), null);
  const resultado = await banco.execute(sql`select * from identificar_usuario(${authId}::uuid)`);
  const linha = resultado.rows[0] as LinhaIdentificada | undefined;
  if (!linha || linha.situacao !== "ativo") return { tipo: "sem_acesso" };
  return {
    tipo: "ativa",
    usuario: { id: linha.id, nome: linha.nome, email: linha.email, administrador: linha.administrador },
    trocaDeSenhaPendente,
  };
});

/**
 * Usuário da sessão, ou desvio para o login ou para o aviso de falta de acesso. Com a senha
 * provisória ainda não trocada (P-056), as operações do servidor também desviam para a troca;
 * só a leitura da página da troca é permitida.
 */
export async function usuarioDaSessao(opcoes: { permitirTrocaPendente?: boolean } = {}): Promise<UsuarioDaSessao> {
  const sessao = await consultarSessao();
  if (sessao.tipo === "sem_sessao") redirect("/login");
  if (sessao.tipo === "sem_acesso") redirect("/sem-acesso");
  if (sessao.trocaDeSenhaPendente && !opcoes.permitirTrocaPendente) redirect(DESTINO_DA_TROCA);
  return sessao.usuario;
}
