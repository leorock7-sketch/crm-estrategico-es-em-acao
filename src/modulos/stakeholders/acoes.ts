"use server";

/**
 * Operações chamadas pelos formulários do Cadastro Mestre (Server Actions).
 * Todas validam os dados no servidor antes de gravar.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { comoUsuario, obterBanco } from "@/lib/banco/conexao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import {
  atualizarInstituicao,
  atualizarPessoa,
  criarInstituicao,
  criarPessoa,
  criarVinculo,
  definirArquivamentoInstituicao,
  definirArquivamentoPessoa,
  encerrarVinculo,
  obterInstituicao,
  obterPessoa,
  possiveisDuplicidadesInstituicao,
  possiveisDuplicidadesPessoa,
  type PossivelDuplicidade,
} from "./consultas";
import {
  esquemaEncerramentoVinculo,
  esquemaInstituicao,
  esquemaPessoa,
  esquemaVinculo,
} from "./esquemas";
import { identificacaoInstituicaoMudou, identificacaoPessoaMudou } from "./duplicidade";
import { mensagemDeErro } from "./mensagens-erro";

export type EstadoFormulario = {
  /** Mensagens de erro por campo. */
  erros?: Record<string, string[] | undefined>;
  /** Mensagem geral (por exemplo, falha ao gravar). */
  mensagem?: string;
  /** Possíveis registros repetidos, que exigem confirmação para prosseguir. */
  duplicidades?: PossivelDuplicidade[];
  /** Valores enviados, para reapresentar o formulário preenchido. */
  valores?: Record<string, string>;
  sucesso?: boolean;
};

function valoresDoFormulario(formData: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [campo, valor] of formData.entries()) {
    if (typeof valor === "string" && !campo.startsWith("$")) valores[campo] = valor;
  }
  return valores;
}

/** Identificador opcional vindo de campo oculto do formulário (edição). */
function identificadorOpcional(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const resultado = esquemaIdentificador.safeParse(valor);
  if (!resultado.success) throw new Error("Identificador de registro inválido.");
  return resultado.data;
}

// --- Pessoas -----------------------------------------------------------------

export async function salvarPessoa(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const id = identificadorOpcional(valores.id);
  const resultado = esquemaPessoa.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }

  const banco = await obterBanco();
  const atual = id ? await obterPessoa(banco, id) : null;
  if (id && !atual) return { mensagem: "Pessoa não encontrada.", valores };
  if (atual?.arquivadoEm) return { mensagem: "Reative o cadastro antes de editá-lo.", valores };

  const verificarDuplicidade = !atual || identificacaoPessoaMudou(atual, resultado.data);
  if (verificarDuplicidade && valores.confirmarDuplicidade !== "sim") {
    const duplicidades = await possiveisDuplicidadesPessoa(banco, resultado.data, id);
    if (duplicidades.length > 0) return { duplicidades, valores };
  }

  const usuario = await obterUsuarioAtual(banco);
  let pessoaId: string;
  try {
    pessoaId = await comoUsuario(banco, usuario.id, async (tx) => {
      if (!id) return criarPessoa(tx, resultado.data);
      await atualizarPessoa(tx, id, resultado.data);
      return id;
    });
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidatePath("/pessoas");
  redirect(`/pessoas/${pessoaId}`);
}

export async function alterarArquivamentoPessoa(id: string, arquivar: boolean) {
  const pessoaId = esquemaIdentificador.parse(id);
  const banco = await obterBanco();
  const usuario = await obterUsuarioAtual(banco);
  await comoUsuario(banco, usuario.id, (tx) =>
    definirArquivamentoPessoa(tx, pessoaId, arquivar),
  );
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${pessoaId}`);
}

// --- Instituições ------------------------------------------------------------

export async function salvarInstituicao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const id = identificadorOpcional(valores.id);
  const resultado = esquemaInstituicao.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }

  const banco = await obterBanco();
  const atual = id ? await obterInstituicao(banco, id) : null;
  if (id && !atual) return { mensagem: "Instituição não encontrada.", valores };
  if (atual?.arquivadoEm) return { mensagem: "Reative o cadastro antes de editá-lo.", valores };

  const verificarDuplicidade = !atual || identificacaoInstituicaoMudou(atual, resultado.data);
  if (verificarDuplicidade && valores.confirmarDuplicidade !== "sim") {
    const duplicidades = await possiveisDuplicidadesInstituicao(banco, resultado.data, id);
    if (duplicidades.length > 0) return { duplicidades, valores };
  }

  const usuario = await obterUsuarioAtual(banco);
  let instituicaoId: string;
  try {
    instituicaoId = await comoUsuario(banco, usuario.id, async (tx) => {
      if (!id) return criarInstituicao(tx, resultado.data);
      await atualizarInstituicao(tx, id, resultado.data);
      return id;
    });
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidatePath("/instituicoes");
  redirect(`/instituicoes/${instituicaoId}`);
}

export async function alterarArquivamentoInstituicao(id: string, arquivar: boolean) {
  const instituicaoId = esquemaIdentificador.parse(id);
  const banco = await obterBanco();
  const usuario = await obterUsuarioAtual(banco);
  await comoUsuario(banco, usuario.id, (tx) =>
    definirArquivamentoInstituicao(tx, instituicaoId, arquivar),
  );
  revalidatePath("/instituicoes");
  revalidatePath(`/instituicoes/${instituicaoId}`);
}

// --- Vínculos ----------------------------------------------------------------

export async function salvarVinculo(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const resultado = esquemaVinculo.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }

  const banco = await obterBanco();
  const [pessoaVinculada, instituicaoVinculada] = await Promise.all([
    obterPessoa(banco, resultado.data.pessoaId),
    obterInstituicao(banco, resultado.data.instituicaoId),
  ]);
  if (!pessoaVinculada || !instituicaoVinculada) {
    return { mensagem: "Pessoa ou instituição não encontrada.", valores };
  }
  if (pessoaVinculada.arquivadoEm || instituicaoVinculada.arquivadoEm) {
    return { mensagem: "Não é possível criar vínculo com registro arquivado.", valores };
  }

  const usuario = await obterUsuarioAtual(banco);
  try {
    await comoUsuario(banco, usuario.id, (tx) => criarVinculo(tx, resultado.data));
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidatePath(`/pessoas/${resultado.data.pessoaId}`);
  revalidatePath(`/instituicoes/${resultado.data.instituicaoId}`);
  return { sucesso: true };
}

export async function encerrarVinculoPessoa(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresDoFormulario(formData);
  const resultado = esquemaEncerramentoVinculo.safeParse(valores);
  if (!resultado.success) {
    return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  }

  const banco = await obterBanco();
  const usuario = await obterUsuarioAtual(banco);
  try {
    const encerrado = await comoUsuario(banco, usuario.id, (tx) =>
      encerrarVinculo(tx, resultado.data.vinculoId, resultado.data.dataFim),
    );
    if (!encerrado) return { mensagem: "Este vínculo já estava encerrado.", valores };
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidatePath("/pessoas", "layout");
  revalidatePath("/instituicoes", "layout");
  return { sucesso: true };
}
