// @vitest-environment node
/**
 * Etapa 7, Fase 7A (D-082), no PGlite: reforço da auditoria (C6), papel crm_monitor com privilégios
 * mínimos e núcleo do monitoramento. As mesmas verificações de papel e de proteções rodam no Supabase
 * em supabase/monitor.test.ts, sem nenhuma operação destrutiva.
 *
 * A tentativa de esvaziar tabelas (recusada) roda só aqui, no banco em memória do teste.
 */
import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { erroDoBanco } from "@/lib/banco/erros";
import { pessoa, registroAuditoria } from "@/lib/banco/esquema";
import { comIdentidade } from "@/lib/banco/identidade";
import { prepararBancoLocal, USUARIO_DESENVOLVIMENTO } from "@/modulos/acesso/usuario-atual";
import { criarPessoa } from "@/modulos/stakeholders/consultas";
import { selecionarParaManter } from "../scripts/backup/retencao";
import { avaliarAutomacao } from "../scripts/monitor/conferir-automacao.mjs";
import {
  avaliarConsumo,
  categorizarErro,
  CONSULTA_PROTECOES,
  executarVerificacoes,
  houveProblema,
  LIMITE_BANCO_BYTES,
  resumoMarkdown,
} from "../scripts/monitor/nucleo.mjs";

let banco: Banco;

beforeAll(async () => {
  banco = await abrirBanco();
  await prepararBancoLocal(banco);
});

afterAll(async () => {
  await fecharBanco(banco);
});

async function codigoDaFalha(operacao: Promise<unknown>): Promise<string> {
  try {
    await operacao;
    return "sem falha";
  } catch (erro) {
    return erroDoBanco(erro)?.code ?? "erro desconhecido";
  }
}

/** Executa como o papel crm_monitor, numa transação desfeita ao final. */
async function comoMonitor<T>(operacao: (tx: Parameters<Parameters<Banco["transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  return banco.transaction(async (tx) => {
    await tx.execute(sql`set local role crm_monitor`);
    return operacao(tx);
  });
}

const sobProtecao = async () =>
  ((await banco.execute(sql.raw(CONSULTA_PROTECOES))).rows[0] as { tabelas_sem_protecao: number }).tabelas_sem_protecao;

describe("C6 — reforço da auditoria", () => {
  test("toda tabela tem regras forçadas, gatilho de auditoria e bloqueio de esvaziamento (falha se surgir tabela sem eles)", async () => {
    const tabelas = (await banco.execute(sql`select count(*)::int as n from pg_tables where schemaname = 'public'`)).rows[0] as { n: number };
    expect(tabelas.n).toBeGreaterThanOrEqual(44);
    expect(await sobProtecao()).toBe(0);
  });

  test("esvaziar tabelas é recusado, inclusive pelo dono do banco, e nenhum registro se perde", async () => {
    const antes = (await banco.execute(sql`select (select count(*) from comite)::int as comites, (select count(*) from registro_auditoria)::int as auditoria`)).rows[0];
    expect(await codigoDaFalha(banco.execute(sql.raw("truncate table comite cascade")))).toBe("P0001");
    expect(await codigoDaFalha(banco.execute(sql.raw("truncate registro_auditoria")))).toBe("P0001");
    const depois = (await banco.execute(sql`select (select count(*) from comite)::int as comites, (select count(*) from registro_auditoria)::int as auditoria`)).rows[0];
    expect(depois).toEqual(antes);
  });

  test("a auditoria registra o papel do banco: crm_app na aplicação, o papel administrativo nas rotinas privilegiadas", async () => {
    const naAplicacao = await comoUsuario(comIdentidade(banco, USUARIO_DESENVOLVIMENTO.id), USUARIO_DESENVOLVIMENTO.id, (tx) =>
      criarPessoa(tx, { nomeCompleto: `Pessoa fictícia C6 aplicação ${randomUUID().slice(0, 8)}` }, { incluirObservacoes: false }),
    );
    const naRotina = await comoUsuario(banco, USUARIO_DESENVOLVIMENTO.id, (tx) =>
      criarPessoa(tx, { nomeCompleto: `Pessoa fictícia C6 rotina ${randomUUID().slice(0, 8)}` }),
    );
    const papel = async (id: string) =>
      (
        await banco
          .select({ papel: registroAuditoria.papelBanco, usuario: registroAuditoria.usuarioId })
          .from(registroAuditoria)
          .where(eq(registroAuditoria.registroId, id))
          .orderBy(desc(registroAuditoria.id))
          .limit(1)
      )[0];
    expect(await papel(naAplicacao)).toEqual({ papel: "crm_app", usuario: USUARIO_DESENVOLVIMENTO.id });
    const rotina = await papel(naRotina);
    expect(rotina.usuario).toBe(USUARIO_DESENVOLVIMENTO.id);
    expect(rotina.papel).not.toBe("crm_app");
    expect(rotina.papel).toBeTruthy();
    expect((await banco.select({ id: pessoa.id }).from(pessoa).where(eq(pessoa.id, naAplicacao))).length).toBe(1);
  });

  test("um gatilho de proteção desativado é detectado pela verificação do monitor", async () => {
    let detectadas = -1;
    await banco
      .transaction(async (tx) => {
        await tx.execute(sql`alter table comite disable trigger comite_auditoria`);
        detectadas = ((await tx.execute(sql.raw(CONSULTA_PROTECOES))).rows[0] as { tabelas_sem_protecao: number }).tabelas_sem_protecao;
        throw new Error("desfazer");
      })
      .catch(() => undefined);
    expect(detectadas).toBe(1);
    expect(await sobProtecao()).toBe(0);
  });
});

