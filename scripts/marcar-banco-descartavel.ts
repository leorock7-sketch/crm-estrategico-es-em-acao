/**
 * Marca o banco de testes como descartável (D-076). Não apaga nada. Grava a marca no próprio banco
 * e registra o projeto como autorizado em .env.local. Comando, com a frase de confirmação na mesma
 * linha: CRM_CONFIRMAR_MARCACAO="MARCAR COMO DESCARTAVEL <identificador>" npm run supabase:marcar-descartavel
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { abrirBancoPostgres, fecharBanco } from "@/lib/banco/conexao";
import { marcarBancoDescartavel, OperacaoDestrutivaRecusadaError } from "./protecao-destrutiva";

// Lida antes de carregar o arquivo .env.local: a confirmação tem de vir do próprio comando.
const confirmacao = process.env.CRM_CONFIRMAR_MARCACAO;
loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });

async function principal() {
  const banco = abrirBancoPostgres(process.env.CRM_BANCO_ADMIN_URL ?? "", { max: 1 });
  try {
    const referencia = await marcarBancoDescartavel(banco, process.env, confirmacao);
    const arquivo = path.join(process.cwd(), ".env.local");
    const atual = readFileSync(arquivo, "utf8");
    if (!/^CRM_BANCO_DESCARTAVEL_REF=/m.test(atual)) {
      const quebra = atual.includes("\r\n") ? "\r\n" : "\n";
      writeFileSync(arquivo, `${atual.trimEnd()}${quebra}${quebra}# Único projeto em que comandos destrutivos podem rodar neste computador (D-076).${quebra}CRM_BANCO_DESCARTAVEL_REF=${referencia}${quebra}`);
    }
    console.log("[OK] Banco identificado como descartável, e projeto autorizado neste computador. Nada foi apagado.");
  } finally {
    await fecharBanco(banco);
  }
}

principal().catch((erro) => {
  console.error(erro instanceof OperacaoDestrutivaRecusadaError ? erro.message : "Falha na marcação; nada foi alterado.");
  process.exitCode = 1;
});
