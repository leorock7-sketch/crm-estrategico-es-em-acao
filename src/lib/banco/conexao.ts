/**
 * Conexão com o banco de dados de desenvolvimento (PGlite — decisão D-018).
 *
 * O PGlite é um PostgreSQL completo executado dentro da própria aplicação; os
 * dados ficam na pasta .dados/pglite (ignorada pelo Git). Ao abrir o banco, os
 * scripts de ./migracoes ainda não aplicados são executados automaticamente.
 *
 * Uso exclusivo em desenvolvimento e testes, com dados fictícios. Na etapa de
 * hospedagem, esta conexão será substituída pela do Supabase, reaproveitando
 * os mesmos scripts de criação.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as esquema from "./esquema";

function criarBanco(cliente: PGlite) {
  return drizzle(cliente, { schema: esquema });
}

export type Banco = ReturnType<typeof criarBanco>;
export type Transacao = Parameters<Parameters<Banco["transaction"]>[0]>[0];
/** Banco ou transação: as consultas funcionam com qualquer um dos dois. */
export type Executor = Banco | Transacao;

const PASTA_MIGRACOES = path.join(process.cwd(), "src", "lib", "banco", "migracoes");

/** Pasta dos dados locais (caminho fixo, para que o Next.js não inclua o projeto inteiro na compilação). */
export function diretorioDoBanco(): string {
  return path.join(process.cwd(), ".dados", "pglite");
}

/**
 * Abre um banco e aplica os scripts pendentes. Sem diretório, o banco fica
 * apenas na memória (usado nos testes automatizados).
 */
export async function abrirBanco(diretorio?: string): Promise<Banco> {
  if (diretorio) mkdirSync(diretorio, { recursive: true });
  const cliente = diretorio ? new PGlite(diretorio) : new PGlite();
  const banco = criarBanco(cliente);
  await migrate(banco, { migrationsFolder: PASTA_MIGRACOES });
  return banco;
}

const global = globalThis as typeof globalThis & { __bancoCrm?: Promise<Banco> };

/** Banco compartilhado pela aplicação (uma única conexão por processo). */
export function obterBanco(): Promise<Banco> {
  global.__bancoCrm ??= abrirBanco(diretorioDoBanco());
  return global.__bancoCrm;
}

/**
 * Executa operações em uma transação, registrando o usuário responsável. Os
 * gatilhos do banco usam essa informação na trilha de auditoria.
 */
export async function comoUsuario<T>(
  banco: Banco,
  usuarioId: string,
  operacao: (tx: Transacao) => Promise<T>,
): Promise<T> {
  return banco.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.usuario_id', ${usuarioId}, true)`);
    return operacao(tx);
  });
}