describe("Papel crm_monitor — privilégios mínimos", () => {
  test("não é superusuário, não contorna as regras, não herda papéis e nasce sem login", async () => {
    const [papel] = (
      await banco.execute(sql`select rolsuper, rolbypassrls, rolinherit, rolcanlogin, rolcreaterole, rolcreatedb, rolconnlimit from pg_roles where rolname = 'crm_monitor'`)
    ).rows;
    expect(papel).toEqual({ rolsuper: false, rolbypassrls: false, rolinherit: false, rolcanlogin: false, rolcreaterole: false, rolcreatedb: false, rolconnlimit: 2 });
  });

  test("não recebeu nenhum privilégio em tabelas, colunas ou funções", async () => {
    const concessoes = (
      await banco.execute(sql`
        select 'tabela' as tipo, table_name as objeto from information_schema.role_table_grants where grantee = 'crm_monitor'
        union all select 'coluna', table_name from information_schema.column_privileges where grantee = 'crm_monitor'
        union all select 'funcao', routine_name from information_schema.role_routine_grants where grantee = 'crm_monitor'`)
    ).rows;
    expect(concessoes).toEqual([]);
  });

  test("responde a select 1 e ao catálogo, mas não lê nenhuma tabela de negócio", async () => {
    const tabelas = ((await banco.execute(sql`select tablename from pg_tables where schemaname = 'public' order by 1`)).rows as { tablename: string }[]).map((t) => t.tablename);
    const resposta = await comoMonitor(async (tx) => (await tx.execute(sql`select 1 as resposta, current_user as papel`)).rows[0]);
    expect(resposta).toEqual({ resposta: 1, papel: "crm_monitor" });
    expect(await comoMonitor(async (tx) => ((await tx.execute(sql.raw(CONSULTA_PROTECOES))).rows[0] as { tabelas_sem_protecao: number }).tabelas_sem_protecao)).toBe(0);
    const lidas: string[] = [];
    for (const tabela of tabelas) {
      const codigo = await codigoDaFalha(comoMonitor((tx) => tx.execute(sql.raw(`select 1 from public."${tabela}" limit 1`))));
      if (codigo !== "42501") lidas.push(`${tabela}: ${codigo}`);
    }
    expect(lidas).toEqual([]);
  });

  test("não executa as funções do CRM nem se passa por outro usuário ou papel", async () => {
    expect(await codigoDaFalha(comoMonitor((tx) => tx.execute(sql`select sessao_ativa()`)))).toBe("42501");
    expect(await codigoDaFalha(comoMonitor((tx) => tx.execute(sql`select pode_ver_projeto(gen_random_uuid())`)))).toBe("42501");
    expect(
      await codigoDaFalha(
        comoMonitor(async (tx) => {
          await tx.execute(sql`select set_config('app.usuario_id', ${USUARIO_DESENVOLVIMENTO.id}, true)`);
          return tx.execute(sql`select count(*) from usuario`);
        }),
      ),
    ).toBe("42501");
    // A recusa de SET ROLE depende do papel de login; aqui a conexão é administrativa. Comprovada no
    // Supabase, com o login real do monitor (supabase/monitor.test.ts).
    expect(await codigoDaFalha(comoMonitor((tx) => tx.execute(sql`create table monitor_teste (id int)`)))).toBe("42501");
    expect(await codigoDaFalha(comoMonitor((tx) => tx.execute(sql`insert into registro_auditoria (tabela, registro_id, operacao) values ('x', gen_random_uuid(), 'inclusao')`)))).toBe("42501");
  });
});

