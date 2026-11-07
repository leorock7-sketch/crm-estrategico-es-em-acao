/**
 * Apoio comum às cópias de segurança (C7, D-082): leitura do ambiente, execução dos programas do
 * PostgreSQL e do age sem expor senhas, resumos criptográficos e nomes das cópias.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });

export function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Falta ${nome} em .env.local (veja .env.example e docs/OPERACAO.md).`);
  return valor;
}

export const programa = (pasta: "CRM_PG_BIN" | "CRM_AGE_BIN", nome: string) =>
  path.join(exigir(pasta), process.platform === "win32" ? `${nome}.exe` : nome);

/**
 * Variáveis de conexão para os programas do PostgreSQL: a senha vai pelo ambiente do processo,
 * e não pela linha de comando, que outros programas do computador poderiam ler.
 */
export function variaveisDeConexao(conexao: string, exigirTls = true): NodeJS.ProcessEnv {
  const url = new URL(conexao);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.replace(/^\//, "") || "postgres",
    PGSSLMODE: exigirTls ? "require" : "disable",
    PGCONNECT_TIMEOUT: "15",
  };
}

/** Mensagens dos programas podem conter servidor ou usuário: só a primeira linha, mascarada. */
export function mascarar(texto: string): string {
  return texto
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, "<conexao>")
    .replace(/[a-z0-9-]+\.pooler\.supabase\.com/gi, "<servidor>")
    .replace(/[a-z0-9]{20}\.supabase\.co/gi, "<projeto>")
    .replace(/AGE-SECRET-KEY-[A-Z0-9]+/g, "<chave>");
}

export function executar(executavel: string, argumentos: string[], ambiente: NodeJS.ProcessEnv = process.env, entrada?: string) {
  const resultado = spawnSync(executavel, argumentos, { env: ambiente, input: entrada, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  if (resultado.error) throw new Error(`Não foi possível executar ${path.basename(executavel)}: ${resultado.error.message}`);
  return { codigo: resultado.status ?? -1, saida: resultado.stdout ?? "", erros: resultado.stderr ?? "" };
}

export function executarOuFalhar(executavel: string, argumentos: string[], ambiente?: NodeJS.ProcessEnv, entrada?: string) {
  const r = executar(executavel, argumentos, ambiente, entrada);
  if (r.codigo !== 0) throw new Error(`${path.basename(executavel)} terminou com código ${r.codigo}: ${mascarar(r.erros.split("\n").find((l) => l.trim()) ?? "")}`.slice(0, 300));
  return r;
}

export function sha256(arquivo: string): string {
  return createHash("sha256").update(readFileSync(arquivo)).digest("hex");
}

export const PREFIXO_COPIA = "crm-backup-";

/** Nome da pasta de uma cópia: crm-backup-AAAA-MM-DDTHH-MM-SS (horário de Brasília). */
export function nomeDaCopia(data = new Date()): string {
  const brasilia = new Date(data.getTime() - 3 * 36e5).toISOString().slice(0, 19).replace(/:/g, "-");
  return `${PREFIXO_COPIA}${brasilia}`;
}

export type Manifesto = {
  formato: 1;
  criadaEm: string;
  origem: string;
  versaoPgDump: string;
  versaoServidor: string;
  duracaoMs: number;
  arquivos: { nome: string; bytes: number; sha256: string; sha256Original: string; entradasNoIndice: number | null }[];
};

export type Contagens = {
  tabelas: Record<string, number>;
  migracoes: number;
  politicas: number;
  gatilhos: number;
  tabelasComRegrasForcadas: number;
  usuariosAuth: number;
  /** Usuários internos ligados a uma conta do login e os que apontam para conta inexistente. */
  vinculosLogin: { ligados: number; semConta: number };
  visibilidade: Record<string, string[]>;
};
