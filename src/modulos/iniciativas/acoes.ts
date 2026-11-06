"use server";

/**
 * Operações chamadas pelos formulários de iniciativas (Server Actions). Todas
 * validam os dados no servidor e conferem a permissão nos projetos ou temas da
 * iniciativa antes de gravar.
 */
import { and, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { comoUsuario, type Executor } from "@/lib/banco/conexao";
import { bancoDaSessao } from "@/lib/banco/requisicao";
import { projetoTema } from "@/lib/banco/esquema";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { lerFormulario } from "@/lib/formulario";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { EdicaoNegadaError, exigirEdicaoEmAlgum } from "@/modulos/acesso/visibilidade";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import {
  atualizarIniciativa,
  criarIniciativa,
  definirArquivamentoIniciativa,
  incluirProjetoNaIniciativa,
  incluirStakeholderNaIniciativa,
  obterIniciativa,
  projetosDaIniciativa,
  retirarProjetoDaIniciativa,
  retirarStakeholderDaIniciativa,
} from "./consultas";
import {
  esquemaIniciativa,
  esquemaNovaIniciativa,
  esquemaProjetoDaIniciativa,
  esquemaRetirada,
  esquemaStakeholderDaIniciativa,
} from "./esquemas";

function identificadorOpcional(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const resultado = esquemaIdentificador.safeParse(valor);
  if (!resultado.success) throw new Error("Identificador de registro inválido.");
  return resultado.data;
}

/** Mensagem de erro se algum projeto ou tema não existir ou estiver arquivado. */
async function conferirProjetosAtivos(banco: Executor, ids: string[]): Promise<string | null> {
  if (ids.length === 0) return null;
  const ativos = await banco
    .select({ id: projetoTema.id })
    .from(projetoTema)
    .where(and(inArray(projetoTema.id, ids), isNull(projetoTema.arquivadoEm)));
  return ativos.length === new Set(ids).size ? null : "Projeto ou tema não encontrado ou arquivado.";
}

/** Iniciativa ativa e que o usuário pode alterar, ou mensagem de erro. */
async function iniciativaEditavel(banco: Executor, usuarioId: string, iniciativaId: string) {
  const encontrada = await obterIniciativa(banco, iniciativaId);
  if (!encontrada) return { erro: "Iniciativa não encontrada." } as const;
  if (encontrada.arquivadoEm) return { erro: "Reative a iniciativa antes de alterá-la." } as const;
  const projetos = await projetosDaIniciativa(banco, iniciativaId);
  try {
    await exigirEdicaoEmAlgum(banco, usuarioId, projetos.map((p) => p.projetoTemaId));
  } catch (erro) {
    if (erro instanceof EdicaoNegadaError) return { erro: erro.message } as const;
    throw erro;
  }
  return { iniciativa: encontrada } as const;
}

function revalidarTelas(iniciativaId?: string) {
  revalidatePath("/iniciativas");
  if (iniciativaId) revalidatePath(`/iniciativas/${iniciativaId}`);
  revalidatePath("/projetos-temas", "layout");
  revalidatePath("/pessoas", "layout");
  revalidatePath("/instituicoes", "layout");
  revalidatePath("/interacoes", "layout");
  revalidatePath("/compromissos", "layout");
}

// --- Iniciativas -------------------------------------------------------------

export async function salvarIniciativa(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData, ["projetos"]);
  const id = identificadorOpcional(valores.id);
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);

  let iniciativaId: string;
  try {
    if (id) {
      const resultado = esquemaIniciativa.safeParse(dados);
      if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
      const editavel = await iniciativaEditavel(banco, usuario.id, id);
      if ("erro" in editavel) return { mensagem: editavel.erro, valores };
      await comoUsuario(banco, usuario.id, (tx) => atualizarIniciativa(tx, id, resultado.data));
      iniciativaId = id;
    } else {
      const resultado = esquemaNovaIniciativa.safeParse(dados);
      if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
      const erroProjetos = await conferirProjetosAtivos(banco, resultado.data.projetos);
      if (erroProjetos) return { mensagem: erroProjetos, valores };
      await exigirEdicaoEmAlgum(banco, usuario.id, resultado.data.projetos);
      iniciativaId = await comoUsuario(banco, usuario.id, (tx) => criarIniciativa(tx, resultado.data));
    }
  } catch (erro) {
    if (erro instanceof EdicaoNegadaError) return { mensagem: erro.message, valores };
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidarTelas(iniciativaId);
  redirect(`/iniciativas/${iniciativaId}`);
}

