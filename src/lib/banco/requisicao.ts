import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { prepararBancoLocal, USUARIO_DESENVOLVIMENTO } from "@/modulos/acesso/usuario-atual";
import { modoDeAcesso } from "./ambiente";
import { type Banco, obterBancoBase } from "./conexao";
import { comIdentidade } from "./identidade";

/**
 * Banco para as telas. A chamada a connection() faz o Next.js ler os dados a cada acesso, e
 * não uma única vez durante a compilação.
 */
export async function bancoDaRequisicao(): Promise<Banco> {
  await connection();
  // Páginas: o proxy já restringe a navegação à troca de senha quando ela é obrigatória (P-056).
  return bancoComIdentidade({ permitirTrocaPendente: true });
}

/**
 * Verificação de funcionamento (rota /saude, monitoramento da D-082): uma consulta que não lê tabela
 * alguma, pela conexão comum da aplicação e SEM identidade, em que as regras de acesso negam qualquer
 * dado. Não devolve nada além de "responde" ou "não responde".
 */
export async function bancoResponde(): Promise<boolean> {
  await connection();
  try {
    await comIdentidade(await obterBancoBase(), null).execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Banco com a identidade do usuário: toda operação passa pelas regras de acesso do banco como
 * esse usuário (identidade.ts). Em Server Actions, a sessão é conferida de novo a cada chamada.
 * Sem sessão válida, leva ao login; não há como obter um banco sem identidade por aqui.
 */
export async function bancoDaSessao(): Promise<Banco> {
  return bancoComIdentidade({ permitirTrocaPendente: false });
}

async function bancoComIdentidade(opcoes: { permitirTrocaPendente: boolean }): Promise<Banco> {
  const base = await obterBancoBase();
  if (modoDeAcesso() === "local") {
    await prepararBancoLocal(base);
    return comIdentidade(base, USUARIO_DESENVOLVIMENTO.id);
  }
  const { usuarioDaSessao } = await import("@/lib/autenticacao/sessao");
  const usuario = await usuarioDaSessao(opcoes);
  return comIdentidade(base, usuario.id);
}
