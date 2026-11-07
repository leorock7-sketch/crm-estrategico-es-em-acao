/**
 * Prepara o projeto Supabase de desenvolvimento (D-075). Comando: npm run supabase:preparar
 *
 * 1. Aplica as migrações pela conexão administrativa, a única que altera a estrutura.
 * 2. Ativa o login do papel crm_app com senha gerada aqui e grava a conexão em .env.local,
 *    sem exibi-la. A aplicação passa a usar esse papel, sem privilégios.
 * 3. Carrega os dados de demonstração, exclusivamente fictícios, se o banco estiver vazio.
 * 4. Cria as contas fictícias de teste, uma para cada situação (scripts/contas-teste.ts).
 *
 * Pode ser repetido: o que já existe não é refeito. Nenhum valor secreto é exibido. Os passos 3 e 4
 * só ocorrem no banco identificado como descartável (scripts/protecao-destrutiva.ts): fora dele,
 * contas com senhas conhecidas nunca são criadas.
 *
 * Com a opção --refazer, apaga antes os dados e as contas de teste. Só no banco descartável e com a
 * frase de confirmação no próprio comando; caso contrário, recusa, sem apagar nada:
 * CRM_CONFIRMAR_EXCLUSAO="APAGAR DADOS FICTICIOS DE <identificador>" npm run supabase:preparar -- --refazer
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { abrirBancoPostgres, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { usuario } from "@/lib/banco/esquema";
import { comIdentidade } from "@/lib/banco/identidade";
import { alinharValoresNormalizados } from "@/lib/banco/normalizacao";
import { eq } from "drizzle-orm";
import { prepararBancoLocal, USUARIO_DESENVOLVIMENTO } from "@/modulos/acesso/usuario-atual";
import { apagarContasDeTeste, criarContasDeTeste } from "./contas-teste";
import { apagarBancoDescartavel, motivosContraCargaDeTeste, OperacaoDestrutivaRecusadaError } from "./protecao-destrutiva";
import { carregarExemplos } from "./carregar-exemplos";

// Lida antes de carregar o arquivo .env.local: a confirmação tem de vir do próprio comando.
const confirmacaoDeExclusao = process.env.CRM_CONFIRMAR_EXCLUSAO;
loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });

const PASTA_MIGRACOES = path.join(process.cwd(), "src", "lib", "banco", "migracoes");
const ARQUIVO_AMBIENTE = path.join(process.cwd(), ".env.local");

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Falta ${nome} em .env.local. Rode "npm run ambiente:conferir".`);
  return valor;
}

async function aplicarMigracoes(banco: Banco) {
  await migrate(banco as never, { migrationsFolder: PASTA_MIGRACOES });
  await alinharValoresNormalizados(banco);
  const [{ n }] = (await banco.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)).rows as { n: number }[];
  console.log(`[OK] Migrações aplicadas: ${n}.`);
}

/** Gera a senha do papel da aplicação e grava a conexão em .env.local, sem exibir nada. */
async function ativarPapelDaAplicacao(banco: Banco, conexaoAdministrativa: string) {
  if (process.env.CRM_BANCO_URL) {
    console.log("[OK] Papel crm_app: conexão já configurada em .env.local.");
    return;
  }
  // Só letras e números: dispensa qualquer ajuste na conexão.
  const senha = randomBytes(24).toString("hex");
  await banco.execute(sql.raw(`alter role crm_app login password '${senha}'`));
  const url = new URL(conexaoAdministrativa);
  const referencia = url.username.split(".")[1];
  url.username = `crm_app.${referencia}`;
  url.password = senha;
  // Modo de transação do pooler: toda operação da aplicação já é uma transação curta.
  url.port = "6543";
  const atual = readFileSync(ARQUIVO_AMBIENTE, "utf8");
  if (!/^CRM_BANCO_URL=\s*$/m.test(atual)) throw new Error("Campo CRM_BANCO_URL não encontrado em branco em .env.local.");
  writeFileSync(ARQUIVO_AMBIENTE, atual.replace(/^CRM_BANCO_URL=\s*$/m, `CRM_BANCO_URL=${url.toString()}`));
  process.env.CRM_BANCO_URL = url.toString();
  console.log("[OK] Papel crm_app: login ativado e conexão gravada em .env.local.");
}

