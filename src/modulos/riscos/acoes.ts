"use server";

/**
 * Operações chamadas pelos formulários da Matriz de Riscos (Server Actions).
 * Todas validam os dados no servidor e conferem a permissão no projeto ou tema
 * do risco antes de gravar. Nenhuma operação reduz a avaliação de um risco por
 * conta própria: só uma nova avaliação fundamentada o faz (D-072, item 3.1).
 */
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { comoUsuario, type Executor, obterBanco } from "@/lib/banco/conexao";
import { projetoTema } from "@/lib/banco/esquema";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { lerFormulario } from "@/lib/formulario";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { EdicaoNegadaError, exigirEdicaoEmAlgum } from "@/modulos/acesso/visibilidade";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import {
  arquivarGatilho,
  arquivarResposta,
  atualizarGatilho,
  atualizarResposta,
  atualizarRisco,
  criarGatilho,
  criarResposta,
  criarRisco,
  definirArquivamentoRisco,
  incluirStakeholderNoRisco,
  obterRisco,
  registrarAvaliacao,
  registrarOcorrenciaGatilho,
  retirarStakeholderDoRisco,
  riscoDoGatilho,
} from "./consultas";
import {
  esquemaAvaliacao,
  esquemaGatilho,
  esquemaNovoRisco,
  esquemaRegistroGatilho,
  esquemaResposta,
  esquemaRisco,
  esquemaStakeholderRisco,
} from "./esquemas";

function identificadorOpcional(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const resultado = esquemaIdentificador.safeParse(valor);
  if (!resultado.success) throw new Error("Identificador de registro inválido.");
  return resultado.data;
}

function revalidarTelas(riscoId?: string) {
  revalidatePath("/riscos", "layout");
  if (riscoId) revalidatePath(`/riscos/${riscoId}`);
  revalidatePath("/acoes", "layout");
  revalidatePath("/planos", "layout");
  revalidatePath("/iniciativas", "layout");
  revalidatePath("/projetos-temas", "layout");
  revalidatePath("/pessoas", "layout");
  revalidatePath("/instituicoes", "layout");
  revalidatePath("/");
}

/** Executa a gravação conferindo a permissão no projeto ou tema do risco; devolve mensagem de erro, se houver. */
async function gravarNoRisco(
  riscoId: string,
  gravar: (tx: Executor) => Promise<unknown>,
  { permitirArquivado = false } = {},
): Promise<string | null> {
  const banco = await obterBanco();
  const usuario = await obterUsuarioAtual(banco);
  const encontrado = await obterRisco(banco, riscoId);
  if (!encontrado) return "Risco não encontrado.";
  if (encontrado.arquivadoEm && !permitirArquivado) return "Reative o risco antes de alterá-lo.";
  try {
    await exigirEdicaoEmAlgum(banco, usuario.id, [encontrado.projetoTemaId]);
    await comoUsuario(banco, usuario.id, gravar);
  } catch (erro) {
    if (erro instanceof EdicaoNegadaError) return erro.message;
    return mensagemDeErro(erro);
  }
  return null;
}

// --- Riscos ------------------------------------------------------------------

export async function salvarRisco(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const id = identificadorOpcional(valores.id);
  let riscoId: string;
  if (id) {
    const resultado = esquemaRisco.safeParse(dados);
    if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
    const erro = await gravarNoRisco(id, (tx) => atualizarRisco(tx, id, resultado.data));
    if (erro) return { mensagem: erro, valores };
    riscoId = id;
  } else {
    const resultado = esquemaNovoRisco.safeParse(dados);
    if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
    const banco = await obterBanco();
    const usuario = await obterUsuarioAtual(banco);
    try {
      const [ativo] = await banco
        .select({ id: projetoTema.id })
        .from(projetoTema)
        .where(and(eq(projetoTema.id, resultado.data.projetoTemaId), isNull(projetoTema.arquivadoEm)));
      if (!ativo) return { mensagem: "Projeto ou tema não encontrado ou arquivado.", valores };
      await exigirEdicaoEmAlgum(banco, usuario.id, [resultado.data.projetoTemaId]);
      riscoId = await comoUsuario(banco, usuario.id, (tx) => criarRisco(tx, resultado.data));
    } catch (erro) {
      if (erro instanceof EdicaoNegadaError) return { mensagem: erro.message, valores };
      return { mensagem: mensagemDeErro(erro), valores };
    }
  }
  revalidarTelas(riscoId);
  redirect(`/riscos/${riscoId}`);
}

