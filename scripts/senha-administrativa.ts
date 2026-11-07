/**
 * Troca da senha administrativa do PostgreSQL, sem exibir o valor em nenhum momento (D-076).
 *
 * npm run ambiente:senha-admin -- gerar
 *   Gera uma senha forte, aleatória, só com letras e números, e guarda em .dados/senha-admin-nova.txt
 *   (o Git ignora). Quem troca a senha abre o arquivo e copia o valor para o painel do Supabase.
 *
 * npm run ambiente:senha-admin -- aplicar
 *   Depois da troca no painel: confirma que a senha nova conecta e só então atualiza .env.local,
 *   apaga o arquivo temporário e limpa a área de transferência. Se não conectar, nada muda.
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { conexaoComNovaSenha, explicarFalhaDeConexao, gerarSenhaForte } from "./conferencia-ambiente";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });

const ARQUIVO_TEMPORARIO = path.join(process.cwd(), ".dados", "senha-admin-nova.txt");
const ARQUIVO_AMBIENTE = path.join(process.cwd(), ".env.local");
// Logo depois da troca, o pooler pode recusar por alguns instantes (documentação do Supabase).
const TENTATIVAS = 12;
const ESPERA_MS = 10_000;

function areaDeTransferencia(texto: string) {
  execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", "$input | Set-Clipboard"], { input: texto });
}

function gerar() {
  const senha = gerarSenhaForte((n) => randomBytes(n));
  mkdirSync(path.dirname(ARQUIVO_TEMPORARIO), { recursive: true });
  writeFileSync(ARQUIVO_TEMPORARIO, senha);
  console.log("[OK] Senha gerada e guardada em .dados/senha-admin-nova.txt. O valor não é exibido aqui.");
}

async function conecta(conexao: string): Promise<{ conectou: boolean; codigo?: unknown }> {
  const banco = postgres(conexao, { max: 1, prepare: false, ssl: "require", connect_timeout: 15, onnotice: () => {} });
  try {
    await banco`select 1`;
    return { conectou: true };
  } catch (erro) {
    return { conectou: false, codigo: (erro as { code?: unknown }).code };
  } finally {
    await banco.end({ timeout: 5 }).catch(() => {});
  }
}

async function aplicar() {
  if (!existsSync(ARQUIVO_TEMPORARIO)) throw new Error("Não há senha gerada. Rode primeiro o comando com gerar.");
  const atual = process.env.CRM_BANCO_ADMIN_URL;
  if (!atual) throw new Error("Falta CRM_BANCO_ADMIN_URL em .env.local.");
  const nova = conexaoComNovaSenha(atual, readFileSync(ARQUIVO_TEMPORARIO, "utf8").trim());

  let resultado = await conecta(nova);
  for (let tentativa = 1; !resultado.conectou && tentativa < TENTATIVAS; tentativa++) {
    await new Promise((resolver) => setTimeout(resolver, ESPERA_MS));
    resultado = await conecta(nova);
  }
  if (!resultado.conectou) {
    throw new Error(`A senha nova não conectou (${explicarFalhaDeConexao(resultado.codigo)}). Nada foi alterado: confira se a troca foi salva no painel.`);
  }

  const texto = readFileSync(ARQUIVO_AMBIENTE, "utf8");
  if (!/^CRM_BANCO_ADMIN_URL=.*$/m.test(texto)) throw new Error("Campo CRM_BANCO_ADMIN_URL não encontrado em .env.local.");
  writeFileSync(ARQUIVO_AMBIENTE, texto.replace(/^CRM_BANCO_ADMIN_URL=.*$/m, () => `CRM_BANCO_ADMIN_URL=${nova}`));
  rmSync(ARQUIVO_TEMPORARIO, { force: true });
  try {
    areaDeTransferencia(" ");
  } catch {
    // Só limpeza: a senha já foi aplicada.
  }
  console.log("[OK] Senha nova confirmada, .env.local atualizado, arquivo temporário apagado e área de transferência limpa.");
}

async function principal() {
  const operacao = process.argv[2];
  if (operacao === "gerar") gerar();
  else if (operacao === "aplicar") await aplicar();
  else throw new Error('Informe "gerar" ou "aplicar".');
}

principal().catch((erro) => {
  // Só a mensagem preparada aqui: erros de conexão podem conter dados da conexão.
  console.error(erro instanceof Error && !/postgres(ql)?:\/\//.test(erro.message) ? erro.message : "Falha na troca da senha; nada foi alterado.");
  process.exitCode = 1;
});
