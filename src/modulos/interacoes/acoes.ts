"use server";

/**
 * Operações chamadas pelos formulários de interações e compromissos (Server
 * Actions). Todas validam os dados no servidor e conferem a permissão nos
 * projetos ou temas ligados (diretamente ou pelas iniciativas) antes de gravar.
 */
import { and, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { comoUsuario, type Executor } from "@/lib/banco/conexao";
import { bancoDaSessao } from "@/lib/banco/requisicao";
import { iniciativa, iniciativaProjetoTema, projetoTema } from "@/lib/banco/esquema";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { lerFormulario } from "@/lib/formulario";
import { normalizarTexto } from "@/lib/texto";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { EdicaoNegadaError, exigirEdicaoEmAlgum } from "@/modulos/acesso/visibilidade";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import {
  alterarPresenca,
  atualizarCompromisso,
  atualizarInteracao,
  criarCompromisso,
  criarInteracao,
  definirArquivamentoCompromisso,
  definirArquivamentoInteracao,
  incluirIniciativaNaInteracao,
  incluirParticipante,
  incluirProjetoNaInteracao,
  obterCompromisso,
  obterInteracao,
  possiveisDuplicidadesInteracao,
  projetosDeUmaInteracao,
  projetosDeUmCompromisso,
  registrarAcompanhamento,
  retirarIniciativaDaInteracao,
  retirarParticipante,
  retirarProjetoDaInteracao,
} from "./consultas";
import { valorDataHoraBrasilia } from "./datas";
import {
  esquemaAcompanhamento,
  esquemaCompromisso,
  esquemaIniciativaDaInteracao,
  esquemaInteracao,
  esquemaNovaInteracao,
  esquemaParticipante,
  esquemaPresenca,
  esquemaProjetoDaInteracao,
} from "./esquemas";
import { esquemaRetirada } from "@/modulos/iniciativas/esquemas";

function identificadorOpcional(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const resultado = esquemaIdentificador.safeParse(valor);
  if (!resultado.success) throw new Error("Identificador de registro inválido.");
  return resultado.data;
}

/** Projetos e temas ativos entre os informados e os das iniciativas ativas informadas; ou mensagem de erro. */
async function contextosDaNovaInteracao(banco: Executor, projetos: string[], iniciativas: string[]) {
  if (projetos.length > 0) {
    const ativos = await banco
      .select({ id: projetoTema.id })
      .from(projetoTema)
      .where(and(inArray(projetoTema.id, projetos), isNull(projetoTema.arquivadoEm)));
    if (ativos.length !== new Set(projetos).size) return { erro: "Projeto ou tema não encontrado ou arquivado." } as const;
  }
  let projetosDasIniciativas: string[] = [];
  if (iniciativas.length > 0) {
    const ativas = await banco
      .select({ id: iniciativa.id })
      .from(iniciativa)
      .where(and(inArray(iniciativa.id, iniciativas), isNull(iniciativa.arquivadoEm)));
    if (ativas.length !== new Set(iniciativas).size) return { erro: "Iniciativa não encontrada ou arquivada." } as const;
    const ligacoes = await banco
      .select({ projetoTemaId: iniciativaProjetoTema.projetoTemaId })
      .from(iniciativaProjetoTema)
      .where(and(inArray(iniciativaProjetoTema.iniciativaId, iniciativas), isNull(iniciativaProjetoTema.arquivadoEm)));
    projetosDasIniciativas = ligacoes.map((l) => l.projetoTemaId);
  }
  return { projetos: [...projetos, ...projetosDasIniciativas] } as const;
}

/** Interação ativa e que o usuário pode alterar, ou mensagem de erro. */
async function interacaoEditavel(banco: Executor, usuarioId: string, interacaoId: string) {
  const encontrada = await obterInteracao(banco, interacaoId);
  if (!encontrada) return { erro: "Interação não encontrada." } as const;
  if (encontrada.arquivadoEm) return { erro: "Reative a interação antes de alterá-la." } as const;
  try {
    await exigirEdicaoEmAlgum(banco, usuarioId, await projetosDeUmaInteracao(banco, interacaoId));
  } catch (erro) {
    if (erro instanceof EdicaoNegadaError) return { erro: erro.message } as const;
    throw erro;
  }
  return { interacao: encontrada } as const;
}

function revalidarTelas(caminho?: string) {
  revalidatePath("/interacoes");
  revalidatePath("/compromissos");
  if (caminho) revalidatePath(caminho);
  revalidatePath("/iniciativas", "layout");
  revalidatePath("/projetos-temas", "layout");
  revalidatePath("/pessoas", "layout");
  revalidatePath("/instituicoes", "layout");
}

// --- Interações --------------------------------------------------------------

export async function salvarInteracao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData, [
    "projetos",
    "iniciativas",
    "participantesExternos",
    "participantesInternos",
  ]);
  const id = identificadorOpcional(valores.id);
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);

  let interacaoId: string;
  try {
    if (id) {
      const resultado = esquemaInteracao.safeParse(dados);
      if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
      const editavel = await interacaoEditavel(banco, usuario.id, id);
      if ("erro" in editavel) return { mensagem: editavel.erro, valores };
      // Na edição, só verifica repetição se o assunto ou o início mudaram.
      const mudou =
        editavel.interacao.assuntoNormalizado !== normalizarTexto(resultado.data.assunto) ||
        valorDataHoraBrasilia(editavel.interacao.inicio) !== resultado.data.inicio;
      if (mudou && valores.confirmarDuplicidade !== "sim") {
        const duplicidades = await possiveisDuplicidadesInteracao(banco, resultado.data, id);
        if (duplicidades.length > 0) return { duplicidades, valores };
      }
      await comoUsuario(banco, usuario.id, (tx) => atualizarInteracao(tx, id, resultado.data));
      interacaoId = id;
    } else {
      const resultado = esquemaNovaInteracao.safeParse(dados);
      if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
      const contextos = await contextosDaNovaInteracao(banco, resultado.data.projetos, resultado.data.iniciativas);
      if ("erro" in contextos) return { mensagem: contextos.erro, valores };
      await exigirEdicaoEmAlgum(banco, usuario.id, contextos.projetos);
      if (valores.confirmarDuplicidade !== "sim") {
        const duplicidades = await possiveisDuplicidadesInteracao(banco, resultado.data);
        if (duplicidades.length > 0) return { duplicidades, valores };
      }
      interacaoId = await comoUsuario(banco, usuario.id, (tx) => criarInteracao(tx, resultado.data));
    }
  } catch (erro) {
    if (erro instanceof EdicaoNegadaError) return { mensagem: erro.message, valores };
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidarTelas(`/interacoes/${interacaoId}`);
  redirect(`/interacoes/${interacaoId}`);
}

