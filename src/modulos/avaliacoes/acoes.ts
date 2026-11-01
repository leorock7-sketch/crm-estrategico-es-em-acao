"use server";

/**
 * Operações das telas de avaliação (Server Actions). Todas conferem a
 * permissão de edição no projeto ou tema antes de gravar (modulos/acesso).
 * Somente dados fictícios: a metodologia vigente é de demonstração (D-034).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { comoUsuario, obterBanco } from "@/lib/banco/conexao";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { AcessoNegadoError, permissaoNoContexto } from "@/modulos/acesso/permissoes";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import {
  adicionarEvidencia,
  contextoDaEvidencia,
  contextoDaVersao,
  descartarRascunho,
  iniciarRascunho,
  publicarRascunho,
  removerEvidencia,
  salvarRascunho,
} from "./consultas";
import { esquemaEvidencia, esquemaRascunho, notasDoFormulario } from "./esquemas";

function valoresDoFormulario(formData: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [campo, valor] of formData.entries()) {
    if (typeof valor === "string" && !campo.startsWith("$")) valores[campo] = valor;
  }
  return valores;
}

function caminhoDaFicha(projetoTemaId: string, stakeholderId: string) {
  return `/projetos-temas/${projetoTemaId}/avaliacoes/${stakeholderId}`;
}

function revalidarContexto(projetoTemaId: string) {
  revalidatePath(`/projetos-temas/${projetoTemaId}`, "layout");
}

/** Banco, usuário e contexto da versão, se o usuário puder editar; senão, a mensagem de erro. */
async function versaoEditavel(versaoId: string) {
  const banco = await obterBanco();
  const usuario = await obterUsuarioAtual(banco);
  const contexto = await contextoDaVersao(banco, versaoId);
  if (!contexto) return { erro: "Rascunho não encontrado." } as const;
  const permissao = await permissaoNoContexto(banco, usuario.id, contexto.projetoTemaId);
  if (!permissao.editar) return { erro: new AcessoNegadoError("editar").message } as const;
  if (contexto.situacao !== "rascunho" || contexto.arquivadoEm) {
    return { erro: "Esta versão já foi publicada ou descartada e não pode ser alterada." } as const;
  }
  return { banco, usuario, contexto } as const;
}

/** Abre um rascunho (nova avaliação ou nova versão) e leva ao formulário. */
export async function iniciarAvaliacao(projetoTemaId: string, stakeholderId: string) {
  const projeto = esquemaIdentificador.parse(projetoTemaId);
  const pessoaOuInstituicao = esquemaIdentificador.parse(stakeholderId);
  const banco = await obterBanco();
  const usuario = await obterUsuarioAtual(banco);
  const permissao = await permissaoNoContexto(banco, usuario.id, projeto);
  if (!permissao.editar) throw new AcessoNegadoError("editar");
  await comoUsuario(banco, usuario.id, (tx) => iniciarRascunho(tx, projeto, pessoaOuInstituicao));
  revalidarContexto(projeto);
  redirect(`${caminhoDaFicha(projeto, pessoaOuInstituicao)}/rascunho`);
}

/**
 * Salva o rascunho; com o botão "Publicar" (campo "intencao"), salva e publica
 * na mesma operação: se a publicação for recusada, nada é gravado.
 */
export async function salvarRascunhoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const resultado = esquemaRascunho.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }
  let notas: Map<string, number>;
  try {
    notas = notasDoFormulario(valores);
  } catch {
    return { mensagem: "Há uma nota inválida no formulário.", valores };
  }

  const editavel = await versaoEditavel(resultado.data.versaoId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  const { banco, usuario, contexto } = editavel;
  const publicar = valores.intencao === "publicar";
  try {
    await comoUsuario(banco, usuario.id, async (tx) => {
      await salvarRascunho(tx, resultado.data, notas);
      if (publicar) await publicarRascunho(tx, resultado.data.versaoId);
    });
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidarContexto(contexto.projetoTemaId);
  if (publicar) redirect(caminhoDaFicha(contexto.projetoTemaId, contexto.stakeholderId));
  return { sucesso: true, valores };
}

export async function descartarRascunhoAcao(versaoId: string) {
  const editavel = await versaoEditavel(esquemaIdentificador.parse(versaoId));
  if ("erro" in editavel) throw new Error(editavel.erro);
  const { banco, usuario, contexto } = editavel;
  await comoUsuario(banco, usuario.id, (tx) => descartarRascunho(tx, versaoId));
  revalidarContexto(contexto.projetoTemaId);
  redirect(caminhoDaFicha(contexto.projetoTemaId, contexto.stakeholderId));
}

export async function adicionarEvidenciaAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const resultado = esquemaEvidencia.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }
  const editavel = await versaoEditavel(resultado.data.versaoId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  const { banco, usuario, contexto } = editavel;
  try {
    await comoUsuario(banco, usuario.id, (tx) => adicionarEvidencia(tx, resultado.data));
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarContexto(contexto.projetoTemaId);
  return { sucesso: true };
}

export async function removerEvidenciaAcao(evidenciaId: string) {
  const id = esquemaIdentificador.parse(evidenciaId);
  const encontrada = await contextoDaEvidencia(await obterBanco(), id);
  if (!encontrada) throw new Error("Evidência não encontrada.");
  const editavel = await versaoEditavel(encontrada.versaoId);
  if ("erro" in editavel) throw new Error(editavel.erro);
  await comoUsuario(editavel.banco, editavel.usuario.id, (tx) => removerEvidencia(tx, id));
  revalidarContexto(editavel.contexto.projetoTemaId);
}
