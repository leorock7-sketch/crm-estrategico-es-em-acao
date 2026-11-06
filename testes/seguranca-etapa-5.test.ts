// @vitest-environment node
/**
 * Autenticação e segurança da Etapa 5 (D-074, D-075), no PGlite: roda a cada Pull Request.
 * As mesmas regras rodam no PostgreSQL do Supabase em seguranca-supabase.test.ts; login real,
 * sessão e chamadas diretas ao servidor, em navegador-supabase.test.ts.
 */
import { afterAll, beforeAll } from "vitest";
import { abrirBanco, type Banco, fecharBanco } from "@/lib/banco/conexao";
import { regrasDeAcesso } from "./apoio/regras-acesso";

let banco: Banco;

beforeAll(async () => {
  banco = await abrirBanco();
});

afterAll(async () => {
  await fecharBanco(banco);
});

regrasDeAcesso(() => ({ administrativo: banco, aplicacao: banco }));
