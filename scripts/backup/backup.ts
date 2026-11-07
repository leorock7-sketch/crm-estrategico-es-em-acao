/**
 * Cópia de segurança do banco de DESENVOLVIMENTO (C7, D-082). Comando: npm run backup:executar
 *
 * Somente dados fictícios: recusa qualquer banco que não seja o identificado como descartável. Cópia
 * de dados reais depende da definição do local de guarda e das exigências de segurança e LGPD.
 *
 * 1. Abre uma transação somente leitura e exporta o seu instantâneo: o pg_dump e as contagens
 *    enxergam exatamente os mesmos dados.
 * 2. pg_dump (PostgreSQL 17, sem Docker): esquemas public e drizzle (dados, estrutura, regras de
 *    acesso, gatilhos e permissões) e as tabelas de contas do login (auth.users e auth.identities).
 * 3. Confere cada arquivo com pg_restore --list e calcula o SHA-256.
 * 4. Criptografa com age, para a chave pública; a chave privada fica fora do repositório e das cópias.
 *    Os arquivos sem criptografia são sobrescritos e apagados.
 * 5. Copia para a pasta local e para a pasta do Google Drive, confere as cópias e aplica a retenção.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { abrirBancoPostgres, fecharBanco } from "@/lib/banco/conexao";
import { projetoTema } from "@/lib/banco/esquema";
import { comIdentidade } from "@/lib/banco/identidade";
import { eliminarArquivoComSobrescrita } from "../conferencia-ambiente";
import { lerContasDeTeste } from "../contas-teste";
import { motivosContraCargaDeTeste } from "../protecao-destrutiva";
import { type Contagens, executarOuFalhar, exigir, type Manifesto, mascarar, nomeDaCopia, programa, sha256, variaveisDeConexao } from "./comum";
import { selecionarParaManter } from "./retencao";
import { conferirDestino, copiaIntegra, PREFIXO_PARCIAL } from "./rotina-regras";

const inicio = Date.now();

async function conferirQueEhDesenvolvimento(conexaoAdministrativa: string) {
  const banco = abrirBancoPostgres(conexaoAdministrativa, { max: 1 });
  try {
    const contra = await motivosContraCargaDeTeste(banco, process.env);
    if (contra.length > 0) throw new Error(`Recusado: cópia só do banco de desenvolvimento, identificado como descartável. ${contra.join(" ")}`);
  } finally {
    await fecharBanco(banco);
  }
}

/** Projetos visíveis a cada conta fictícia, lidos pela conexão comum da aplicação (crm_app). */
async function visibilidadeDasContas(): Promise<Record<string, string[]>> {
  const aplicacao = abrirBancoPostgres(exigir("CRM_BANCO_URL"), { max: 1 });
  try {
    const { contas } = lerContasDeTeste();
    const resultado: Record<string, string[]> = {};
    for (const [chave, conta] of Object.entries(contas)) {
      if (!conta.usuarioId) continue;
      const linhas = await comIdentidade(aplicacao, conta.usuarioId).select({ id: projetoTema.id }).from(projetoTema);
      resultado[chave] = linhas.map((l) => l.id).sort();
    }
    return resultado;
  } finally {
    await fecharBanco(aplicacao);
  }
}

