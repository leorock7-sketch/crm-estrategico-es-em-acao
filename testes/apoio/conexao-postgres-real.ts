/**
 * Portabilidade em PostgreSQL real (C8; D-075). Nesta configuração (vitest.postgres.config.mts),
 * os testes das Etapas 1 a 4 rodam sem nenhuma alteração, mas abrirBanco() devolve o PostgreSQL
 * do projeto de desenvolvimento em vez do PGlite. Antes de cada arquivo de testes, o esquema é
 * refeito do zero e todas as migrações são aplicadas de novo.
 *
 * ATENÇÃO: apaga os dados do projeto. Só roda com a autorização explícita da configuração e
 * nunca deve apontar para outro banco. Depois, refaça a carga com npm run supabase:preparar -- --refazer.
 */
import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  abrirBanco as abrirBancoLocal,
  abrirBancoPostgres,
  type Banco,
  type OpcoesAbertura,
} from "../../src/lib/banco/conexao";
import { alinharValoresNormalizados } from "../../src/lib/banco/normalizacao";

export * from "../../src/lib/banco/conexao";

const PASTA_MIGRACOES = path.join(process.cwd(), "src", "lib", "banco", "migracoes");

export async function abrirBanco(diretorio?: string, opcoes: OpcoesAbertura = {}): Promise<Banco> {
  // Testes de atualização de pasta local continuam no PGlite: tratam do arquivo em disco.
  if (diretorio) return abrirBancoLocal(diretorio, opcoes);
  if (process.env.CRM_TESTE_POSTGRES_REINICIAR !== "sim") throw new Error("Reinício do banco de testes não autorizado.");
  const banco = abrirBancoPostgres(process.env.CRM_BANCO_ADMIN_URL as string, { max: 3 });
  await banco.execute(sql`drop schema if exists drizzle cascade`);
  await banco.execute(sql`drop schema if exists public cascade`);
  await banco.execute(sql`create schema public`);
  await migrate(banco as never, { migrationsFolder: PASTA_MIGRACOES });
  await alinharValoresNormalizados(banco);
  return banco;
}