export async function alterarArquivamentoInteracao(id: string, arquivar: boolean) {
  const interacaoId = esquemaIdentificador.parse(id);
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  await exigirEdicaoEmAlgum(banco, usuario.id, await projetosDeUmaInteracao(banco, interacaoId));
  await comoUsuario(banco, usuario.id, (tx) => definirArquivamentoInteracao(tx, interacaoId, arquivar));
  revalidarTelas(`/interacoes/${interacaoId}`);
}

// --- Participantes -----------------------------------------------------------

export async function incluirParticipanteAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaParticipante.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const editavel = await interacaoEditavel(banco, usuario.id, resultado.data.interacaoId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  try {
    await comoUsuario(banco, usuario.id, (tx) => incluirParticipante(tx, resultado.data));
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarTelas(`/interacoes/${resultado.data.interacaoId}`);
  return { sucesso: true };
}

export async function alterarPresencaAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaPresenca.safeParse(dados);
  const interacaoId = identificadorOpcional(valores.interacaoId);
  if (!resultado.success || !interacaoId) return { mensagem: "Selecione a presença.", valores };
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const editavel = await interacaoEditavel(banco, usuario.id, interacaoId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  try {
    await comoUsuario(banco, usuario.id, (tx) =>
      alterarPresenca(tx, resultado.data.participanteId, interacaoId, resultado.data.presenca),
    );
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarTelas(`/interacoes/${interacaoId}`);
  return { sucesso: true };
}

/** Retirada de participante ou de ligação da interação (arquivamento, com histórico). */
async function retirarDaInteracao(
  formData: FormData,
  retirar: (tx: Executor, ligacaoId: string, interacaoId: string) => Promise<unknown>,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaRetirada.safeParse(dados);
  const interacaoId = identificadorOpcional(valores.interacaoId);
  if (!resultado.success || !interacaoId) return { mensagem: "Registro inválido.", valores };
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const editavel = await interacaoEditavel(banco, usuario.id, interacaoId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  try {
    const retirado = await comoUsuario(banco, usuario.id, (tx) => retirar(tx, resultado.data.ligacaoId, interacaoId));
    if (!retirado) return { mensagem: "Este registro já tinha sido retirado.", valores };
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarTelas(`/interacoes/${interacaoId}`);
  return { sucesso: true };
}

export async function retirarParticipanteAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return retirarDaInteracao(formData, retirarParticipante);
}

// --- Projetos, temas e iniciativas da interação ------------------------------

export async function incluirProjetoNaInteracaoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaProjetoDaInteracao.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const editavel = await interacaoEditavel(banco, usuario.id, resultado.data.interacaoId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  const contextos = await contextosDaNovaInteracao(banco, [resultado.data.projetoTemaId], []);
  if ("erro" in contextos) return { mensagem: contextos.erro, valores };
  try {
    await comoUsuario(banco, usuario.id, (tx) =>
      incluirProjetoNaInteracao(tx, resultado.data.interacaoId, resultado.data.projetoTemaId),
    );
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarTelas(`/interacoes/${resultado.data.interacaoId}`);
  return { sucesso: true };
}

export async function retirarProjetoDaInteracaoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return retirarDaInteracao(formData, retirarProjetoDaInteracao);
}

export async function incluirIniciativaNaInteracaoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaIniciativaDaInteracao.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const editavel = await interacaoEditavel(banco, usuario.id, resultado.data.interacaoId);
  if ("erro" in editavel) return { mensagem: editavel.erro, valores };
  const contextos = await contextosDaNovaInteracao(banco, [], [resultado.data.iniciativaId]);
  if ("erro" in contextos) return { mensagem: contextos.erro, valores };
  try {
    await comoUsuario(banco, usuario.id, (tx) => incluirIniciativaNaInteracao(tx, resultado.data));
  } catch (erro) {
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarTelas(`/interacoes/${resultado.data.interacaoId}`);
  return { sucesso: true };
}

export async function retirarIniciativaDaInteracaoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return retirarDaInteracao(formData, retirarIniciativaDaInteracao);
}

// --- Compromissos ------------------------------------------------------------

export async function salvarCompromisso(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const id = identificadorOpcional(valores.id);
  const resultado = esquemaCompromisso.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };

  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  let compromissoId: string;
  try {
    const atual = id ? await obterCompromisso(banco, id) : null;
    if (id && !atual) return { mensagem: "Compromisso não encontrado.", valores };
    if (atual?.arquivadoEm) return { mensagem: "Reative o compromisso antes de alterá-lo.", valores };
    const daIniciativa = resultado.data.iniciativaId
      ? await contextosDaNovaInteracao(banco, [], [resultado.data.iniciativaId])
      : { projetos: [] as string[] };
    if ("erro" in daIniciativa) return { mensagem: daIniciativa.erro, valores };
    const projetos = [
      ...(resultado.data.interacaoId ? await projetosDeUmaInteracao(banco, resultado.data.interacaoId) : []),
      ...daIniciativa.projetos,
      ...(id ? await projetosDeUmCompromisso(banco, id) : []),
    ];
    await exigirEdicaoEmAlgum(banco, usuario.id, projetos);
    compromissoId = await comoUsuario(banco, usuario.id, async (tx) => {
      if (!id) return criarCompromisso(tx, resultado.data);
      await atualizarCompromisso(tx, id, resultado.data);
      return id;
    });
  } catch (erro) {
    if (erro instanceof EdicaoNegadaError) return { mensagem: erro.message, valores };
    return { mensagem: mensagemDeErro(erro), valores };
  }

  revalidarTelas(`/compromissos/${compromissoId}`);
  if (valores.voltarPara?.startsWith("/")) {
    revalidatePath(valores.voltarPara);
    return { sucesso: true };
  }
  redirect(`/compromissos/${compromissoId}`);
}

export async function alterarArquivamentoCompromisso(id: string, arquivar: boolean) {
  const compromissoId = esquemaIdentificador.parse(id);
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  await exigirEdicaoEmAlgum(banco, usuario.id, await projetosDeUmCompromisso(banco, compromissoId));
  await comoUsuario(banco, usuario.id, (tx) => definirArquivamentoCompromisso(tx, compromissoId, arquivar));
  revalidarTelas(`/compromissos/${compromissoId}`);
}

export async function registrarAcompanhamentoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaAcompanhamento.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const atual = await obterCompromisso(banco, resultado.data.compromissoId);
  if (!atual) return { mensagem: "Compromisso não encontrado.", valores };
  if (atual.arquivadoEm) return { mensagem: "Reative o compromisso antes de registrar o acompanhamento.", valores };
  try {
    await exigirEdicaoEmAlgum(banco, usuario.id, await projetosDeUmCompromisso(banco, resultado.data.compromissoId));
    await comoUsuario(banco, usuario.id, (tx) => registrarAcompanhamento(tx, resultado.data));
  } catch (erro) {
    if (erro instanceof EdicaoNegadaError) return { mensagem: erro.message, valores };
    return { mensagem: mensagemDeErro(erro), valores };
  }
  revalidarTelas(`/compromissos/${resultado.data.compromissoId}`);
  return { sucesso: true };
}