describe("Núcleo do monitoramento", () => {
  const SEGREDO = "postgresql://crm_monitor.ref:senha-secreta-123@host-interno.exemplo:6543/postgres";

  function postgresFalso(respostas: { identidade?: object; protecoes?: number; bytes?: number; erro?: Error } = {}) {
    return () =>
      Object.assign(
        async (partes: TemplateStringsArray) => {
          if (respostas.erro) throw respostas.erro;
          const texto = partes.join("?");
          if (texto.includes("current_user")) return [respostas.identidade ?? { papel: "crm_monitor", privilegiado: false, resposta: 1 }];
          if (texto.includes("pg_database_size")) return [{ bytes: respostas.bytes ?? 1024 * 1024 }];
          return [];
        },
        { unsafe: async () => [{ tabelas_sem_protecao: respostas.protecoes ?? 0 }], end: async () => undefined },
      );
  }

  test("registra só data, verificação, resultado, duração, categoria e, no consumo, o percentual", async () => {
    const linhas = await executarVerificacoes({ postgres: postgresFalso(), env: { CRM_MONITOR_URL: SEGREDO } });
    expect(linhas.map((l) => [l.verificacao, l.resultado, l.categoria])).toEqual([
      ["banco", "ok", null],
      ["protecoes", "ok", null],
      ["consumo-banco", "ok", null],
      ["autenticacao", "falha", "configuracao-ausente"],
      ["aplicacao", "ignorada", "nao-hospedada"],
    ]);
    for (const l of linhas) {
      expect(Object.keys(l).sort()).toEqual(
        ["categoria", "data", "duracao_ms", "resultado", "verificacao", ...(l.verificacao === "consumo-banco" ? ["percentual_do_limite"] : [])].sort(),
      );
    }
    expect(linhas[2].percentual_do_limite).toBe(0.2);
  });

  test("nunca reproduz a mensagem original do erro, que pode conter endereço, usuário ou senha", async () => {
    const erro = Object.assign(new Error(`password authentication failed for user "crm_monitor.ref" em ${SEGREDO}`), { code: "28P01" });
    const linhas = await executarVerificacoes({ postgres: postgresFalso({ erro }), env: { CRM_MONITOR_URL: SEGREDO } });
    const texto = JSON.stringify(linhas) + resumoMarkdown(linhas);
    expect(texto).not.toContain("senha-secreta-123");
    expect(texto).not.toContain("host-interno");
    expect(texto).not.toContain("crm_monitor.ref");
    expect(linhas[0]).toMatchObject({ verificacao: "banco", resultado: "falha", categoria: "autenticacao-recusada" });
    expect(houveProblema(linhas)).toBe(true);
  });

  test("recusa credencial com privilégio ou de outro papel, sem prosseguir", async () => {
    for (const identidade of [{ papel: "postgres", privilegiado: true }, { papel: "crm_app", privilegiado: false }, { papel: "crm_monitor", privilegiado: true }]) {
      const linhas = await executarVerificacoes({ postgres: postgresFalso({ identidade }), env: { CRM_MONITOR_URL: SEGREDO } });
      expect(linhas[0]).toMatchObject({ verificacao: "banco", resultado: "falha", categoria: "credencial-indevida" });
      expect(linhas.map((l) => l.verificacao)).not.toContain("protecoes");
    }
  });

  test("proteção desativada e consumo acima dos alertas geram falha ou alerta", async () => {
    const linhas = await executarVerificacoes({ postgres: postgresFalso({ protecoes: 2, bytes: LIMITE_BANCO_BYTES * 0.9 }), env: { CRM_MONITOR_URL: SEGREDO } });
    expect(linhas.find((l) => l.verificacao === "protecoes")).toMatchObject({ resultado: "falha", categoria: "protecao-desativada" });
    expect(linhas.find((l) => l.verificacao === "consumo-banco")).toMatchObject({ resultado: "alerta", categoria: "acima-de-85-por-cento", percentual_do_limite: 90 });
  });

  test("alertas de consumo em 70% e 85%, parâmetros de gestão", () => {
    expect(avaliarConsumo(LIMITE_BANCO_BYTES * 0.5)).toEqual({ percentual: 50, resultado: "ok", categoria: null });
    expect(avaliarConsumo(LIMITE_BANCO_BYTES * 0.7)).toMatchObject({ resultado: "alerta", categoria: "acima-de-70-por-cento" });
    expect(avaliarConsumo(LIMITE_BANCO_BYTES * 0.85)).toMatchObject({ resultado: "alerta", categoria: "acima-de-85-por-cento" });
  });

  test("categorias de erro", () => {
    expect(categorizarErro({ code: "CONNECT_TIMEOUT" })).toBe("tempo-esgotado");
    expect(categorizarErro({ name: "TimeoutError" })).toBe("tempo-esgotado");
    expect(categorizarErro({ code: "ENOTFOUND" })).toBe("endereco-nao-encontrado");
    expect(categorizarErro({ code: "ECONNREFUSED" })).toBe("conexao-recusada");
    expect(categorizarErro({ message: "Tenant or user not found" })).toBe("projeto-inexistente-ou-pausado");
    expect(categorizarErro({ message: "project is paused" })).toBe("projeto-pausado");
    expect(categorizarErro({ code: "53300" })).toBe("limite-de-conexoes");
    expect(categorizarErro(new Error("qualquer outra coisa"))).toBe("desconhecida");
  });

  test("conferência da automação: fluxo desativado, execução atrasada ou com falha", () => {
    const agora = new Date("2026-11-20T12:00:00Z");
    const execucao = (horas: number, conclusao = "success") => ({ status: "completed", conclusion: conclusao, updated_at: new Date(agora.getTime() - horas * 36e5).toISOString() });
    expect(avaliarAutomacao({ state: "active" }, { workflow_runs: [execucao(5)] }, agora).problemas).toEqual([]);
    expect(avaliarAutomacao({ state: "disabled_inactivity" }, { workflow_runs: [execucao(5)] }, agora).problemas).toEqual(["fluxo-disabled_inactivity"]);
    expect(avaliarAutomacao({ state: "active" }, { workflow_runs: [execucao(30)] }, agora).problemas).toEqual(["execucao-atrasada"]);
    expect(avaliarAutomacao({ state: "active" }, { workflow_runs: [execucao(2, "failure")] }, agora).problemas).toEqual(["ultima-execucao-failure"]);
    expect(avaliarAutomacao({ state: "active" }, { workflow_runs: [] }, agora).problemas).toEqual(["sem-execucoes"]);
  });
});