export async function alterarArquivamentoRisco(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const id = esquemaIdentificador.parse(formData.get("id"));
  const arquivar = formData.get("arquivar") === "sim";
  const erro = await gravarNoRisco(id, (tx) => definirArquivamentoRisco(tx, id, arquivar), { permitirArquivado: true });
  if (erro) return { mensagem: erro };
  revalidarTelas(id);
  return { sucesso: true };
}

// --- Avaliações --------------------------------------------------------------

/** Nova avaliação (inerente ou residual), sempre fundamentada; as anteriores ficam no histórico. */
export async function registrarAvaliacaoAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaAvaliacao.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const erro = await gravarNoRisco(resultado.data.riscoId, (tx) => registrarAvaliacao(tx, resultado.data));
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(resultado.data.riscoId);
  return { sucesso: true };
}

// --- Gatilhos ----------------------------------------------------------------

export async function salvarGatilho(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const id = identificadorOpcional(valores.id);
  const resultado = esquemaGatilho.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await obterBanco();
  if (id && (await riscoDoGatilho(banco, id)) !== resultado.data.riscoId) return { mensagem: "Gatilho não encontrado.", valores };
  const erro = await gravarNoRisco(resultado.data.riscoId, async (tx) => {
    if (id) await atualizarGatilho(tx, id, resultado.data.descricao);
    else await criarGatilho(tx, resultado.data.riscoId, resultado.data.descricao);
  });
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(resultado.data.riscoId);
  return { sucesso: true };
}

export async function arquivarGatilhoAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const id = esquemaIdentificador.parse(formData.get("id"));
  const banco = await obterBanco();
  const riscoId = await riscoDoGatilho(banco, id);
  if (!riscoId) return { mensagem: "Gatilho não encontrado." };
  const erro = await gravarNoRisco(riscoId, (tx) => arquivarGatilho(tx, id));
  if (erro) return { mensagem: erro };
  revalidarTelas(riscoId);
  return { sucesso: true };
}

/** Registra se o gatilho ocorreu; não altera a avaliação do risco (sinaliza a reavaliação). */
export async function registrarOcorrenciaGatilhoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaRegistroGatilho.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await obterBanco();
  const riscoId = await riscoDoGatilho(banco, resultado.data.gatilhoId);
  if (!riscoId) return { mensagem: "Gatilho não encontrado.", valores };
  const erro = await gravarNoRisco(riscoId, (tx) => registrarOcorrenciaGatilho(tx, resultado.data));
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(riscoId);
  return { sucesso: true };
}

// --- Respostas ---------------------------------------------------------------

export async function salvarResposta(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const id = identificadorOpcional(valores.id);
  const resultado = esquemaResposta.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const erro = await gravarNoRisco(resultado.data.riscoId, async (tx) => {
    if (id) await atualizarResposta(tx, id, resultado.data);
    else await criarResposta(tx, resultado.data);
  });
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(resultado.data.riscoId);
  return { sucesso: true };
}

export async function arquivarRespostaAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const id = esquemaIdentificador.parse(formData.get("id"));
  const riscoId = esquemaIdentificador.parse(formData.get("riscoId"));
  const erro = await gravarNoRisco(riscoId, (tx) => arquivarResposta(tx, id, riscoId));
  if (erro) return { mensagem: erro };
  revalidarTelas(riscoId);
  return { sucesso: true };
}

// --- Stakeholders do risco ---------------------------------------------------

export async function incluirStakeholderNoRiscoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaStakeholderRisco.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const erro = await gravarNoRisco(resultado.data.riscoId, (tx) => incluirStakeholderNoRisco(tx, resultado.data));
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(resultado.data.riscoId);
  return { sucesso: true };
}

export async function retirarStakeholderDoRiscoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const id = esquemaIdentificador.parse(formData.get("id"));
  const riscoId = esquemaIdentificador.parse(formData.get("riscoId"));
  const erro = await gravarNoRisco(riscoId, (tx) => retirarStakeholderDoRisco(tx, id, riscoId));
  if (erro) return { mensagem: erro };
  revalidarTelas(riscoId);
  return { sucesso: true };
}