/** Prova que a aplicação conecta como crm_app e que, sem identidade, as regras negam tudo. */
async function conferirPapelDaAplicacao() {
  const aplicacao = abrirBancoPostgres(exigir("CRM_BANCO_URL"), { max: 1 });
  try {
    const semIdentidade = comIdentidade(aplicacao, null);
    const [{ papel }] = (await semIdentidade.execute(sql`select current_user as papel`)).rows as { papel: string }[];
    const [{ total }] = (await semIdentidade.execute(sql`select count(*)::int as total from usuario`)).rows as { total: number }[];
    if (papel !== "crm_app" || total !== 0) throw new Error("A conexão da aplicação não está restrita como deveria.");
    console.log("[OK] Conexão da aplicação: papel crm_app; sem identidade, zero linhas.");
  } finally {
    await fecharBanco(aplicacao);
  }
}

async function carregarDemonstracao(banco: Banco) {
  // O administrador fictício é o autor da demonstração. Depois da carga, fica inativo: não
  // participa de operação nenhuma e não teria como entrar, pois não tem identidade (auth_id).
  await prepararBancoLocal(banco);
  await banco.update(usuario).set({ situacao: "ativo" }).where(eq(usuario.id, USUARIO_DESENVOLVIMENTO.id));
  await carregarExemplos(banco, USUARIO_DESENVOLVIMENTO);
}

async function inativarAdministradorFicticio(banco: Banco) {
  await comoUsuario(banco, USUARIO_DESENVOLVIMENTO.id, (tx) =>
    tx.update(usuario).set({ situacao: "inativo", administrador: false }).where(eq(usuario.id, USUARIO_DESENVOLVIMENTO.id)),
  );
  console.log("[OK] Administrador fictício inativo: segue como autor dos registros antigos, sem acesso.");
}

async function principal() {
  const conexaoAdministrativa = exigir("CRM_BANCO_ADMIN_URL");
  exigir("NEXT_PUBLIC_SUPABASE_URL");
  exigir("SUPABASE_SECRET_KEY");
  const banco = abrirBancoPostgres(conexaoAdministrativa, { max: 3 });
  try {
    if (process.argv.includes("--refazer")) {
      // Primeiro a proteção: as contas só são apagadas depois de autorizada a exclusão.
      await apagarBancoDescartavel(banco, process.env, confirmacaoDeExclusao);
      await apagarContasDeTeste();
      console.log("[OK] Dados anteriores apagados.");
    }
    await aplicarMigracoes(banco);
    await ativarPapelDaAplicacao(banco, conexaoAdministrativa);
    await conferirPapelDaAplicacao();
    const contraCarga = await motivosContraCargaDeTeste(banco, process.env);
    if (contraCarga.length > 0) {
      console.log(`[AVISO] Banco não identificado como descartável; dados e contas de teste não foram carregados. ${contraCarga.join(" ")}`);
      return;
    }
    await carregarDemonstracao(banco);
    await criarContasDeTeste(banco);
    await inativarAdministradorFicticio(banco);
    console.log("\nProjeto de desenvolvimento pronto. Dados exclusivamente fictícios.");
  } finally {
    await fecharBanco(banco);
  }
}

principal().catch((erro) => {
  // Sem imprimir o erro inteiro: mensagens de conexão podem conter dados da conexão.
  if (erro instanceof OperacaoDestrutivaRecusadaError) console.error(erro.message);
  else console.error(`Falha na preparação: ${erro instanceof Error ? erro.message.split("\n")[0].slice(0, 200) : "erro desconhecido"}`);
  process.exitCode = 1;
});
