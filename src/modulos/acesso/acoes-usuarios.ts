"use server";

/**
 * Administração de usuários e permissões (Server Actions). Toda operação confere a sessão de
 * novo e exige administrador; a gravação ainda passa pelas regras do banco, que recusam quem
 * não for administrador mesmo se esta conferência falhar. A chave secreta só é lida em
 * lib/autenticacao/administracao.ts, depois dessa conferência.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { modoDeAcesso } from "@/lib/banco/ambiente";
import { comoUsuario } from "@/lib/banco/conexao";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { bancoDaSessao } from "@/lib/banco/requisicao";
import { lerFormulario } from "@/lib/formulario";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { ehAdministrador } from "./capacidades";
import {
  esquemaEdicaoUsuario,
  esquemaNovoUsuario,
  esquemaPermissao,
  esquemaRevogacao,
  esquemaSomenteUsuario,
} from "./esquemas-usuarios";
import { obterUsuarioAtual } from "./usuario-atual";
import {
  atualizarUsuario,
  concederPermissao,
  criarUsuario,
  definirSituacaoUsuario,
  obterUsuario,
  revogarPermissao,
} from "./usuarios";

const SOMENTE_ADMINISTRADOR = "Somente o administrador do sistema administra usuários e permissões.";

/** Estado de um formulário que pode devolver uma senha provisória, mostrada uma única vez. */
export type EstadoNovoUsuario = EstadoFormulario & { senhaProvisoria?: string; novoUsuarioId?: string };

async function contextoDoAdministrador() {
  const banco = await bancoDaSessao();
  if (!(await ehAdministrador(banco))) return null;
  const usuario = await obterUsuarioAtual(banco);
  return { banco, usuario };
}

function revalidar(usuarioId?: string) {
  revalidatePath("/usuarios");
  if (usuarioId) revalidatePath(`/usuarios/${usuarioId}`);
}

export async function criarUsuarioAcao(_estado: EstadoNovoUsuario, formData: FormData): Promise<EstadoNovoUsuario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaNovoUsuario.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const contexto = await contextoDoAdministrador();
  if (!contexto) return { mensagem: SOMENTE_ADMINISTRADOR, valores };

  // A conta e o cadastro interno nascem na mesma operação; se o cadastro falhar, a conta é desfeita.
  let authId: string | null = null;
  let senhaProvisoria: string | undefined;
  const administracao = modoDeAcesso() === "supabase" ? await import("@/lib/autenticacao/administracao") : null;
  if (administracao) {
    senhaProvisoria = administracao.gerarSenhaProvisoria();
    try {
      authId = await administracao.criarConta(resultado.data.email, senhaProvisoria);
    } catch (erro) {
      const existente = erro instanceof Error && erro.message === "CONTA_EXISTENTE";
      return {
        mensagem: existente ? "Já existe uma conta com este e-mail." : "Não foi possível criar a conta de acesso.",
        valores,
      };
    }
  }
  try {
    const novoUsuarioId = await comoUsuario(contexto.banco, contexto.usuario.id, (tx) =>
      criarUsuario(tx, { ...resultado.data, authId }),
    );
    revalidar();
    return { sucesso: true, senhaProvisoria, novoUsuarioId };
  } catch (erro) {
    if (administracao && authId) await administracao.excluirConta(authId).catch(() => {});
    return { mensagem: mensagemDeErro(erro), valores };
  }
}

