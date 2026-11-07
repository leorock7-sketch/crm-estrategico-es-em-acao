"use server";

/**
 * Entrada e saída do sistema. A mensagem de erro do login é sempre a mesma, para não revelar
 * se o e-mail existe. O login não concede acesso por si: quem decide é o cadastro interno.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteSupabaseDaRequisicao } from "./supabase-servidor";

export type EstadoAutenticacao = { mensagem?: string; sucesso?: boolean; erros?: Record<string, string[] | undefined> };

const esquemaLogin = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  senha: z.string().min(1, "Informe a senha."),
});

/** Só caminhos internos: evita que um link leve o usuário a outro site depois do login. */
function destinoSeguro(valor: unknown): string {
  return typeof valor === "string" && valor.startsWith("/") && !valor.startsWith("//") && !valor.startsWith("/\\")
    ? valor
    : "/";
}

export async function entrar(_estado: EstadoAutenticacao, formData: FormData): Promise<EstadoAutenticacao> {
  const resultado = esquemaLogin.safeParse({ email: formData.get("email"), senha: formData.get("senha") });
  if (!resultado.success) return { mensagem: "Informe o e-mail e a senha." };
  const supabase = await clienteSupabaseDaRequisicao();
  const { error } = await supabase.auth.signInWithPassword({
    email: resultado.data.email,
    password: resultado.data.senha,
  });
  if (error) return { mensagem: "E-mail ou senha incorretos, ou conta sem acesso." };
  redirect(destinoSeguro(formData.get("destino")));
}

export async function sair(): Promise<void> {
  const supabase = await clienteSupabaseDaRequisicao();
  await supabase.auth.signOut();
  redirect("/login");
}

const esquemaNovaSenha = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual."),
    novaSenha: z.string().min(12, "Use pelo menos 12 caracteres."),
    confirmacao: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmacao, { path: ["confirmacao"], message: "A confirmação não confere." });

/** Troca a senha da própria conta, depois de conferir a senha atual. */
export async function trocarSenha(_estado: EstadoAutenticacao, formData: FormData): Promise<EstadoAutenticacao> {
  const resultado = esquemaNovaSenha.safeParse({
    senhaAtual: formData.get("senhaAtual"),
    novaSenha: formData.get("novaSenha"),
    confirmacao: formData.get("confirmacao"),
  });
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors };
  const supabase = await clienteSupabaseDaRequisicao();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  if (typeof email !== "string") redirect("/login");
  const conferencia = await supabase.auth.signInWithPassword({ email, password: resultado.data.senhaAtual });
  if (conferencia.error) return { erros: { senhaAtual: ["Senha atual incorreta."] } };
  const { error } = await supabase.auth.updateUser({ password: resultado.data.novaSenha });
  if (error) return { mensagem: "Não foi possível trocar a senha. Tente outra." };
  return { sucesso: true };
}
