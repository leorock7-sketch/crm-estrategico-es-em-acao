/**
 * Monitoramento e reforço da auditoria no PostgreSQL do Supabase (D-082), com o login real do papel
 * crm_monitor. Nenhuma operação destrutiva: a recusa de esvaziar tabelas é comprovada só no PGlite.
 * Antes: npm run monitor:preparar (ativa o login do monitor no projeto de desenvolvimento).
 */
import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBancoPostgres, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { registroAuditoria } from "@/lib/banco/esquema";
import { comIdentidade } from "@/lib/banco/identidade";
import { criarPessoa } from "@/modulos/stakeholders/consultas";
import { lerContasDeTeste } from "../../scripts/contas-teste";
import { CONSULTA_PROTECOES, executarVerificacoes } from "../../scripts/monitor/nucleo.mjs";

const URL_MONITOR = process.env.CRM_MONITOR_URL as string;
let administrativo: Banco;
let aplicacao: Banco;
let monitor: postgres.Sql;

beforeAll(() => {
  if (!URL_MONITOR) throw new Error("Rode npm run monitor:preparar antes destes testes.");
  administrativo = abrirBancoPostgres(process.env.CRM_BANCO_ADMIN_URL as string, { max: 2 });
  aplicacao = abrirBancoPostgres(process.env.CRM_BANCO_URL as string, { max: 2 });
  monitor = postgres(URL_MONITOR, { max: 1, prepare: false, onnotice: () => {} });
});

afterAll(async () => {
  await monitor?.end({ timeout: 2 });
  await fecharBanco(administrativo);
  await fecharBanco(aplicacao);
});

async function codigoDaFalha(operacao: Promise<unknown>): Promise<string> {
  try {
    await operacao;
    return "sem falha";
  } catch (erro) {
    return (erro as { code?: string }).code ?? "erro desconhecido";
  }
}

describe("Monitor no Supabase, com o login real do crm_monitor", () => {
  test("as verificações do monitor respondem: banco, proteções, consumo e login", async () => {
    const linhas = await executarVerificacoes({
      postgres,
      env: {
        CRM_MONITOR_URL: URL_MONITOR,
        CRM_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        CRM_SUPABASE_CHAVE_PUBLICA: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    expect(linhas.map((l) => [l.verificacao, l.resultado])).toEqual([
      ["banco", "ok"],
      ["protecoes", "ok"],
      ["consumo-banco", "ok"],
      ["autenticacao", "ok"],
      ["aplicacao", "ignorada"],
    ]);
    const consumo = linhas.find((l) => l.verificacao === "consumo-banco");
    expect(consumo?.percentual_do_limite).toBeGreaterThan(0);
    expect(consumo?.percentual_do_limite).toBeLessThan(70);
  });

  test("conecta como crm_monitor, sem superusuário nem BYPASSRLS, e não troca de papel", async () => {
    const [linha] = await monitor`select current_user as papel, session_user as sessao,
      (select rolsuper from pg_roles where rolname = current_user) as superusuario,
      (select rolbypassrls from pg_roles where rolname = current_user) as ignora_regras`;
    expect(linha).toEqual({ papel: "crm_monitor", sessao: "crm_monitor", superusuario: false, ignora_regras: false });
    expect(await codigoDaFalha(monitor.begin((tx) => tx`set local role crm_app`))).toBe("42501");
    expect(await codigoDaFalha(monitor.begin((tx) => tx`set local role postgres`))).toBe("42501");
  });

  test("não lê nenhuma tabela de negócio, não executa funções do CRM e não grava", async () => {
    const tabelas = ((await administrativo.execute(sql`select tablename from pg_tables where schemaname = 'public' order by 1`)).rows as { tablename: string }[]).map((t) => t.tablename);
    expect(tabelas.length).toBeGreaterThanOrEqual(44);
    const lidas: string[] = [];
    for (const tabela of tabelas) {
      const codigo = await codigoDaFalha(monitor.unsafe(`select 1 from "${tabela}" limit 1`));
      if (codigo !== "42501") lidas.push(`${tabela}: ${codigo}`);
    }
    expect(lidas).toEqual([]);
    expect(await codigoDaFalha(monitor`select sessao_ativa()`)).toBe("42501");
    expect(await codigoDaFalha(monitor`select set_config('app.usuario_id', ${randomUUID()}, false), (select count(*) from usuario)`)).toBe("42501");
    expect(await codigoDaFalha(monitor`create table monitor_teste (id int)`)).toBe("42501");
  });

  test("as proteções estão ativas em todas as tabelas, vistas pelo catálogo", async () => {
    const [linha] = await monitor.unsafe(CONSULTA_PROTECOES);
    expect(linha.tabelas_sem_protecao).toBe(0);
  });
});

describe("Auditoria reforçada (C6) no Supabase", () => {
  test("a operação feita pela aplicação fica registrada com o papel crm_app", async () => {
    const { contas } = lerContasDeTeste();
    const administrador = contas.administrador.usuarioId as string;
    const id = await comoUsuario(comIdentidade(aplicacao, administrador), administrador, (tx) =>
      criarPessoa(tx, { nomeCompleto: `Pessoa fictícia do monitor ${randomUUID().slice(0, 8)}` }, { incluirObservacoes: false }),
    );
    const [registro] = await administrativo
      .select({ papel: registroAuditoria.papelBanco, usuario: registroAuditoria.usuarioId })
      .from(registroAuditoria)
      .where(eq(registroAuditoria.registroId, id))
      .orderBy(desc(registroAuditoria.id))
      .limit(1);
    expect(registro).toEqual({ papel: "crm_app", usuario: administrador });
  });

  test("todas as tabelas têm o bloqueio de esvaziamento, conferido sem tentar esvaziar", async () => {
    const sem = (
      await administrativo.execute(sql`
        select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not exists (
          select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
          where t.tgrelid = c.oid and t.tgenabled <> 'D' and p.proname = 'impedir_esvaziamento')`)
    ).rows;
    expect(sem).toEqual([]);
  });
});
