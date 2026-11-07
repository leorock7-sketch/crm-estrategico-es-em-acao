/**
 * Prepara as cópias de segurança neste computador (C7, D-082). Comando: npm run backup:preparar
 *
 * - Gera o par de chaves do age, se ainda não existir, FORA do repositório e das pastas das cópias
 *   (por padrão em %USERPROFILE%\.crm-backup\identidade-age.txt). A chave privada não é exibida:
 *   preserve esse arquivo e, antes de dados reais, crie uma segunda cópia segura dele (D-086).
 * - Grava em .env.local a chave PÚBLICA e as pastas informadas, sem exibir segredos.
 *
 * Uso: npm run backup:preparar -- --pg "<pasta bin do PostgreSQL 17>" --age "<pasta do age>"
 *        --local "<pasta local>" --nuvem "<pasta no Google Drive>"
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { executarOuFalhar } from "./comum";

const ARQUIVO_AMBIENTE = path.join(process.cwd(), ".env.local");

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function gravar(nome: string, valor: string) {
  const atual = readFileSync(ARQUIVO_AMBIENTE, "utf8");
  const linha = new RegExp(`^${nome}=.*$`, "m");
  writeFileSync(ARQUIVO_AMBIENTE, linha.test(atual) ? atual.replace(linha, `${nome}=${valor}`) : `${atual.replace(/\s*$/, "")}\n${nome}=${valor}\n`);
}

function principal() {
  const pastas = { CRM_PG_BIN: argumento("pg"), CRM_AGE_BIN: argumento("age"), CRM_BACKUP_PASTA_LOCAL: argumento("local"), CRM_BACKUP_PASTA_NUVEM: argumento("nuvem") };
  for (const [nome, valor] of Object.entries(pastas)) {
    if (!valor) throw new Error(`Informe a opção correspondente a ${nome}.`);
    if (nome.startsWith("CRM_BACKUP_PASTA")) mkdirSync(valor, { recursive: true });
    if (!existsSync(valor)) throw new Error(`Pasta inexistente para ${nome}.`);
    const repositorio = path.resolve(process.cwd());
    if (path.resolve(valor).startsWith(repositorio)) throw new Error(`${nome} não pode ficar dentro do repositório.`);
  }

  const identidade = argumento("identidade") ?? path.join(homedir(), ".crm-backup", "identidade-age.txt");
  for (const pasta of [pastas.CRM_BACKUP_PASTA_LOCAL, pastas.CRM_BACKUP_PASTA_NUVEM]) {
    if (path.resolve(identidade).startsWith(path.resolve(pasta as string))) throw new Error("A chave privada não pode ficar na pasta das cópias.");
  }
  if (!existsSync(identidade)) {
    mkdirSync(path.dirname(identidade), { recursive: true });
    executarOuFalhar(path.join(pastas.CRM_AGE_BIN as string, process.platform === "win32" ? "age-keygen.exe" : "age-keygen"), ["-o", identidade]);
    console.log("[OK] Par de chaves do age gerado fora do repositório e das pastas das cópias.");
  } else {
    console.log("[OK] Par de chaves do age já existente: mantido.");
  }
  const publica = /^# public key: (age1[0-9a-z]+)$/m.exec(readFileSync(identidade, "utf8"))?.[1];
  if (!publica) throw new Error("Não foi possível ler a chave pública no arquivo de identidade.");

  for (const [nome, valor] of Object.entries(pastas)) gravar(nome, valor as string);
  gravar("CRM_BACKUP_DESTINATARIO_AGE", publica);
  gravar("CRM_BACKUP_IDENTIDADE_AGE", identidade);
  console.log("[OK] .env.local atualizado: programas, pastas, chave pública e local da chave privada.");
  console.log("Preserve o arquivo da chave privada; sem ele, as cópias não podem ser abertas. Antes de dados reais, crie uma segunda cópia segura dele (D-086).");
}

try {
  principal();
} catch (erro) {
  console.error(`Falha: ${erro instanceof Error ? erro.message : "erro desconhecido"}`);
  process.exitCode = 1;
}
