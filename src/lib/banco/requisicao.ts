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
  return bancoDaSessao();
}

/**
 * Banco com a identidade do usuário: toda operação passa pelas regras de acesso do banco como
 * esse usuário (identidade.ts). Em Server Actions, a sessão é conferida de novo a cada chamada.
 * Sem sessão válida, leva ao login; não há como obter um banco sem identidade por aqui.
 */
export async function bancoDaSessao(): Promise<Banco> {
  const base = await obterBancoBase();
  if (modoDeAcesso() === "local") {
    await prepararBancoLocal(base);
    return comIdentidade(base, USUARIO_DESENVOLVIMENTO.id);
  }
  const { usuarioDaSessao } = await import("@/lib/autenticacao/sessao");
  const usuario = await usuarioDaSessao();
  return comIdentidade(base, usuario.id);
}
