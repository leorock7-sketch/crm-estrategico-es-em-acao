"use server";

/**
 * Operações chamadas pelos formulários do Plano de Ação (Server Actions). Todas
 * validam os dados no servidor e conferem a permissão no projeto ou tema do
 * plano antes de gravar. A decisão sobre versões (aprovar, rejeitar, devolver) cabe ao
 * administrador ou ao gestor do projeto ou tema, em nível único (D-074, D3).
 */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { comoUsuario, type Executor } from "@/lib/banco/conexao";
import { bancoDaSessao } from "@/lib/banco/requisicao";
import { acaoPlanejamento, marcoPlanejamento, planoAcaoVersao } from "@/lib/banco/esquema";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { lerFormulario } from "@/lib/formulario";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { podeDecidirNoProjeto } from "@/modulos/acesso/capacidades";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { EdicaoNegadaError, exigirEdicaoEmAlgum } from "@/modulos/acesso/visibilidade";
import { obterCompromisso, projetosDeUmCompromisso } from "@/modulos/interacoes/consultas";
import type { EstadoFormulario } from "@/modulos/stakeholders/acoes";
import {
  arquivarEixo,
  atualizarAcaoPlanejada,
  atualizarEixo,
  atualizarIniciativaDaAcao,
  atualizarMarcoPlanejado,
  atualizarPlano,
  converterCompromissoEmAcao,
  criarEixo,
  criarNovaVersao,
  criarPlano,
  decidirVersao,
  descartarRascunho,
  enviarParaAprovacao,
  ErroDoPlano,
  incluirAcaoNaVersao,
  incluirMarco,
  incluirStakeholderNaAcao,
  obterAcao,
  obterPlano,
  obterVersao,
  planoDoProjetoTema,
  registrarAcompanhamento,
  retirarAcaoDaVersao,
  retirarMarcoDaVersao,
  retirarStakeholderDaAcao,
} from "./consultas";
import {
  esquemaAcaoPlanejada,
  esquemaAcompanhamentoAcao,
  esquemaConversaoCompromisso,
  esquemaDecisao,
  esquemaEixo,
  esquemaEnvio,
  esquemaMarco,
  esquemaNovoPlano,
  esquemaPlano,
  esquemaStakeholderAcao,
} from "./esquemas";

function identificadorOpcional(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const resultado = esquemaIdentificador.safeParse(valor);
  if (!resultado.success) throw new Error("Identificador de registro inválido.");
  return resultado.data;
}

function revalidarTelas(...caminhos: string[]) {
  for (const caminho of caminhos) revalidatePath(caminho);
  revalidatePath("/planos", "layout");
  revalidatePath("/acoes", "layout");
  revalidatePath("/riscos", "layout");
  revalidatePath("/compromissos", "layout");
  revalidatePath("/iniciativas", "layout");
  revalidatePath("/projetos-temas", "layout");
  revalidatePath("/pessoas", "layout");
  revalidatePath("/instituicoes", "layout");
  revalidatePath("/");
}

/** Executa a gravação conferindo a permissão no projeto ou tema; devolve mensagem de erro, se houver. */
async function gravarNoPlano(
  planoId: string,
  gravar: (tx: Executor, usuarioId: string) => Promise<unknown>,
): Promise<string | null> {
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const plano = await obterPlano(banco, planoId);
  if (!plano) return "Plano não encontrado.";
  if (plano.arquivadoEm) return "O plano está arquivado.";
  try {
    await exigirEdicaoEmAlgum(banco, usuario.id, [plano.projetoTemaId]);
    await comoUsuario(banco, usuario.id, (tx) => gravar(tx, usuario.id));
  } catch (erro) {
    if (erro instanceof EdicaoNegadaError || erro instanceof ErroDoPlano) return erro.message;
    return mensagemDeErro(erro);
  }
  return null;
}

async function planoDaVersao(banco: Executor, versaoId: string) {
  const versao = await obterVersao(banco, versaoId);
  return versao?.planoAcaoId ?? null;
}

async function versaoDoPlanejamento(banco: Executor, planejamentoId: string) {
  const [p] = await banco
    .select({ versaoId: acaoPlanejamento.planoAcaoVersaoId, planoId: planoAcaoVersao.planoAcaoId })
    .from(acaoPlanejamento)
    .innerJoin(planoAcaoVersao, eq(planoAcaoVersao.id, acaoPlanejamento.planoAcaoVersaoId))
    .where(eq(acaoPlanejamento.id, planejamentoId));
  return p ?? null;
}