describe("Retenção das cópias (7 diárias, 4 semanais e 3 mensais)", () => {
  test("mantém a mais recente de cada dia, semana e mês, e nunca descarta a mais recente de todas", () => {
    const agora = new Date("2026-12-31T15:00:00Z");
    const nomes: string[] = [];
    for (let dia = 0; dia < 120; dia++) {
      const d = new Date(Date.UTC(2026, 11, 31, 9, 0, 0) - dia * 864e5);
      nomes.push(`crm-backup-${d.toISOString().slice(0, 19).replace(/:/g, "-")}`);
    }
    nomes.push("crm-backup-2026-12-31T08-00-00", "outra-pasta", "crm-backup-invalido");
    const manter = selecionarParaManter(nomes, agora);
    expect(manter.has("crm-backup-2026-12-31T09-00-00")).toBe(true);
    expect(manter.has("crm-backup-2026-12-31T08-00-00")).toBe(false);
    expect(manter.has("outra-pasta")).toBe(false);
    expect(manter.size).toBeGreaterThanOrEqual(7);
    expect(manter.size).toBeLessThanOrEqual(14);
    expect([...manter].every((n) => n >= "crm-backup-2026-09-01")).toBe(true);
    expect(selecionarParaManter(["crm-backup-2020-01-01T00-00-00"], agora)).toEqual(new Set(["crm-backup-2020-01-01T00-00-00"]));
  });
});
