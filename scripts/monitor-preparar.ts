/**
 * Ativa o login do papel restrito crm_monitor, SOMENTE no projeto Supabase de desenvolvimento
 * (autorização A3 da D-082). Comando: npm run monitor:preparar
 *
 * 1. Recusa qualquer banco que não seja o de desenvolvimento identificado como descartável.
 * 2. Confere que o papel nasceu da migração 0010 sem privilégios (sem superusuário, sem BYPASSRLS,
 *    sem nenhuma concessão em tabela, coluna ou função).
 * 3. Gera a senha aqui, ativa o login e grava a conexão em .env.local, sem exibi-la.
 * 4. Grava em .dados/segredos-monitor-github.txt (fora do Git) os três valores a cadastrar como
 *    segredos do GitHub Actions. Depois de cadastrados: npm run monitor:preparar -- --apagar-arquivo
 * 5. Executa uma verificação com a conexão nova.
 *
 * Com --renovar, troca a senha (a anterior deixa de valer). Nenhum valor secreto é exibido.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { abrirBancoPostgres, fecharBanco } from "@/lib/banco/conexao";
import { executarVerificacoes } from "./monitor/nucleo.mjs";
import { eliminarArquivoComSobrescrita } from "./conferencia-ambiente";
import { motivosContraCargaDeTeste } from "./protecao-destrutiva";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });

const ARQUIVO_AMBIENTE = path.join(process.cwd(), ".env.local");
const ARQUIVO_SEGREDOS = path.join(process.cwd(), ".dados", "segredos-monitor-github.txt");

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Falta ${nome} em .env.local.`);
  return valor;
}

function gravarNoAmbiente(nome: string, valor: string) {
  const atual = readFileSync(ARQUIVO_AMBIENTE, "utf8");
  const linha = new RegExp(`^${nome}=.*$`, "m");
  const novo = linha.test(atual) ? atual.replace(linha, `${nome}=${valor}`) : `${atual.replace(/\s*$/, "")}\n\n# Monitoramento (D-082): papel crm_monitor, sem acesso a tabelas.\n${nome}=${valor}\n`;
  writeFileSync(ARQUIVO_AMBIENTE, novo);
}

async function principal() {
  if (process.argv.includes("--apagar-arquivo")) {
    if (existsSync(ARQUIVO_SEGREDOS)) eliminarArquivoComSobrescrita(ARQUIVO_SEGREDOS);
    console.log(existsSync(ARQUIVO_SEGREDOS) ? "[PROBLEMA] O arquivo não pôde ser apagado." : "[OK] Arquivo dos segredos apagado (conteúdo sobrescrito antes).");
    return;
  }
  const conexaoAdministrativa = exigir("CRM_BANCO_ADMIN_URL");
  const banco = abrirBancoPostgres(conexaoAdministrativa, { max: 1 });
  try {
    const contra = await motivosContraCargaDeTeste(banco, process.env);
    if (contra.length > 0) throw new Error(`Recusado: só no projeto de desenvolvimento identificado como descartável. ${contra.join(" ")}`);

    const [papel] = (
      await banco.execute(sql`
        select rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolinherit,
          (select count(*)::int from information_schema.role_table_grants where grantee = 'crm_monitor')
          + (select count(*)::int from information_schema.column_privileges where grantee = 'crm_monitor')
          + (select count(*)::int from information_schema.role_routine_grants where grantee = 'crm_monitor') as concessoes
        from pg_roles where rolname = 'crm_monitor'`)
    ).rows as { rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean; rolcreatedb: boolean; rolinherit: boolean; concessoes: number }[];
    if (!papel) throw new Error("O papel crm_monitor não existe: aplique antes a migração 0010 (npm run supabase:preparar).");
    if (papel.rolsuper || papel.rolbypassrls || papel.rolcreaterole || papel.rolcreatedb || papel.rolinherit || papel.concessoes !== 0) {
      throw new Error("O papel crm_monitor tem privilégios além do mínimo: nada foi alterado.");
    }
    console.log("[OK] Papel crm_monitor sem privilégios: sem acesso a tabelas, colunas ou funções.");

    if (process.env.CRM_MONITOR_URL && !process.argv.includes("--renovar")) {
      console.log("[OK] Conexão do monitor já configurada em .env.local (use --renovar para trocar a senha).");
    } else {
      // Só letras e números: dispensa qualquer ajuste na conexão.
      const senha = randomBytes(24).toString("hex");
      await banco.execute(sql.raw(`alter role crm_monitor login password '${senha}'`));
      const url = new URL(conexaoAdministrativa);
      url.username = `crm_monitor.${url.username.split(".")[1]}`;
      url.password = senha;
      url.port = "6543";
      gravarNoAmbiente("CRM_MONITOR_URL", url.toString());
      process.env.CRM_MONITOR_URL = url.toString();
      writeFileSync(
        ARQUIVO_SEGREDOS,
        [
          "Segredos do GitHub Actions para o monitoramento (Settings > Secrets and variables > Actions > New repository secret).",
          "Cadastre cada nome com o valor correspondente. Depois: npm run monitor:preparar -- --apagar-arquivo",
          "",
          `CRM_MONITOR_URL=${url.toString()}`,
          `CRM_SUPABASE_URL=${exigir("NEXT_PUBLIC_SUPABASE_URL")}`,
          `CRM_SUPABASE_CHAVE_PUBLICA=${exigir("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")}`,
          "",
        ].join("\n"),
      );
      console.log("[OK] Login do monitor ativado; conexão gravada em .env.local e valores para o GitHub em .dados/segredos-monitor-github.txt.");
    }
  } finally {
    await fecharBanco(banco);
  }

  const linhas = await executarVerificacoes({
    postgres,
    env: {
      CRM_MONITOR_URL: process.env.CRM_MONITOR_URL,
      CRM_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      CRM_SUPABASE_CHAVE_PUBLICA: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  for (const l of linhas) console.log(JSON.stringify(l));
}

principal().catch((erro) => {
  // Sem imprimir o erro inteiro: mensagens de conexão podem conter dados da conexão.
  console.error(`Falha: ${erro instanceof Error ? erro.message.split("\n")[0].slice(0, 200) : "erro desconhecido"}`);
  process.exitCode = 1;
});
