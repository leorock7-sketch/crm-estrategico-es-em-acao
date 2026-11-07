/**
 * O que o usuário da sessão pode fazer, segundo as próprias regras do banco (migração 0009).
 * Serve para as telas mostrarem só o que cabe ao perfil e para mensagens claras: quem garante a
 * regra é o banco. Sem identidade, as funções respondem "não".
 */
import { type SQL, sql } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";

async function consultar(banco: Executor, expressao: SQL): Promise<boolean> {
  const resultado = await banco.execute(sql`select ${expressao} as pode`);
  return (resultado.rows[0] as { pode?: boolean } | undefined)?.pode === true;
}

export const MENSAGEM_SOMENTE_CONSULTA = "Seu perfil permite apenas consulta. Peça acesso ao administrador do sistema.";

export function ehAdministrador(banco: Executor) {
  return consultar(banco, sql`sessao_e_administrador()`);
}

/** Registrar no Cadastro Mestre compartilhado: administrador, ou gestor ou colaborador em algum contexto. */
export function podeRegistrarNoCadastro(banco: Executor) {
  return consultar(banco, sql`pode_editar_algum()`);
}

/** Incluir em algum projeto ou tema: administrador, ou gestor ou colaborador em algum contexto. */
export function podeEditarAlgum(banco: Executor) {
  return consultar(banco, sql`pode_editar_algum()`);
}

/** Contatos pessoais e observações (P-054, provisória). */
export function podeVerDadosRestritos(banco: Executor, stakeholderId: string) {
  return consultar(banco, sql`pode_ver_dados_restritos(${stakeholderId}::uuid)`);
}

export function podeEditarNoProjeto(banco: Executor, projetoTemaId: string) {
  return consultar(banco, sql`pode_editar_projeto(${projetoTemaId}::uuid)`);
}

/** Decidir sobre versões do plano: administrador ou gestor do projeto ou tema (D-074, D3). */
export function podeDecidirNoProjeto(banco: Executor, projetoTemaId: string) {
  return consultar(banco, sql`pode_decidir_projeto(${projetoTemaId}::uuid)`);
}

/** Alterar um registro, conforme os projetos ou temas a que ele está ligado. */
const EDICAO_POR_REGISTRO = {
  iniciativa: (id: string) => sql`pode_editar_iniciativa(${id}::uuid)`,
  interacao: (id: string) => sql`pode_editar_interacao(${id}::uuid)`,
  compromisso: (id: string) => sql`pode_editar_compromisso_id(${id}::uuid)`,
  plano: (id: string) => sql`pode_editar_projeto(projeto_do_plano(${id}::uuid))`,
  acao: (id: string) => sql`pode_editar_projeto(projeto_da_acao(${id}::uuid))`,
  risco: (id: string) => sql`pode_editar_projeto(projeto_do_risco(${id}::uuid))`,
} as const;

export function podeEditarRegistro(banco: Executor, tipo: keyof typeof EDICAO_POR_REGISTRO, id: string) {
  return consultar(banco, EDICAO_POR_REGISTRO[tipo](id));
}