export async function editarUsuarioAcao(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaEdicaoUsuario.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const contexto = await contextoDoAdministrador();
  if (!contexto) return { mensagem: SOMENTE_ADMINISTRADOR, valores };
  try {
    await comoUsuario(contexto.banco, contexto.usuario.id, (tx) =>
      atualizarUsuario(tx, resultado.data.usuarioId, { nome: resultado.data.nome, administrador: resultado.data.administrador }),
    );
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidar(resultado.data.usuarioId);
  return { sucesso: true };
}

async function alterarSituacao(formData: FormData, situacao: "ativo" | "inativo"): Promise<EstadoFormulario> {
  const { dados } = lerFormulario(formData);
  const resultado = esquemaSomenteUsuario.safeParse(dados);
  if (!resultado.success) return { mensagem: "Usuário inválido." };
  const contexto = await contextoDoAdministrador();
  if (!contexto) return { mensagem: SOMENTE_ADMINISTRADOR };
  const { usuarioId } = resultado.data;
  if (situacao === "inativo" && usuarioId === contexto.usuario.id) {
    return { mensagem: "Você não pode desativar a sua própria conta." };
  }
  const alvo = await obterUsuario(contexto.banco, usuarioId);
  if (!alvo) return { mensagem: "Usuário não encontrado." };
  try {
    await comoUsuario(contexto.banco, contexto.usuario.id, (tx) => definirSituacaoUsuario(tx, usuarioId, situacao));
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro) };
  }
  // O bloqueio já vale pelo banco; suspender a conta também impede novos logins.
  let aviso: string | undefined;
  if (alvo.authId && modoDeAcesso() === "supabase") {
    const administracao = await import("@/lib/autenticacao/administracao");
    try {
      if (situacao === "inativo") await administracao.suspenderConta(alvo.authId);
      else await administracao.reativarConta(alvo.authId);
    } catch {
      aviso = "A situação foi alterada e vale de imediato, mas a conta de acesso não pôde ser atualizada. Tente de novo.";
    }
  }
  revalidar(usuarioId);
  return aviso ? { mensagem: aviso } : { sucesso: true };
}

export async function desativarUsuarioAcao(_estado: EstadoFormulario, formData: FormData) {
  return alterarSituacao(formData, "inativo");
}

export async function reativarUsuarioAcao(_estado: EstadoFormulario, formData: FormData) {
  return alterarSituacao(formData, "ativo");
}

export async function redefinirSenhaAcao(_estado: EstadoNovoUsuario, formData: FormData): Promise<EstadoNovoUsuario> {
  const { dados } = lerFormulario(formData);
  const resultado = esquemaSomenteUsuario.safeParse(dados);
  if (!resultado.success) return { mensagem: "Usuário inválido." };
  const contexto = await contextoDoAdministrador();
  if (!contexto) return { mensagem: SOMENTE_ADMINISTRADOR };
  const alvo = await obterUsuario(contexto.banco, resultado.data.usuarioId);
  if (!alvo?.authId || modoDeAcesso() !== "supabase") return { mensagem: "Este usuário não tem conta de acesso." };
  const administracao = await import("@/lib/autenticacao/administracao");
  const senhaProvisoria = administracao.gerarSenhaProvisoria();
  try {
    await administracao.redefinirSenha(alvo.authId, senhaProvisoria);
  } catch {
    return { mensagem: "Não foi possível redefinir a senha." };
  }
  return { sucesso: true, senhaProvisoria };
}

export async function concederPermissaoAcao(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaPermissao.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const contexto = await contextoDoAdministrador();
  if (!contexto) return { mensagem: SOMENTE_ADMINISTRADOR, valores };
  try {
    await comoUsuario(contexto.banco, contexto.usuario.id, (tx) =>
      concederPermissao(tx, {
        usuarioId: resultado.data.usuarioId,
        projetoTemaId: resultado.data.projetoTemaId,
        perfil: resultado.data.perfil,
        validaAte: resultado.data.validaAte ?? null,
      }),
    );
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidar(resultado.data.usuarioId);
  return { sucesso: true };
}

export async function revogarPermissaoAcao(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { dados } = lerFormulario(formData);
  const resultado = esquemaRevogacao.safeParse(dados);
  if (!resultado.success) return { mensagem: "Permissão inválida." };
  const contexto = await contextoDoAdministrador();
  if (!contexto) return { mensagem: SOMENTE_ADMINISTRADOR };
  try {
    await comoUsuario(contexto.banco, contexto.usuario.id, (tx) => revogarPermissao(tx, resultado.data.permissaoId));
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro) };
  }
  revalidar(resultado.data.usuarioId);
  return { sucesso: true };
}