async function versaoDoMarcoPlanejado(banco: Executor, marcoPlanejamentoId: string) {
  const [m] = await banco
    .select({ versaoId: marcoPlanejamento.planoAcaoVersaoId, planoId: planoAcaoVersao.planoAcaoId })
    .from(marcoPlanejamento)
    .innerJoin(planoAcaoVersao, eq(planoAcaoVersao.id, marcoPlanejamento.planoAcaoVersaoId))
    .where(eq(marcoPlanejamento.id, marcoPlanejamentoId));
  return m ?? null;
}

const caminhoDaVersao = (planoId: string, versaoId: string) => `/planos/${planoId}/versoes/${versaoId}`;

// --- Plano -------------------------------------------------------------------

export async function salvarPlano(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const id = identificadorOpcional(valores.id);
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  let planoId: string;
  if (id) {
    const resultado = esquemaPlano.safeParse(dados);
    if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
    const erro = await gravarNoPlano(id, (tx) => atualizarPlano(tx, id, resultado.data));
    if (erro) return { mensagem: erro, valores };
    planoId = id;
  } else {
    const resultado = esquemaNovoPlano.safeParse(dados);
    if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
    try {
      if (await planoDoProjetoTema(banco, resultado.data.projetoTemaId)) {
        return { mensagem: "Este projeto ou tema já tem um plano de ação.", valores };
      }
      await exigirEdicaoEmAlgum(banco, usuario.id, [resultado.data.projetoTemaId]);
      planoId = await comoUsuario(banco, usuario.id, (tx) => criarPlano(tx, resultado.data));
    } catch (erro) {
      if (erro instanceof EdicaoNegadaError) return { mensagem: erro.message, valores };
      return { mensagem: mensagemDeErro(erro), valores };
    }
  }
  revalidarTelas(`/planos/${planoId}`);
  redirect(`/planos/${planoId}`);
}

// --- Pilares ou eixos --------------------------------------------------------

export async function salvarEixo(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const id = identificadorOpcional(valores.id);
  const resultado = esquemaEixo.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const erro = await gravarNoPlano(resultado.data.planoAcaoId, async (tx) => {
    if (id) await atualizarEixo(tx, id, resultado.data);
    else await criarEixo(tx, resultado.data);
  });
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(`/planos/${resultado.data.planoAcaoId}`);
  return { sucesso: true };
}

export async function arquivarEixoAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const id = esquemaIdentificador.parse(formData.get("id"));
  const planoId = esquemaIdentificador.parse(formData.get("planoAcaoId"));
  const erro = await gravarNoPlano(planoId, (tx) => arquivarEixo(tx, id));
  if (erro) return { mensagem: erro };
  revalidarTelas(`/planos/${planoId}`);
  return { sucesso: true };
}

// --- Versões -----------------------------------------------------------------

export async function criarNovaVersaoAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const planoId = esquemaIdentificador.parse(formData.get("planoAcaoId"));
  let versaoId = "";
  const erro = await gravarNoPlano(planoId, async (tx) => {
    versaoId = await criarNovaVersao(tx, planoId);
  });
  if (erro) return { mensagem: erro };
  revalidarTelas(`/planos/${planoId}`);
  redirect(caminhoDaVersao(planoId, versaoId));
}

export async function descartarRascunhoAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const versaoId = esquemaIdentificador.parse(formData.get("versaoId"));
  const banco = await bancoDaSessao();
  const planoId = await planoDaVersao(banco, versaoId);
  if (!planoId) return { mensagem: "Versão não encontrada." };
  const erro = await gravarNoPlano(planoId, async (tx) => {
    if (!(await descartarRascunho(tx, versaoId))) throw new ErroDoPlano("Só uma versão em rascunho pode ser descartada.");
  });
  if (erro) return { mensagem: erro };
  revalidarTelas(`/planos/${planoId}`);
  redirect(`/planos/${planoId}`);
}

