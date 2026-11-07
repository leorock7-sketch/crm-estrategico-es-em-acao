// @vitest-environment node
/**
 * Proteção das operações destrutivas (D-076): bloqueio diante de conexões e configurações não
 * autorizadas. Roda a cada Pull Request, sem acessar nenhum serviço externo: as conexões citadas
 * são fictícias e as comprovações de exclusão usam PGlite. A cada recusa, os dados têm de continuar.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, fecharBanco } from "@/lib/banco/conexao";
import { usuario } from "@/lib/banco/esquema";
import {
  apagarBancoDescartavel,
  conferirBanco,
  conferirConfiguracao,
  fraseDeExclusao,
  fraseDeMarcacao,
  marcarBancoDescartavel,
  motivosContraCargaDeTeste,
  OperacaoDestrutivaRecusadaError,
} from "../scripts/protecao-destrutiva";
import { abrirBanco as abrirBancoDoTestePostgres } from "./apoio/conexao-postgres-real";

const REF = "projetodescartavel01";
const SENHA = ["senha", "ficticia"].join("-");
const POOLER = "aws-1-sa-east-1.pooler.supabase.com";

const autorizado = {
  NODE_ENV: "development",
  CRM_BANCO_ADMIN_URL: `postgresql://postgres.${REF}:${SENHA}@${POOLER}:5432/postgres`,
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  CRM_BANCO_DESCARTAVEL_REF: REF,
};
const FRASE = fraseDeExclusao(REF);

describe("Configuração: recusa sem acessar o banco", () => {
  test("configuração completa e coerente passa nesta etapa, que sozinha não autoriza nada", () => {
    expect(conferirConfiguracao(autorizado)).toEqual({ referencia: REF, motivos: [] });
  });

  test.each([
    ["sem conexão", { CRM_BANCO_ADMIN_URL: undefined }],
    ["texto que não é conexão", { CRM_BANCO_ADMIN_URL: "qualquer coisa" }],
    ["banco local", { CRM_BANCO_ADMIN_URL: `postgresql://postgres:${SENHA}@localhost:5432/postgres` }],
    ["outro servidor", { CRM_BANCO_ADMIN_URL: `postgresql://postgres.${REF}:${SENHA}@banco.exemplo.invalid:5432/postgres` }],
    ["conexão direta do projeto", { CRM_BANCO_ADMIN_URL: `postgresql://postgres:${SENHA}@db.${REF}.supabase.co:5432/postgres` }],
    ["outra região", { CRM_BANCO_ADMIN_URL: `postgresql://postgres.${REF}:${SENHA}@aws-0-us-east-1.pooler.supabase.com:5432/postgres` }],
    ["outra porta do pooler", { CRM_BANCO_ADMIN_URL: `postgresql://postgres.${REF}:${SENHA}@${POOLER}:6543/postgres` }],
    ["outro banco no mesmo servidor", { CRM_BANCO_ADMIN_URL: `postgresql://postgres.${REF}:${SENHA}@${POOLER}:5432/producao` }],
    ["papel da aplicação", { CRM_BANCO_ADMIN_URL: `postgresql://crm_app.${REF}:${SENHA}@${POOLER}:5432/postgres` }],
    ["usuário sem identificador de projeto", { CRM_BANCO_ADMIN_URL: `postgresql://postgres:${SENHA}@${POOLER}:5432/postgres` }],
    ["conexão de outro projeto", { CRM_BANCO_ADMIN_URL: `postgresql://postgres.outroprojeto000:${SENHA}@${POOLER}:5432/postgres` }],
    ["endereço de outro projeto", { NEXT_PUBLIC_SUPABASE_URL: "https://outroprojeto000.supabase.co" }],
    ["sem endereço do projeto", { NEXT_PUBLIC_SUPABASE_URL: undefined }],
    ["projeto fora da lista local", { CRM_BANCO_DESCARTAVEL_REF: "outroprojeto000" }],
    ["sem lista local", { CRM_BANCO_DESCARTAVEL_REF: undefined }],
    ["ambiente de produção", { NODE_ENV: "production" }],
    ["integração contínua", { CI: "true" }],
    ["GitHub Actions", { GITHUB_ACTIONS: "true" }],
    ["hospedagem", { VERCEL: "1" }],
  ])("recusa: %s", (_caso, ajuste) => {
    expect(conferirConfiguracao({ ...autorizado, ...ajuste }).motivos.length).toBeGreaterThan(0);
  });

  test("nome de ambiente não autoriza: development e test, sozinhos, são recusados", () => {
    for (const NODE_ENV of ["development", "test"]) {
      expect(conferirConfiguracao({ NODE_ENV }).motivos.length).toBeGreaterThan(0);
    }
  });

  test("os motivos não repetem senha nem conexão", () => {
    const { motivos } = conferirConfiguracao({ ...autorizado, CRM_BANCO_ADMIN_URL: `postgresql://postgres:${SENHA}@localhost:5432/postgres` });
    expect(JSON.stringify(motivos)).not.toContain(SENHA);
  });
});

describe("Exclusão no banco", () => {
  let banco: Banco;

  beforeEach(async () => {
    banco = await abrirBanco();
  });

  afterEach(async () => {
    await fecharBanco(banco);
  });

  const tabelasPublicas = async () =>
    ((await banco.execute(sql`select count(*)::int as n from pg_tables where schemaname = 'public'`)).rows[0] as { n: number }).n;

  async function marcar() {
    await marcarBancoDescartavel(banco, autorizado, fraseDeMarcacao(REF));
  }

  /** Comprova a recusa e que nenhum dado foi apagado. */
  async function esperarRecusa(ambiente: Record<string, string | undefined>, frase: string | undefined, trecho: RegExp) {
    const antes = await tabelasPublicas();
    expect(antes).toBeGreaterThan(40);
    await expect(apagarBancoDescartavel(banco, ambiente, frase)).rejects.toThrow(OperacaoDestrutivaRecusadaError);
    await expect(apagarBancoDescartavel(banco, ambiente, frase)).rejects.toThrow(trecho);
    expect(await tabelasPublicas()).toBe(antes);
  }

  test("sem a marca de ambiente descartável, recusa, mesmo com tudo o mais certo", async () => {
    await esperarRecusa(autorizado, FRASE, /marca de ambiente descartável/);
  });

  test("sem a frase de confirmação, recusa, mesmo em banco marcado", async () => {
    await marcar();
    await esperarRecusa(autorizado, undefined, /frase de confirmação/);
  });

  test.each([
    ["confirmação genérica", "sim"],
    ["minúsculas", FRASE.toLowerCase()],
    ["frase de outro projeto", fraseDeExclusao("outroprojeto000")],
    ["frase de marcação", fraseDeMarcacao(REF)],
    ["com espaço a mais", `${FRASE} `],
  ])("frase incorreta, recusa: %s", async (_caso, frase) => {
    await marcar();
    await esperarRecusa(autorizado, frase, /frase de confirmação/);
  });

  test("marca de outro projeto (banco copiado), recusa", async () => {
    await marcar();
    await banco.execute(sql`update crm_ambiente.identificacao set referencia_projeto = 'outroprojeto000'`);
    await esperarRecusa(autorizado, FRASE, /cita outro projeto/);
  });

  test("marca ambígua, recusa", async () => {
    await marcar();
    await banco.execute(sql`insert into crm_ambiente.identificacao (referencia_projeto, finalidade, dados_ficticios) values ('outroprojeto000', 'testes_descartaveis', true)`);
    await esperarRecusa(autorizado, FRASE, /ambígua/);
  });

  test("marca que não declara testes descartáveis, recusa", async () => {
    await marcar();
    await banco.execute(sql`alter table crm_ambiente.identificacao drop constraint identificacao_finalidade_check`);
    await banco.execute(sql`update crm_ambiente.identificacao set finalidade = 'producao'`);
    await esperarRecusa(autorizado, FRASE, /não declara testes descartáveis/);
  });

  test("marca ilegível, recusa", async () => {
    await marcar();
    await banco.execute(sql`alter table crm_ambiente.identificacao drop column finalidade`);
    await esperarRecusa(autorizado, FRASE, /Não foi possível conferir/);
  });

  test("usuário com e-mail real, recusa, mesmo em banco marcado e com a frase certa", async () => {
    await marcar();
    await banco.insert(usuario).values({ nome: "Pessoa Fictícia", email: "pessoa@instituicao.es.gov.br" });
    await esperarRecusa(autorizado, FRASE, /usuário\(s\) com e-mail fora dos domínios fictícios/);
  });

  test("contato de e-mail real, recusa", async () => {
    await marcar();
    await banco.execute(sql`insert into stakeholder (id, tipo) values ('11111111-1111-4111-8111-111111111111', 'pessoa')`);
    await banco.execute(sql`insert into contato (stakeholder_id, tipo, valor, valor_normalizado, natureza) values ('11111111-1111-4111-8111-111111111111', 'email', 'alguem@empresa.com.br', 'alguem@empresa.com.br', 'institucional')`);
    await esperarRecusa(autorizado, FRASE, /contato\(s\) de e-mail fora dos domínios fictícios/);
  });

  test("conta de acesso real no Supabase, recusa", async () => {
    await marcar();
    await banco.execute(sql`create schema auth`);
    await banco.execute(sql`create table auth.users (id uuid primary key default gen_random_uuid(), email text)`);
    await banco.execute(sql`insert into auth.users (email) values ('pessoa@instituicao.es.gov.br')`);
    await esperarRecusa(autorizado, FRASE, /conta\(s\) de acesso fora dos domínios fictícios/);
  });

  test("conta de acesso sem e-mail, que não se pode comprovar fictícia, recusa", async () => {
    await marcar();
    await banco.execute(sql`create schema auth`);
    await banco.execute(sql`create table auth.users (id uuid primary key default gen_random_uuid(), email text)`);
    await banco.execute(sql`insert into auth.users (email) values (null)`);
    await esperarRecusa(autorizado, FRASE, /conta\(s\) de acesso/);
  });

  test("conexão de outro projeto, em banco marcado e com a frase certa do outro projeto, recusa", async () => {
    await marcar();
    const outro = "outroprojeto000";
    await esperarRecusa(
      {
        ...autorizado,
        CRM_BANCO_ADMIN_URL: `postgresql://postgres.${outro}:${SENHA}@${POOLER}:5432/postgres`,
        NEXT_PUBLIC_SUPABASE_URL: `https://${outro}.supabase.co`,
      },
      fraseDeExclusao(outro),
      /não é o autorizado/,
    );
  });

  test("marcar exige a frase própria e recusa banco com dado real", async () => {
    await expect(marcarBancoDescartavel(banco, autorizado, undefined)).rejects.toThrow(/frase de confirmação da marcação/);
    await expect(marcarBancoDescartavel(banco, autorizado, FRASE)).rejects.toThrow(/frase de confirmação da marcação/);
    await banco.insert(usuario).values({ nome: "Pessoa Fictícia", email: "pessoa@instituicao.es.gov.br" });
    await expect(marcarBancoDescartavel(banco, autorizado, fraseDeMarcacao(REF))).rejects.toThrow(/fora dos domínios fictícios/);
    expect(await conferirBanco(banco, REF)).toEqual(["O banco não traz a marca de ambiente descartável."]);
  });

  test("com todas as condições comprovadas, apaga os dados e preserva a marca", async () => {
    await marcar();
    await banco.insert(usuario).values({ nome: "Pessoa Fictícia", email: "pessoa@exemplo.invalid" });
    expect(await conferirBanco(banco, REF)).toEqual([]);
    await apagarBancoDescartavel(banco, autorizado, FRASE);
    expect(await tabelasPublicas()).toBe(0);
    const esquemaDrizzle = await banco.execute(sql`select to_regclass('drizzle.__drizzle_migrations') is not null as existe`);
    expect(esquemaDrizzle.rows[0]).toEqual({ existe: false });
    expect(await conferirBanco(banco, REF)).toEqual([]);
  });

  test("carga de dados e contas de teste: recusada fora do banco descartável", async () => {
    expect((await motivosContraCargaDeTeste(banco, autorizado)).join(" ")).toMatch(/marca de ambiente descartável/);
    await marcar();
    expect(await motivosContraCargaDeTeste(banco, autorizado)).toEqual([]);
    const outro = { ...autorizado, CRM_BANCO_DESCARTAVEL_REF: "outroprojeto000" };
    expect((await motivosContraCargaDeTeste(banco, outro)).length).toBeGreaterThan(0);
  });
});