async function principal() {
  const conexaoAdministrativa = exigir("CRM_BANCO_ADMIN_URL");
  const destinatario = exigir("CRM_BACKUP_DESTINATARIO_AGE");
  const destinos = [exigir("CRM_BACKUP_PASTA_LOCAL"), exigir("CRM_BACKUP_PASTA_NUVEM")];
  if (!/^age1[0-9a-z]+$/.test(destinatario)) throw new Error("CRM_BACKUP_DESTINATARIO_AGE deve ser a chave PÚBLICA do age (começa com age1).");
  await conferirQueEhDesenvolvimento(conexaoAdministrativa);

  const temporaria = mkdtempSync(path.join(tmpdir(), "crm-backup-"));
  const nome = nomeDaCopia();
  const pastaCopia = path.join(temporaria, nome);
  mkdirSync(pastaCopia);
  const ambiente = variaveisDeConexao(conexaoAdministrativa);
  const pgDump = programa("CRM_PG_BIN", "pg_dump");
  const pgRestore = programa("CRM_PG_BIN", "pg_restore");
  const age = programa("CRM_AGE_BIN", "age");

  // 1. Instantâneo compartilhado entre as contagens e o pg_dump (conexão de sessão, porta 5432).
  const sqlAdm = postgres(conexaoAdministrativa, { max: 1, prepare: false, onnotice: () => {} });
  const planos: { original: string; descricao: string }[] = [];
  let versaoServidor = "";
  let contagens: Contagens;
  try {
    const reservada = await sqlAdm.reserve();
    try {
      await reservada`begin isolation level repeatable read read only`;
      const [{ snapshot }] = await reservada`select pg_export_snapshot() as snapshot`;
      const [{ versao }] = await reservada`select current_setting('server_version') as versao`;
      versaoServidor = versao;
      const tabelas = await reservada`select tablename from pg_tables where schemaname = 'public' order by 1`;
      const porTabela: Record<string, number> = {};
      for (const { tablename } of tabelas) {
        const [{ n }] = await reservada.unsafe(`select count(*)::int as n from public."${tablename}"`);
        porTabela[tablename] = n;
      }
      const [estrutura] = await reservada`
        select (select count(*)::int from drizzle.__drizzle_migrations) as migracoes,
          (select count(*)::int from pg_policies where schemaname = 'public') as politicas,
          (select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal) as gatilhos,
          (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relforcerowsecurity) as forcadas,
          (select count(*)::int from auth.users) as usuarios_auth,
          (select count(*)::int from usuario u where u.auth_id is not null and exists (select 1 from auth.users a where a.id = u.auth_id)) as ligados,
          (select count(*)::int from usuario u where u.auth_id is not null and not exists (select 1 from auth.users a where a.id = u.auth_id)) as sem_conta`;
      contagens = {
        tabelas: porTabela,
        migracoes: estrutura.migracoes,
        politicas: estrutura.politicas,
        gatilhos: estrutura.gatilhos,
        tabelasComRegrasForcadas: estrutura.forcadas,
        usuariosAuth: estrutura.usuarios_auth,
        vinculosLogin: { ligados: estrutura.ligados, semConta: estrutura.sem_conta },
        visibilidade: {},
      };

      // 2. pg_dump com o mesmo instantâneo, enquanto a transação continua aberta.
      const aplicacao = path.join(temporaria, "aplicacao.dump");
      executarOuFalhar(pgDump, ["--format=custom", `--snapshot=${snapshot}`, "--schema=public", "--schema=drizzle", "--no-publications", "--no-subscriptions", `--file=${aplicacao}`], ambiente);
      planos.push({ original: aplicacao, descricao: "dados, estrutura, regras de acesso, gatilhos e permissões" });
      const autenticacao = path.join(temporaria, "autenticacao.dump");
      executarOuFalhar(pgDump, ["--format=custom", `--snapshot=${snapshot}`, "--table=auth.users", "--table=auth.identities", `--file=${autenticacao}`], ambiente);
      planos.push({ original: autenticacao, descricao: "contas do login (auth.users e auth.identities)" });
      await reservada`commit`;
    } finally {
      reservada.release();
    }
  } finally {
    await sqlAdm.end({ timeout: 5 });
  }
  contagens.visibilidade = await visibilidadeDasContas();
  const arquivoContagens = path.join(temporaria, "contagens.json");
  writeFileSync(arquivoContagens, JSON.stringify(contagens, null, 2));
  planos.push({ original: arquivoContagens, descricao: "contagens de conferência" });

  // 3 e 4. Conferência, resumo e criptografia.
  const arquivos: Manifesto["arquivos"] = [];
  for (const { original } of planos) {
    let entradas: number | null = null;
    if (original.endsWith(".dump")) {
      const indice = executarOuFalhar(pgRestore, ["--list", original]);
      entradas = indice.saida.split("\n").filter((l) => l.trim() && !l.startsWith(";")).length;
      if (entradas === 0) throw new Error(`Arquivo sem conteúdo: ${path.basename(original)}`);
    }
    const sha256Original = sha256(original);
    const cifrado = path.join(pastaCopia, `${path.basename(original)}.age`);
    executarOuFalhar(age, ["--encrypt", "--recipient", destinatario, "--output", cifrado, original]);
    eliminarArquivoComSobrescrita(original);
    arquivos.push({ nome: path.basename(cifrado), bytes: statSync(cifrado).size, sha256: sha256(cifrado), sha256Original, entradasNoIndice: entradas });
  }
  const versaoPgDump = executarOuFalhar(pgDump, ["--version"]).saida.trim();
  const manifesto: Manifesto = {
    formato: 1,
    criadaEm: new Date().toISOString(),
    origem: "projeto Supabase de desenvolvimento (somente dados fictícios)",
    versaoPgDump,
    versaoServidor,
    duracaoMs: Date.now() - inicio,
    arquivos,
  };
  writeFileSync(path.join(pastaCopia, "manifesto.json"), JSON.stringify(manifesto, null, 2));

  // 5. Destinos, conferência das cópias e retenção. A cópia é gravada com nome provisório e só ganha o
  // nome definitivo depois de conferida; a retenção considera só cópias íntegras e nunca descarta a
  // mais recente delas (D-084). Pasta provisória de execução interrompida é apagada depois de um dia.
  for (const destino of destinos) {
    mkdirSync(destino, { recursive: true });
    const provisoria = path.join(destino, `${PREFIXO_PARCIAL}${nome}`);
    mkdirSync(provisoria);
    for (const arquivo of readdirSync(pastaCopia)) copyFileSync(path.join(pastaCopia, arquivo), path.join(provisoria, arquivo));
    for (const a of arquivos) if (sha256(path.join(provisoria, a.nome)) !== a.sha256) throw new Error(`Cópia divergente em ${destino}: ${a.nome}`);
    const alvo = path.join(destino, nome);
    renameSync(provisoria, alvo);
    if (!copiaIntegra(alvo).integra) throw new Error(`Cópia não conferiu no destino: ${nome}`);
    const situacao = conferirDestino(destino);
    const manter = selecionarParaManter(situacao.integras, new Date());
    const descartadas = situacao.integras.filter((n) => !manter.has(n));
    for (const n of descartadas) rmSync(path.join(destino, n), { recursive: true, force: true });
    for (const parcial of situacao.parciais) {
      if (Date.now() - statSync(path.join(destino, parcial)).mtimeMs > 864e5) rmSync(path.join(destino, parcial), { recursive: true, force: true });
    }
    const avisos = situacao.problemas.length > 0 ? `; ${situacao.problemas.length} pasta(s) com problema preservada(s) para análise` : "";
    console.log(`[OK] ${destino === destinos[0] ? "Pasta local" : "Pasta do Google Drive"}: cópia conferida; ${situacao.integras.length - descartadas.length} íntegra(s) mantida(s), ${descartadas.length} descartada(s) pela retenção${avisos}.`);
  }
  rmSync(temporaria, { recursive: true, force: true });
  console.log(`COPIA|${nome}|${arquivos.reduce((s, a) => s + a.bytes, 0)}`);
  console.log(`[OK] Cópia ${nome}: ${arquivos.length} arquivos criptografados (${arquivos.reduce((s, a) => s + a.bytes, 0)} bytes), ${Object.keys(contagens.tabelas).length} tabelas, ${contagens.usuariosAuth} contas do login, em ${Math.round((Date.now() - inicio) / 1000)} s.`);
}

principal().catch((erro) => {
  console.error(`Falha na cópia: ${mascarar(erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido").slice(0, 300)}`);
  process.exitCode = 1;
});