export async function enviarParaAprovacaoAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaEnvio.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const planoId = await planoDaVersao(banco, resultado.data.versaoId);
  if (!planoId) return { mensagem: "Versão não encontrada.", valores };
  const erro = await gravarNoPlano(planoId, (tx) =>
    enviarParaAprovacao(tx, resultado.data.versaoId, resultado.data.motivoAlteracao),
  );
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(caminhoDaVersao(planoId, resultado.data.versaoId));
  return { sucesso: true };
}

/** Aprova, rejeita ou devolve para ajustes. Só o administrador decide (aprovação em nível único). */
export async function decidirVersaoAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaDecisao.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const planoId = await planoDaVersao(banco, resultado.data.versaoId);
  if (!planoId) return { mensagem: "Versão não encontrada.", valores };
  const plano = await obterPlano(banco, planoId);
  if (!plano || !(await podeDecidirNoProjeto(banco, plano.projetoTemaId))) {
    return { mensagem: "Somente o administrador ou o gestor do projeto ou tema decide sobre versões do plano.", valores };
  }
  const erro = await gravarNoPlano(planoId, (tx) =>
    decidirVersao(tx, resultado.data.versaoId, resultado.data.decisao, resultado.data.parecer),
  );
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(caminhoDaVersao(planoId, resultado.data.versaoId));
  return { sucesso: true };
}

// --- Ações e marcos planejados -----------------------------------------------

export async function salvarAcaoPlanejada(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const planejamentoId = identificadorOpcional(valores.planejamentoId);
  const resultado = esquemaAcaoPlanejada.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const planoId = await planoDaVersao(banco, resultado.data.versaoId);
  if (!planoId) return { mensagem: "Versão não encontrada.", valores };
  if (planejamentoId) {
    const atual = await versaoDoPlanejamento(banco, planejamentoId);
    if (!atual || atual.versaoId !== resultado.data.versaoId) return { mensagem: "Ação não encontrada nesta versão.", valores };
  }
  const erro = await gravarNoPlano(planoId, async (tx) => {
    if (planejamentoId) await atualizarAcaoPlanejada(tx, planejamentoId, resultado.data);
    else await incluirAcaoNaVersao(tx, resultado.data);
  });
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(caminhoDaVersao(planoId, resultado.data.versaoId));
  return { sucesso: true };
}

export async function retirarAcaoDaVersaoAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const planejamentoId = esquemaIdentificador.parse(formData.get("planejamentoId"));
  const banco = await bancoDaSessao();
  const atual = await versaoDoPlanejamento(banco, planejamentoId);
  if (!atual) return { mensagem: "Ação não encontrada nesta versão." };
  const erro = await gravarNoPlano(atual.planoId, (tx) => retirarAcaoDaVersao(tx, planejamentoId));
  if (erro) return { mensagem: erro };
  revalidarTelas(caminhoDaVersao(atual.planoId, atual.versaoId));
  return { sucesso: true };
}

export async function salvarMarco(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const marcoPlanejamentoId = identificadorOpcional(valores.marcoPlanejamentoId);
  const resultado = esquemaMarco.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const planoId = await planoDaVersao(banco, resultado.data.versaoId);
  if (!planoId) return { mensagem: "Versão não encontrada.", valores };
  if (marcoPlanejamentoId) {
    const atual = await versaoDoMarcoPlanejado(banco, marcoPlanejamentoId);
    if (!atual || atual.versaoId !== resultado.data.versaoId) return { mensagem: "Marco não encontrado nesta versão.", valores };
  }
  const erro = await gravarNoPlano(planoId, async (tx) => {
    if (marcoPlanejamentoId) await atualizarMarcoPlanejado(tx, marcoPlanejamentoId, resultado.data);
    else await incluirMarco(tx, resultado.data);
  });
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(caminhoDaVersao(planoId, resultado.data.versaoId));
  return { sucesso: true };
}

export async function retirarMarcoAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const marcoPlanejamentoId = esquemaIdentificador.parse(formData.get("marcoPlanejamentoId"));
  const banco = await bancoDaSessao();
  const atual = await versaoDoMarcoPlanejado(banco, marcoPlanejamentoId);
  if (!atual) return { mensagem: "Marco não encontrado nesta versão." };
  const erro = await gravarNoPlano(atual.planoId, (tx) => retirarMarcoDaVersao(tx, marcoPlanejamentoId));
  if (erro) return { mensagem: erro };
  revalidarTelas(caminhoDaVersao(atual.planoId, atual.versaoId));
  return { sucesso: true };
}