describe("Comandos reais", () => {
  const ambienteDoFilho = (extra: Record<string, string>) => {
    const ambiente: NodeJS.ProcessEnv = { ...process.env, ...extra };
    delete ambiente.CRM_CONFIRMAR_EXCLUSAO;
    delete ambiente.CI;
    delete ambiente.GITHUB_ACTIONS;
    return ambiente;
  };

  test("supabase:preparar --refazer sem confirmação recusa antes de conectar, com aviso de que nada foi apagado", () => {
    // Conexão inexistente: se o comando tentasse conectar, o erro seria outro.
    const resultado = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/supabase-preparar.ts", "--refazer"], {
      env: ambienteDoFilho({
        CRM_BANCO_ADMIN_URL: `postgresql://postgres.${REF}:${SENHA}@${POOLER}:5432/postgres`,
        NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
        CRM_BANCO_DESCARTAVEL_REF: REF,
        SUPABASE_SECRET_KEY: "valor-ficticio",
      }),
      encoding: "utf8",
    });
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain("nada foi apagado");
    expect(resultado.stderr).toContain("frase de confirmação");
    expect(resultado.stdout).not.toContain("[OK]");
  }, 120_000);

  test("supabase:preparar --refazer com a frase de outro projeto e conexão local recusa", () => {
    const resultado = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/supabase-preparar.ts", "--refazer"], {
      env: ambienteDoFilho({
        CRM_BANCO_ADMIN_URL: `postgresql://postgres:${SENHA}@localhost:5432/postgres`,
        NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
        CRM_BANCO_DESCARTAVEL_REF: REF,
        SUPABASE_SECRET_KEY: "valor-ficticio",
        CRM_CONFIRMAR_EXCLUSAO: FRASE,
      }),
      encoding: "utf8",
    });
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain("nada foi apagado");
    expect(resultado.stdout).not.toContain("[OK]");
  }, 120_000);

  test("a frase de confirmação gravada em arquivo não vale: tem de vir do próprio comando", () => {
    for (const script of ["scripts/supabase-preparar.ts", "scripts/marcar-banco-descartavel.ts"]) {
      const texto = readFileSync(path.join(process.cwd(), script), "utf8");
      const confirmacao = texto.indexOf("process.env.CRM_CONFIRMAR_");
      const carregamento = texto.indexOf("loadEnvConfig(process.cwd()");
      expect(confirmacao, script).toBeGreaterThan(-1);
      expect(confirmacao, script).toBeLessThan(carregamento);
    }
    const configuracao = readFileSync(path.join(process.cwd(), "vitest.postgres.config.mts"), "utf8");
    expect(configuracao).toContain("process.env.CRM_CONFIRMAR_EXCLUSAO");
  });

  test("o teste em PostgreSQL real recusa sem a configuração autorizada, antes de conectar", async () => {
    const guardado = { ...process.env };
    for (const nome of ["CRM_BANCO_ADMIN_URL", "CRM_BANCO_DESCARTAVEL_REF", "NEXT_PUBLIC_SUPABASE_URL", "CRM_CONFIRMAR_EXCLUSAO"]) delete process.env[nome];
    try {
      await expect(abrirBancoDoTestePostgres()).rejects.toThrow(OperacaoDestrutivaRecusadaError);
      process.env.CRM_BANCO_ADMIN_URL = `postgresql://postgres:${SENHA}@localhost:5432/postgres`;
      await expect(abrirBancoDoTestePostgres()).rejects.toThrow(OperacaoDestrutivaRecusadaError);
    } finally {
      process.env = guardado;
    }
  });

  test("nenhum outro arquivo do projeto apaga esquemas ou esvazia tabelas", () => {
    const varrer = (pasta: string): string[] =>
      readdirSync(path.join(process.cwd(), pasta)).flatMap((nome) => {
        const relativo = path.join(pasta, nome);
        return statSync(path.join(process.cwd(), relativo)).isDirectory() ? varrer(relativo) : [relativo.replaceAll("\\", "/")];
      });
    const arquivos = ["src", "scripts", "testes"].flatMap(varrer).filter((a) => /\.(ts|tsx|sql)$/.test(a));
    const comExclusao = arquivos.filter((a) => {
      if (a === "testes/protecao-destrutiva.test.ts") return false;
      return /\bdrop\s+schema\b|\btruncate\s+(table\s+)?[a-z"]/i.test(readFileSync(path.join(process.cwd(), a), "utf8"));
    });
    expect(comExclusao).toEqual(["scripts/protecao-destrutiva.ts"]);
  });

  test("o arquivo .env.local e as senhas temporárias continuam fora do repositório", () => {
    const ignorados = execFileSync("git", ["check-ignore", ".env.local", ".dados/senha-admin-nova.txt"], { encoding: "utf8" });
    expect(ignorados).toContain(".env.local");
    expect(ignorados).toContain(".dados/senha-admin-nova.txt");
  });
});
