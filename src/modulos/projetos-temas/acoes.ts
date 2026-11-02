"use server";

/**
 * Operações chamadas pelos formulários de projetos e temas (Server Actions).
 * Todas validam os dados no servidor antes de gravar. Comitês são somente
 * consulta (D-030): não há ações de alteração de comitês.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { comoUsuario, obterBanco } from "@/lib/banco/conexao";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { normalizarTexto } from "@/lib/texto";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import { obterStakeholder } from "@/modulos/stakeholders/consultas";
import {
  atualizarProjetoTema,
  criarAssociacao,
  criarParticipacao,
  criarProjetoTema,
  definirArquivamentoProjetoTema,
  encerrarAssociacao,
  encerrarParticipacao,
  obterProjetoTema,
  possiveisDuplicidadesProjetoTema,
} from "./consultas";
import {
  esquemaAssociacao,
  esquemaEncerramentoAssociacao,
  esquemaEncerramentoParticipacao,
  esquemaParticipacao,
  esquemaProjetoTema,
} from "./esquemas";

function valoresDoFormulario(formData: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [campo, valor] of formData.entries()) {
    if (typeof valor === "string" && !campo.startsWith("$")) valores[campo] = valor;
  }
  return valores;
}

function identificadorOpcional(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const resultado = esquemaIdentificador.safeParse(valor);
  if (!resultado.success) throw new Error("Identificador de registro inválido.");
  return resultado.data;
}

/** Projeto ou tema ativo (existente e não arquivado), ou mensagem de erro. */
async function projetoAtivo(projetoTemaId: string) {
  const banco = await obterBanco();
  const projeto = await obterProjetoTema(banco, projetoTemaId);
  if (!projeto) return { erro: "Projeto ou tema não encontrado." } as const;
  if (projeto.arquivadoEm) return { erro: "Reative o projeto ou tema antes de alterá-lo." } as const;
  return { banco, projeto } as const;
}

// --- Projetos e temas --------------------------------------------------------

export async function salvarProjetoTema(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const id = identificadorOpcional(valores.id);
  const resultado = esquemaProjetoTema.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }

  const banco = await obterBanco();
  const atual = id ? await obterProjetoTema(banco, id) : null;
  if (id && !atual) return { mensagem: "Projeto ou tema não encontrado.", valores };
  if (atual?.arquivadoEm) return { mensagem: "Reative o cadastro antes de editá-lo.", valores };

  // Na edição, só verifica nomes parecidos se o nome mudou.
  const verificar = !atual || atual.nomeNormalizado !== normalizarTexto(resultado.data.nome);
  if (verificar && valores.confirmarDuplicidade !== "sim") {
    const duplicidades = await possiveisDuplicidadesProjetoTema(banco, resultado.data, id);
    if (duplicidades.length > 0) return { duplicidades, valores };
  }

  const usuario = await obterUsuarioAtual(banco);
  let projetoTemaId: string;
  try {
    projetoTemaId = await comoUsuario(banco, usuario.id, async (tx) => {
      if (!id) return criarProjetoTema(tx, resultado.data);
      await atualizarProjetoTema(tx, id, resultado.data);
      return id;
    });
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidatePath("/projetos-temas");
  revalidatePath("/comites", "layout");
  redirect(`/projetos-temas/${projetoTemaId}`);
}

export async function alterarArquivamentoProjetoTema(id: string, arquivar: boolean) {
  const projetoTemaId = esquemaIdentificador.parse(id);
  const banco = await obterBanco();
  const usuario = await obterUsuarioAtual(banco);
  await comoUsuario(banco, usuario.id, (tx) =>
    definirArquivamentoProjetoTema(tx, projetoTemaId, arquivar),
  );
  revalidatePath("/projetos-temas", "layout");
  revalidatePath("/comites", "layout");
}

// --- Comitês participantes (D-023) -------------------------------------------

export async function salvarParticipacao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const resultado = esquemaParticipacao.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }

  const ativo = await projetoAtivo(resultado.data.projetoTemaId);
  if ("erro" in ativo) return { mensagem: ativo.erro, valores };
  const usuario = await obterUsuarioAtual(ativo.banco);
  try {
    await comoUsuario(ativo.banco, usuario.id, (tx) => criarParticipacao(tx, resultado.data));
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidatePath(`/projetos-temas/${resultado.data.projetoTemaId}`);
  revalidatePath("/comites", "layout");
  return { sucesso: true };
}

export async function encerrarParticipacaoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const resultado = esquemaEncerramentoParticipacao.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }

  const banco = await obterBanco();
  const usuario = await obterUsuarioAtual(banco);
  try {
    const projetoTemaId = await comoUsuario(banco, usuario.id, (tx) =>
      encerrarParticipacao(tx, resultado.data.participacaoId, resultado.data.dataFim),
    );
    if (!projetoTemaId) return { mensagem: "Esta participação já estava encerrada.", valores };
    revalidatePath(`/projetos-temas/${projetoTemaId}`);
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidatePath("/comites", "layout");
  return { sucesso: true };
}

// --- Stakeholders dos contextos (D-030) --------------------------------------

export async function salvarAssociacao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const resultado = esquemaAssociacao.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }

  const ativo = await projetoAtivo(resultado.data.projetoTemaId);
  if ("erro" in ativo) return { mensagem: ativo.erro, valores };
  if (!(await obterStakeholder(ativo.banco, resultado.data.stakeholderId))) {
    return { mensagem: "Pessoa ou instituição não encontrada.", valores };
  }

  const usuario = await obterUsuarioAtual(ativo.banco);
  try {
    await comoUsuario(ativo.banco, usuario.id, (tx) => criarAssociacao(tx, resultado.data));
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidatePath(`/projetos-temas/${resultado.data.projetoTemaId}`);
  revalidatePath("/pessoas", "layout");
  revalidatePath("/instituicoes", "layout");
  return { sucesso: true };
}

export async function encerrarAssociacaoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const resultado = esquemaEncerramentoAssociacao.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }

  const banco = await obterBanco();
  const usuario = await obterUsuarioAtual(banco);
  try {
    const encerrada = await comoUsuario(banco, usuario.id, (tx) =>
      encerrarAssociacao(tx, resultado.data.associacaoId, resultado.data.dataFim),
    );
    if (!encerrada) return { mensagem: "Esta associação já estava encerrada.", valores };
    revalidatePath(`/projetos-temas/${encerrada.projetoTemaId}`);
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidatePath("/pessoas", "layout");
  revalidatePath("/instituicoes", "layout");
  return { sucesso: true };
}