// --- Ação: acompanhamento, iniciativa e stakeholders -------------------------

export async function registrarAcompanhamentoDaAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaAcompanhamentoAcao.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const encontrada = await obterAcao(banco, resultado.data.acaoId);
  if (!encontrada) return { mensagem: "Ação não encontrada.", valores };
  const erro = await gravarNoPlano(encontrada.planoAcaoId, (tx) => registrarAcompanhamento(tx, resultado.data));
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(`/acoes/${encontrada.id}`, `/planos/${encontrada.planoAcaoId}`);
  return { sucesso: true };
}

/** Liga a ação a uma iniciativa (ou desfaz a ligação); não altera o conteúdo planejado. */
export async function alterarIniciativaDaAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const acaoId = esquemaIdentificador.parse(formData.get("acaoId"));
  const iniciativaId = identificadorOpcional((formData.get("iniciativaId") as string | null) ?? undefined) ?? null;
  const banco = await bancoDaSessao();
  const encontrada = await obterAcao(banco, acaoId);
  if (!encontrada) return { mensagem: "Ação não encontrada." };
  const erro = await gravarNoPlano(encontrada.planoAcaoId, (tx) => atualizarIniciativaDaAcao(tx, acaoId, iniciativaId));
  if (erro) return { mensagem: erro };
  revalidarTelas(`/acoes/${acaoId}`);
  return { sucesso: true };
}

export async function incluirStakeholderNaAcaoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaStakeholderAcao.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const encontrada = await obterAcao(banco, resultado.data.acaoId);
  if (!encontrada) return { mensagem: "Ação não encontrada.", valores };
  const erro = await gravarNoPlano(encontrada.planoAcaoId, (tx) => incluirStakeholderNaAcao(tx, resultado.data));
  if (erro) return { mensagem: erro, valores };
  revalidarTelas(`/acoes/${encontrada.id}`);
  return { sucesso: true };
}

export async function retirarStakeholderDaAcaoAcao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const ligacaoId = esquemaIdentificador.parse(formData.get("id"));
  const acaoId = esquemaIdentificador.parse(formData.get("acaoId"));
  const banco = await bancoDaSessao();
  const encontrada = await obterAcao(banco, acaoId);
  if (!encontrada) return { mensagem: "Ação não encontrada." };
  const erro = await gravarNoPlano(encontrada.planoAcaoId, (tx) => retirarStakeholderDaAcao(tx, ligacaoId, acaoId));
  if (erro) return { mensagem: erro };
  revalidarTelas(`/acoes/${acaoId}`);
  return { sucesso: true };
}

// --- Integração: compromisso → ação ------------------------------------------

/** Converte o compromisso em ação do plano (na versão em rascunho), preservando a origem. */
export async function converterCompromissoAcao(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { valores, dados } = lerFormulario(formData);
  const resultado = esquemaConversaoCompromisso.safeParse(dados);
  if (!resultado.success) return { erros: z.flattenError(resultado.error).fieldErrors, valores };
  const banco = await bancoDaSessao();
  const usuario = await obterUsuarioAtual(banco);
  const origem = await obterCompromisso(banco, resultado.data.compromissoId);
  if (!origem) return { mensagem: "Compromisso não encontrado.", valores };
  if (origem.arquivadoEm) return { mensagem: "Reative o compromisso antes de convertê-lo.", valores };
  const conversao: { versaoId?: string } = {};
  try {
    await exigirEdicaoEmAlgum(banco, usuario.id, await projetosDeUmCompromisso(banco, origem.id));
  } catch (erro) {
    if (erro instanceof EdicaoNegadaError) return { mensagem: erro.message, valores };
    throw erro;
  }
  const erro = await gravarNoPlano(resultado.data.planoAcaoId, async (tx) => {
    const { versaoId } = await converterCompromissoEmAcao(tx, origem.id, resultado.data.planoAcaoId, resultado.data.eixoId);
    conversao.versaoId = versaoId;
  });
  if (erro || !conversao.versaoId) return { mensagem: erro ?? "Não foi possível converter o compromisso.", valores };
  revalidarTelas(`/compromissos/${origem.id}`);
  redirect(caminhoDaVersao(resultado.data.planoAcaoId, conversao.versaoId));
}
