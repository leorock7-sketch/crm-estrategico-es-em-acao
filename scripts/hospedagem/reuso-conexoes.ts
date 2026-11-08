/**
 * P-071, E5 — reaproveitamento de conexões depois de intervalos sem uso, com contas fictícias.
 * Comando: npm run hospedagem:reuso -- --base=<endereço> --rotulo=<nome> [--intervalos=5x3,30x3,90x3,300x2,900x1]
 *          [--contas=administrador,leitor]
 *
 * Depois de cada intervalo sem nenhum acesso, abre a página do projeto A com as contas indicadas ao mesmo
 * tempo (usuários e perfis diferentes) e registra: tempo até o primeiro byte e até a tela completa,
 * conexões novas do papel da aplicação (o driver lê o catálogo de tipos uma vez por conexão nova;
 * contado em pg_stat_statements, sem reiniciar nada), comandos e tempo no banco, sessões do papel da
 * aplicação no banco (pg_stat_activity, máximo durante o carregamento) e erros. Primeiro byte alto com
 * conexões novas indica função "fria" (instância suspensa ou recriada); conexões novas com primeiro byte
 * normal indicam conexões fechadas por ociosidade numa instância já ativa.
 * Leituras de estatísticas pela conexão administrativa deste computador; nada é gravado; nada sensível
 * é exibido. Requer que não haja outro uso do CRM durante a medição.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { chromium, type Page } from "playwright-core";
import { abrirBancoPostgres, fecharBanco } from "@/lib/banco/conexao";
import { exigir } from "../backup/comum";
import { lerContasDeTeste } from "../contas-teste";
import { estatisticas } from "./regras";

const argumento = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const BASE = (argumento("base") ?? "").replace(/\/$/, "");
const ROTULO = argumento("rotulo") ?? "reuso";
const INTERVALOS = (argumento("intervalos") ?? "5x3,30x3,90x3,300x2,900x1").split(",").map((p) => {
  const [s, n] = p.split("x").map(Number);
  return { segundos: s, repeticoes: n || 1 };
});
const CONTAS = (argumento("contas") ?? "administrador,leitor").split(",");
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Carga = { conta: string; ms: number; ttfb: number; ok: boolean };
type Medida = { intervalo: number; cargas: Carga[]; novas: number; comandos: number; msBanco: number; sessoesMax: number };

async function carregar(p: Page, conta: string, url: string): Promise<Carga> {
  const inicio = Date.now();
  try {
    const resposta = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const ttfb = await p.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return n ? Math.round(n.responseStart - n.startTime) : -1;
    });
    await p.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 120_000 });
    const texto = await p.evaluate(() => document.body.innerText);
    const ok = (resposta?.status() ?? 0) < 500 && !/Application error|Erro inesperado|Internal Server Error/i.test(texto);
    return { conta, ms: Date.now() - inicio, ttfb, ok };
  } catch {
    return { conta, ms: Date.now() - inicio, ttfb: -1, ok: false };
  }
}

async function principal() {
  if (!BASE) throw new Error("Informe --base=<endereço>.");
  const { contas, projetoA } = lerContasDeTeste();
  const adm = abrirBancoPostgres(exigir("CRM_BANCO_ADMIN_URL"), { max: 1 });
  const estatisticasDoApp = async () => {
    const [l] = (await adm.execute(sql`
      select coalesce(sum(s.calls) filter (where s.query ilike '%pg_catalog.pg_type%'), 0)::bigint as novas,
             coalesce(sum(s.calls), 0)::bigint as comandos, coalesce(sum(s.total_exec_time), 0)::float8 as ms
        from pg_stat_statements s join pg_roles r on r.oid = s.userid where r.rolname = 'crm_app'`)) as unknown as { novas: string; comandos: string; ms: number }[];
    return { novas: Number(l.novas), comandos: Number(l.comandos), ms: Number(l.ms) };
  };
  const sessoesDoApp = async () => {
    const [l] = (await adm.execute(sql`select count(*)::int as n from pg_stat_activity where usename = 'crm_app'`)) as unknown as { n: number }[];
    return l.n;
  };
  const navegador = await chromium.launch({ channel: "msedge", headless: true });
  const medidas: Medida[] = [];
  try {
    const paginas: Page[] = [];
    for (const nome of CONTAS) {
      const conta = (contas as Record<string, { email: string; senha: string }>)[nome];
      const p = await (await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" })).newPage();
      await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await p.getByLabel("E-mail").fill(conta.email);
      await p.getByLabel("Senha").fill(conta.senha);
      await p.getByRole("button", { name: "Entrar", exact: true }).click();
      await p.waitForURL((url) => url.pathname !== "/login", { timeout: 120_000 });
      paginas.push(p);
    }
    const url = `${BASE}/projetos-temas/${projetoA}`;
    await Promise.all(paginas.map((p, i) => carregar(p, CONTAS[i], url))); // aquecimento, fora da conta
    for (const { segundos, repeticoes } of INTERVALOS) {
      for (let r = 0; r < repeticoes; r++) {
        await espera(segundos * 1000);
        const antes = await estatisticasDoApp();
        let sessoesMax = await sessoesDoApp();
        let carregando = true;
        const amostrador = (async () => {
          while (carregando) {
            sessoesMax = Math.max(sessoesMax, await sessoesDoApp());
            await espera(250);
          }
        })();
        const cargas = await Promise.all(paginas.map((p, i) => carregar(p, CONTAS[i], url)));
        carregando = false;
        await amostrador;
        await espera(2500);
        const depois = await estatisticasDoApp();
        medidas.push({ intervalo: segundos, cargas, novas: depois.novas - antes.novas, comandos: depois.comandos - antes.comandos, msBanco: Math.round(depois.ms - antes.ms), sessoesMax });
        console.log(`  ${String(segundos).padStart(4)} s · ${cargas.map((c) => `${c.conta}: ${c.ms} ms (1º byte ${c.ttfb})${c.ok ? "" : " ERRO"}`).join(" · ")} · conexões novas ${depois.novas - antes.novas} · sessões no banco (máx.) ${sessoesMax}`);
      }
    }
  } finally {
    await navegador.close();
    await fecharBanco(adm);
  }
  console.log(`\nResumo (${ROTULO}; mediana [mínimo–máximo]; tempos de todas as contas)`);
  console.log("| Intervalo sem uso | Tela completa (ms) | 1º byte (ms) | Conexões novas por rodada | Sessões no banco (máx.) | Erros |");
  console.log("|---|---|---|---|---|---|");
  for (const s of [...new Set(medidas.map((m) => m.intervalo))]) {
    const doIntervalo = medidas.filter((m) => m.intervalo === s);
    const faixa = (v: number[]) => {
      const e = estatisticas(v);
      return e.minimo === e.maximo ? `${e.mediana}` : `${e.mediana} [${e.minimo}–${e.maximo}]`;
    };
    const cargas = doIntervalo.flatMap((m) => m.cargas);
    console.log(`| ${s} s | ${faixa(cargas.map((c) => c.ms))} | ${faixa(cargas.map((c) => c.ttfb))} | ${faixa(doIntervalo.map((m) => m.novas))} | ${faixa(doIntervalo.map((m) => m.sessoesMax))} | ${cargas.filter((c) => !c.ok).length} |`);
  }
  const pasta = path.join(process.cwd(), ".dados", "hospedagem");
  mkdirSync(pasta, { recursive: true });
  writeFileSync(path.join(pasta, `reuso-${ROTULO}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), JSON.stringify({ base: BASE, contas: CONTAS, medidas }, null, 2));
}

principal().catch((erro) => {
  console.error(`Falha na medição: ${erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido"}`);
  process.exitCode = 1;
});
