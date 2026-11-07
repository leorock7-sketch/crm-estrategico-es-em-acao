/**
 * Execução do monitoramento (GitHub Actions, três vezes ao dia; ou manualmente: npm run monitor:verificar).
 * Lê CRM_MONITOR_URL, CRM_SUPABASE_URL, CRM_SUPABASE_CHAVE_PUBLICA e, quando houver hospedagem, CRM_APP_URL.
 * Termina com erro quando alguma verificação falha ou o consumo passa dos alertas: o GitHub avisa por e-mail.
 */
import { appendFileSync } from "node:fs";
import postgres from "postgres";
import { executarVerificacoes, houveProblema, resumoMarkdown } from "./nucleo.mjs";

// No computador de desenvolvimento, aproveita os nomes já usados em .env.local.
const env = {
  ...process.env,
  CRM_SUPABASE_URL: process.env.CRM_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  CRM_SUPABASE_CHAVE_PUBLICA: process.env.CRM_SUPABASE_CHAVE_PUBLICA ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};
const linhas = await executarVerificacoes({ postgres, env });
for (const l of linhas) console.log(JSON.stringify(l));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumoMarkdown(linhas));
process.exitCode = houveProblema(linhas) ? 1 : 0;