export async function alterarArquivamentoIniciativa(id: string, arquivar: boolean) {
  const iniciativaId = esquemaIdentificador.parse(id);
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const projetos = await projetosDaIniciativa(banco, iniciativaId);
  await exigirEdicaoEmAlgum(banco, usuario.id, projetos.map((p) => p.projetoTemaId));
  await comoUsuario(banco, usuario.id, (tx) => definirArquivamentoIniciativa(tx, iniciativaId, arquivar));
  revalidarTelas(iniciativaId);
}

// --- Projetos e temas da iniciativa ------------------------------------------

export async function incluirProjetoNaIniciativaAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaProjetoDaIniciativa.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };

  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const editavel = await iniciativaEditavel(banco, usuario.id, resultado.data.iniciativaId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  const erroProjetos = await conferirProjetosAtivos(banco, [resultado.data.projetoTemaId]);
  if (erroProjetos) return { mensagem: erroProjetos, valores };
  try {
    await comoUsuario(banco, usuario.id, (tx) =>
      incluirProjetoNaIniciativa(tx, resultado.data.iniciativaId, resultado.data.projetoTemaId),
    );
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarTelas(resultado.data.iniciativaId);
  return { sucesso: true };
}

export async function retirarProjetoDaIniciativaAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaRetirada.safeParse(dados);
  if (!resultado.success) return { mensagem: "Ligação inválida.", valores };

  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const iniciativaId = identificadorOpcional(valores.iniciativaId);
  if (!iniciativaId) return { mensagem: "Iniciativa não encontrada.", valores };
  const editavel = await iniciativaEditavel(banco, usuario.id, iniciativaId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  try {
    const retirada = await comoUsuario(banco, usuario.id, (tx) =>
      retirarProjetoDaIniciativa(tx, resultado.data.ligacaoId, iniciativaId),
    );
    if (!retirada) return { mensagem: "Este projeto ou tema já tinha sido retirado.", valores };
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarTelas(iniciativaId);
  return { sucesso: true };
}

// --- Stakeholders da iniciativa ----------------------------------------------

export async function incluirStakeholderNaIniciativaAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaStakeholderDaIniciativa.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };

  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const editavel = await iniciativaEditavel(banco, usuario.id, resultado.data.iniciativaId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  try {
    await comoUsuario(banco, usuario.id, (tx) => incluirStakeholderNaIniciativa(tx, resultado.data));
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarTelas(resultado.data.iniciativaId);
  return { sucesso: true };
}

export async function retirarStakeholderDaIniciativaAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaRetirada.safeParse(dados);
  if (!resultado.success) return { mensagem: "Ligação inválida.", valores };

  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const iniciativaId = identificadorOpcional(valores.iniciativaId);
  if (!iniciativaId) return { mensagem: "Iniciativa não encontrada.", valores };
  const editavel = await iniciativaEditavel(banco, usuario.id, iniciativaId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  try {
    const retirada = await comoUsuario(banco, usuario.id, (tx) =>
      retirarStakeholderDaIniciativa(tx, resultado.data.ligacaoId, iniciativaId),
    );
    if (!retirada) return { mensagem: "Este stakeholder já tinha sido retirado.", valores };
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarTelas(iniciativaId);
  return { sucesso: true };
}
