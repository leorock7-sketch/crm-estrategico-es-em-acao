import { connection } from "next/server";
import { obterBanco } from "./conexao";

/**
 * Banco para uso nas telas. A chamada a connection() faz o Next.js ler os
 * dados a cada acesso, e não uma única vez durante a compilação.
 */
export async function bancoDaRequisicao() {
  await connection();
  return obterBanco();
}
