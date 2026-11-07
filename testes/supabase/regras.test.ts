/**
 * As mesmas regras comprovadas no PGlite (testes/apoio/regras-acesso.ts), agora no PostgreSQL do
 * Supabase: a aplicação conecta com o papel crm_app, pela mesma conexão que usa de verdade, e a
 * conexão administrativa serve só para montar o cenário e conferir o resultado.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBancoPostgres, type Banco, fecharBanco } from "@/lib/banco/conexao";
import { comIdentidade } from "@/lib/banco/identidade";
import { regrasDeAcesso } from "../apoio/regras-acesso";

let administrativo: Banco;
let aplicacao: Banco;

beforeAll(async () => {
  administrativo = abrirBancoPostgres(process.env.CRM_BANCO_ADMIN_URL as string, { max: 3 });
  aplicacao = abrirBancoPostgres(process.env.CRM_BANCO_URL as string, { max: 5 });
});

afterAll(async () => {
  await fecharBanco(administrativo);
  await fecharBanco(aplicacao);
});

describe("Conexão da aplicação no Supabase", () => {
  test("loga diretamente como crm_app, com as características exigidas", async () => {
    const [linha] = (
      await comIdentidade(aplicacao, null).execute(
        sql`select current_user as papel, session_user as sessao,
          (select rolsuper from pg_roles where rolname = current_user) as superusuario,
          (select rolbypassrls from pg_roles where rolname = current_user) as ignora_regras`,
      )
    ).rows as Record<string, unknown>[];
    expect(linha).toEqual({ papel: "crm_app", sessao: "crm_app", superusuario: false, ignora_regras: false });
  });

  test("sem transação com identidade, a conexão crua da aplicação também não vê nada", async () => {
    const linhas = (await aplicacao.execute(sql`select count(*)::int as n from pessoa`)).rows as { n: number }[];
    expect(linhas[0].n).toBe(0);
  });

  test("a identidade de uma transação não vaza para a seguinte, na mesma conexão", async () => {
    const umaConexao = abrirBancoPostgres(process.env.CRM_BANCO_URL as string, { max: 1 });
    try {
      const [admin] = (await administrativo.execute(sql`select id from usuario where administrador and situacao = 'ativo' limit 1`)).rows as { id: string }[];
      const comAdmin = (await comIdentidade(umaConexao, admin.id).execute(sql`select count(*)::int as n from usuario`)).rows as { n: number }[];
      expect(comAdmin[0].n).toBeGreaterThan(0);
      const depois = (await umaConexao.execute(sql`select count(*)::int as n from usuario`)).rows as { n: number }[];
      expect(depois[0].n).toBe(0);
      const [config] = (await umaConexao.execute(sql`select nullif(current_setting('app.usuario_id', true), '') as id`)).rows as { id: string | null }[];
      expect(config.id).toBeNull();
    } finally {
      await fecharBanco(umaConexao);
    }
  });
});

regrasDeAcesso(() => ({ administrativo, aplicacao }));
