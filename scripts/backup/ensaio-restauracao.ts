/**
 * Ensaio de restauração em ambiente isolado (C7, D-082). Comando: npm run backup:ensaiar [-- <pasta da cópia>]
 *
 * Restaura uma cópia num PostgreSQL 17 temporário, criado só para o ensaio neste computador, ligado
 * apenas ao endereço local e apagado ao final (sem Docker e sem tocar no projeto Supabase):
 * 1. confere o SHA-256 dos arquivos criptografados contra o manifesto;
 * 2. abre os arquivos com a chave privada (fora do repositório) e confere o SHA-256 original;
 * 3. cria o banco temporário e restaura dados, estrutura, regras de acesso, gatilhos, permissões e
 *    as contas do login;
 * 4. confere, antes de qualquer gravação: contagens, regras forçadas, políticas, proteções, contas com
 *    os mesmos projetos visíveis e senhas das contas fictícias no hash restaurado; depois, roda o
 *    conjunto completo das regras de acesso, pelo papel crm_app;
 * 5. desliga o banco temporário e apaga tudo, sobrescrevendo antes os arquivos abertos.
 *
 * O login completo do Supabase Auth só pode ser demonstrado restaurando num projeto Supabase, o que
 * depende de autorização para um segundo projeto gratuito (docs/OPERACAO.md, seção 5).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eliminarArquivoComSobrescrita } from "../conferencia-ambiente";
import { executar, executarOuFalhar, exigir, type Manifesto, mascarar, PREFIXO_COPIA, programa, sha256 } from "./comum";

const PORTA = "55432";
const etapas: { etapa: string; ms: number }[] = [];
let marco = Date.now();
const registrar = (etapa: string) => {
  etapas.push({ etapa, ms: Date.now() - marco });
  marco = Date.now();
};

const PAPEIS_DO_SUPABASE = ["anon", "authenticated", "service_role", "authenticator", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin", "dashboard_user", "pgbouncer"];

function escolherCopia(): string {
  const informada = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (informada) return informada;
  const local = exigir("CRM_BACKUP_PASTA_LOCAL");
  const copias = readdirSync(local).filter((n) => n.startsWith(PREFIXO_COPIA)).sort();
  if (copias.length === 0) throw new Error("Nenhuma cópia na pasta local: rode npm run backup:executar.");
  return path.join(local, copias[copias.length - 1]);
}

function principal(): number {
  const pastaCopia = escolherCopia();
  const manifesto = JSON.parse(readFileSync(path.join(pastaCopia, "manifesto.json"), "utf8")) as Manifesto;
  for (const a of manifesto.arquivos) {
    if (sha256(path.join(pastaCopia, a.nome)) !== a.sha256) throw new Error(`Arquivo alterado ou corrompido: ${a.nome}`);
  }
  console.log(`[OK] ${manifesto.arquivos.length} arquivos criptografados conferidos com o manifesto (${path.basename(pastaCopia)}).`);

  const temporaria = mkdtempSync(path.join(tmpdir(), "crm-ensaio-"));
  const dados = path.join(temporaria, "dados");
  const pgCtl = programa("CRM_PG_BIN", "pg_ctl");
  let ligado = false;
  try {
    const identidade = exigir("CRM_BACKUP_IDENTIDADE_AGE");
    const abertos: Record<string, string> = {};
    for (const a of manifesto.arquivos) {
      const destino = path.join(temporaria, a.nome.replace(/\.age$/, ""));
      executarOuFalhar(programa("CRM_AGE_BIN", "age"), ["--decrypt", "--identity", identidade, "--output", destino, path.join(pastaCopia, a.nome)]);
      if (sha256(destino) !== a.sha256Original) throw new Error(`Conteúdo aberto difere do original: ${a.nome}`);
      abertos[path.basename(destino)] = destino;
    }
    registrar("conferência e abertura dos arquivos");
    console.log("[OK] Arquivos abertos com a chave privada; conteúdo idêntico ao original (SHA-256).");

    executarOuFalhar(programa("CRM_PG_BIN", "initdb"), ["-D", dados, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--no-locale"]);
    // Sem canais de saída: no Windows, o servidor herdaria os canais e o comando nunca terminaria.
    const partida = spawnSync(pgCtl, ["-D", dados, "-l", path.join(temporaria, "registro.log"), "-o", `-p ${PORTA} -c listen_addresses=127.0.0.1`, "-w", "-t", "60", "start"], { stdio: "ignore", windowsHide: true });
    if (partida.status !== 0) throw new Error("O banco temporário não iniciou.");
    ligado = true;
    registrar("criação do banco temporário isolado");

    const psql = programa("CRM_PG_BIN", "psql");
    const base = { ...process.env, PGHOST: "127.0.0.1", PGPORT: PORTA, PGUSER: "postgres", PGSSLMODE: "disable" };
    const comandos = [
      ...PAPEIS_DO_SUPABASE.map((p) => `create role ${p} nologin;`),
      "create role crm_app login nosuperuser nocreatedb nocreaterole noreplication nobypassrls;",
      "create role crm_monitor nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls noinherit;",
      "create database crm_restaurado;",
    ].join("\n");
    executarOuFalhar(psql, ["-v", "ON_ERROR_STOP=1", "-q", "-d", "postgres"], base, comandos);
    const restaurar = (arquivo: string) => {
      const r = executar(programa("CRM_PG_BIN", "pg_restore"), ["--no-owner", "--dbname=crm_restaurado", arquivo], base);
      const erros = r.erros.split("\n").filter((l) => /error/i.test(l));
      return erros.map((l) => mascarar(l).slice(0, 160));
    };
    const errosAplicacao = restaurar(abertos["aplicacao.dump"]);
    executarOuFalhar(psql, ["-v", "ON_ERROR_STOP=1", "-q", "-d", "crm_restaurado"], base, "create schema auth;\ncreate schema extensoes;\ncreate extension pgcrypto schema extensoes;\n");
    const errosAutenticacao = restaurar(abertos["autenticacao.dump"]);
    registrar("restauração dos dados, da estrutura e das contas do login");
    console.log(`[${errosAplicacao.length + errosAutenticacao.length === 0 ? "OK" : "AVISO"}] Restauração concluída: ${errosAplicacao.length} aviso(s) no banco da aplicação e ${errosAutenticacao.length} nas contas do login.`);
    for (const l of [...errosAplicacao, ...errosAutenticacao].slice(0, 10)) console.log(`  - ${l}`);

    const ambienteDosTestes = {
      ...process.env,
      CRM_RESTAURACAO_ADMIN_URL: `postgresql://postgres@127.0.0.1:${PORTA}/crm_restaurado`,
      CRM_RESTAURACAO_APP_URL: `postgresql://crm_app@127.0.0.1:${PORTA}/crm_restaurado`,
      CRM_RESTAURACAO_CONTAGENS: abertos["contagens.json"],
    };
    // Primeiro a conferência, antes de qualquer gravação; depois, o conjunto das regras de acesso.
    let situacao = 0;
    for (const [etapa, arquivo] of [["conferência da cópia restaurada", "testes/restauracao/conferencia.test.ts"], ["regras de acesso no banco restaurado", "testes/restauracao/regras.test.ts"]]) {
      const testes = spawnSync(process.execPath, [path.join("node_modules", "vitest", "vitest.mjs"), "run", "--config", "vitest.restauracao.config.mts", arquivo], {
        env: ambienteDosTestes,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      registrar(etapa);
      const saida = `${testes.stdout}\n${testes.stderr}`;
      console.log(`- ${etapa}:`);
      for (const l of saida.split("\n").filter((x) => /Test Files|Tests |×|FAIL|AssertionError|Expected|Received|^\s+[-+] /.test(x))) console.log(`  ${mascarar(l).slice(0, 200)}`);
      if (testes.status !== 0) situacao = 1;
    }
    for (const e of etapas) console.log(`  ${e.etapa}: ${(e.ms / 1000).toFixed(1)} s`);
    console.log(`  total: ${(etapas.reduce((s, e) => s + e.ms, 0) / 1000).toFixed(1)} s`);
    return situacao;
  } finally {
    if (ligado) spawnSync(pgCtl, ["-D", dados, "-m", "fast", "-w", "stop"], { stdio: "ignore", windowsHide: true });
    for (const nome of ["aplicacao.dump", "autenticacao.dump", "contagens.json"]) {
      const arquivo = path.join(temporaria, nome);
      if (existsSync(arquivo)) eliminarArquivoComSobrescrita(arquivo);
    }
    rmSync(temporaria, { recursive: true, force: true });
    console.log(existsSync(temporaria) ? "[AVISO] A pasta temporária não pôde ser apagada." : "[OK] Banco temporário desligado e apagado; arquivos abertos sobrescritos.");
  }
}

try {
  process.exitCode = principal();
} catch (erro) {
  console.error(`Falha no ensaio: ${mascarar(erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido").slice(0, 300)}`);
  process.exitCode = 1;
}
