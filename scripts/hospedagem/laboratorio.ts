/**
 * Laboratório de latência (P-071, E1): roda a versão compilada neste computador falando com o banco de
 * desenvolvimento por um intermediário que atrasa os bytes em cada sentido, para simular a distância
 * entre a função do Netlify (Ohio) e o banco (São Paulo). Sem deploy e sem custo.
 * Comando: npm run hospedagem:laboratorio -- [--atraso=60] [--minutos=60]  (depois de npm run build)
 *
 * - A conexão continua criptografada de ponta a ponta (TLS entre o driver e o pooler); o intermediário
 *   só repassa bytes cifrados. O destino vem do .env.local e não é exibido.
 * - Liga a instrumentação (CRM_INSTRUMENTACAO): só tempos e contagens, em .dados/hospedagem/.
 * - Mede a ida e volta pelo intermediário e grava em .dados/hospedagem/laboratorio.json.
 * Servidor em http://127.0.0.1:3299; termina sozinho depois de --minutos.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { estatisticas } from "./regras";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
const argumento = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
// --rtt=<ms>: calcula o atraso para que a ida e volta total chegue ao alvo (mesmas condições entre medições).
const ALVO_RTT = argumento("rtt") ? Number(argumento("rtt")) : null;
let ATRASO = Number(argumento("atraso") ?? 60);
const MINUTOS = Number(argumento("minutos") ?? 60);
const PORTA_INTERMEDIARIO = 6544;
const PORTA_SERVIDOR = 3299;
const PASTA = path.join(process.cwd(), ".dados", "hospedagem");
const ARQUIVO_INSTRUMENTACAO = path.join(PASTA, "instrumentacao.jsonl");

function iniciarIntermediario(destino: URL) {
  const servidor = net.createServer((cliente) => {
    const remoto = net.connect(Number(destino.port || 5432), destino.hostname);
    cliente.setNoDelay(true);
    remoto.setNoDelay(true);
    // Temporizadores com o mesmo atraso disparam na ordem de criação: a ordem dos bytes é preservada.
    const repassar = (origem: net.Socket, alvo: net.Socket) =>
      origem.on("data", (bloco) => setTimeout(() => !alvo.destroyed && alvo.write(bloco), ATRASO));
    repassar(cliente, remoto);
    repassar(remoto, cliente);
    const encerrar = () => setTimeout(() => { cliente.destroy(); remoto.destroy(); }, ATRASO + 5);
    for (const s of [cliente, remoto]) { s.on("close", encerrar); s.on("error", encerrar); }
  });
  return new Promise<net.Server>((resolver) => servidor.listen(PORTA_INTERMEDIARIO, "127.0.0.1", () => resolver(servidor)));
}

async function principal() {
  const original = process.env.CRM_BANCO_URL;
  if (!original) throw new Error("Falta CRM_BANCO_URL no .env.local.");
  const viaLaboratorio = new URL(original);
  viaLaboratorio.hostname = "127.0.0.1";
  viaLaboratorio.port = String(PORTA_INTERMEDIARIO);
  mkdirSync(PASTA, { recursive: true });
  writeFileSync(ARQUIVO_INSTRUMENTACAO, "");
  if (ALVO_RTT !== null) {
    const direto = postgres(original, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });
    await direto`select 1`;
    const base: number[] = [];
    for (let i = 0; i < 9; i++) {
      const inicio = performance.now();
      await direto`select 1`;
      base.push(performance.now() - inicio);
    }
    await direto.end();
    ATRASO = Math.max(0, Math.round((ALVO_RTT - estatisticas(base).mediana) / 2));
  }
  const intermediario = await iniciarIntermediario(new URL(original));

  // Ida e volta pelo intermediário (consulta sem parâmetros nem tabelas, pelo papel da aplicação).
  const sql = postgres(viaLaboratorio.toString(), { max: 1, prepare: false, ssl: "require", onnotice: () => {} });
  await sql`select 1`;
  const tempos: number[] = [];
  for (let i = 0; i < 9; i++) {
    const inicio = performance.now();
    await sql`select 1`;
    tempos.push(performance.now() - inicio);
  }
  await sql.end();
  const idaEVolta = estatisticas(tempos);
  writeFileSync(path.join(PASTA, "laboratorio.json"), JSON.stringify({ atraso: ATRASO, idaEVoltaMs: idaEVolta.mediana, quando: new Date().toISOString() }));

  const servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(PORTA_SERVIDOR)], {
    env: { ...process.env, NODE_ENV: "production", CRM_BANCO_URL: viaLaboratorio.toString(), CRM_INSTRUMENTACAO: ARQUIVO_INSTRUMENTACAO },
    stdio: "ignore",
  });
  for (let tentativa = 0; tentativa < 120; tentativa++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORTA_SERVIDOR}/login`, { redirect: "manual" })).status < 500) break;
    } catch {
      // Ainda iniciando.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`laboratório pronto: http://127.0.0.1:${PORTA_SERVIDOR}; atraso ${ATRASO} ms por sentido; ida e volta medida ${idaEVolta.mediana} ms`);
  const encerrar = () => { servidor.kill(); intermediario.close(); process.exit(0); };
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
  setTimeout(encerrar, MINUTOS * 60_000);
}

principal().catch((erro) => {
  console.error(`Falha no laboratório: ${erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido"}`);
  process.exit(1);
});
