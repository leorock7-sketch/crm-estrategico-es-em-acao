/**
 * Banco restaurado de uma cópia de segurança (C7, D-082), num PostgreSQL temporário e isolado criado
 * por npm run backup:ensaiar. Confere que a cópia recompõe dados, estrutura, regras de acesso e as
 * credenciais do login. Primeira etapa: roda antes de qualquer gravação (as regras de acesso rodam
 * depois, em regras.test.ts).
 * Só roda pelo comando do ensaio (as variáveis de ambiente apontam para o banco temporário).
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBancoPostgres, type Banco, fecharBanco } from "@/lib/banco/conexao";
import { projetoTema } from "@/lib/banco/esquema";
import { comIdentidade } from "@/lib/banco/identidade";
import { lerContasDeTeste } from "../../scripts/contas-teste";
import type { Contagens } from "../../scripts/backup/comum";
import { CONSULTA_PROTECOES } from "../../scripts/monitor/nucleo.mjs";

const contagens = JSON.parse(readFileSync(process.env.CRM_RESTAURACAO_CONTAGENS as string, "utf8")) as Contagens;
let administrativo: Banco;
let aplicacao: Banco;

beforeAll(() => {
  administrativo = abrirBancoPostgres(process.env.CRM_RESTAURACAO_ADMIN_URL as string, { max: 2, ssl: false });
  aplicacao = abrirBancoPostgres(process.env.CRM_RESTAURACAO_APP_URL as string, { max: 3, ssl: false });
});

afterAll(async () => {
  await fecharBanco(administrativo);
  await fecharBanco(aplicacao);
});

const um = async <T>(banco: Banco, consulta: ReturnType<typeof sql>) => (await banco.execute(consulta)).rows[0] as T;

describe("Cópia restaurada: dados, estrutura e regras (antes de qualquer teste gravar)", () => {
  test("cada tabela tem exatamente o número de registros do momento da cópia", async () => {
    const restauradas: Record<string, number> = {};
    for (const tabela of Object.keys(contagens.tabelas)) {
      restauradas[tabela] = (await um<{ n: number }>(administrativo, sql.raw(`select count(*)::int as n from public."${tabela}"`))).n;
    }
    expect(restauradas).toEqual(contagens.tabelas);
    expect(Object.keys(restauradas).length).toBeGreaterThanOrEqual(44);
  });

  test("migrações, regras forçadas, políticas e gatilhos: mesmas quantidades; proteções do monitor completas", async () => {
    const e = await um<Record<string, number>>(
      administrativo,
      sql`select (select count(*)::int from drizzle.__drizzle_migrations) as migracoes,
        (select count(*)::int from pg_policies where schemaname = 'public') as politicas,
        (select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal) as gatilhos,
        (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relforcerowsecurity) as forcadas`,
    );
    expect(e).toEqual({ migracoes: contagens.migracoes, politicas: contagens.politicas, gatilhos: contagens.gatilhos, forcadas: contagens.tabelasComRegrasForcadas });
    expect((await um<{ tabelas_sem_protecao: number }>(administrativo, sql.raw(CONSULTA_PROTECOES))).tabelas_sem_protecao).toBe(0);
  });

  test("as contas fictícias veem, pelo papel crm_app, exatamente os mesmos projetos de antes", async () => {
    const [papel] = (await comIdentidade(aplicacao, null).execute(sql`select current_user as papel`)).rows as { papel: string }[];
    expect(papel.papel).toBe("crm_app");
    const agora: Record<string, string[]> = {};
    for (const [chave, usuarioId] of Object.entries(lerContasDeTeste().contas).map(([c, conta]) => [c, conta.usuarioId] as const)) {
      if (!usuarioId) continue;
      agora[chave] = (await comIdentidade(aplicacao, usuarioId).select({ id: projetoTema.id }).from(projetoTema)).map((l) => l.id).sort();
    }
    expect(agora).toEqual(contagens.visibilidade);
    expect(agora.leitor?.length).toBeGreaterThan(0);
    expect(agora.semPermissao).toEqual([]);
  });

  test("credenciais do login restauradas: senhas das contas fictícias conferem no hash, e os vínculos com o login são os mesmos", async () => {
    expect((await um<{ n: number }>(administrativo, sql`select count(*)::int as n from auth.users`)).n).toBe(contagens.usuariosAuth);
    const vinculos = await um<{ ligados: number; sem_conta: number }>(
      administrativo,
      sql`select (select count(*)::int from usuario u where u.auth_id is not null and exists (select 1 from auth.users a where a.id = u.auth_id)) as ligados,
        (select count(*)::int from usuario u where u.auth_id is not null and not exists (select 1 from auth.users a where a.id = u.auth_id)) as sem_conta`,
    );
    // Na origem de desenvolvimento há usuários fictícios de testes antigos cuja conta do login já não
    // existe: a cópia deve reproduzir exatamente a mesma situação, nem mais nem menos.
    expect({ ligados: vinculos.ligados, semConta: vinculos.sem_conta }).toEqual(contagens.vinculosLogin);
    expect(vinculos.ligados).toBeGreaterThanOrEqual(10);
    const { contas } = lerContasDeTeste();
    const conferidas: string[] = [];
    for (const [chave, conta] of Object.entries(contas)) {
      if (!conta.authId || !conta.senha) continue;
      const r = await um<{ confere: boolean; errada: boolean }>(
        administrativo,
        sql`select encrypted_password = extensoes.crypt(${conta.senha}, encrypted_password) as confere,
          encrypted_password = extensoes.crypt(${`${conta.senha}-errada`}, encrypted_password) as errada
          from auth.users where id = ${conta.authId}::uuid`,
      );
      expect(r, chave).toEqual({ confere: true, errada: false });
      conferidas.push(chave);
    }
    expect(conferidas.length).toBeGreaterThanOrEqual(4);
  });
});
