/**
 * T3 — tempo de resposta da hospedagem (Etapa 7B, D-087), com contas fictícias.
 * Comando: npm run hospedagem:desempenho -- --base=<endereço> [--rodadas=5] [--rotulo=netlify]
 * (sem --base, usa CRM_TESTE_BASE_URL; com --local, mede a versão compilada neste computador, para comparar).
 *
 * Entra como a administradora fictícia (a senha vem de .dados/contas-teste.json e não é exibida),
 * abre as telas principais várias vezes e mede: tempo até o primeiro byte (servidor + rede) e tempo
 * até a tela completa (sem "Carregando"). Mede também a geração dos relatórios R1 a R5 em XLSX.
 * A primeira rodada mostra o efeito de funções "frias". Os resultados vão para
 * .dados/hospedagem/desempenho-<rótulo>-<data>.json (fora do Git) e para a tela, sem dados pessoais.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { lerContasDeTeste } from "../contas-teste";
import { estatisticas } from "./regras";

const argumento = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
// --local: a versão compilada neste computador (npm run build antes), para comparação.
const LOCAL = process.argv.includes("--local");
const PORTA_LOCAL = 3299;
const BASE = (LOCAL ? `http://127.0.0.1:${PORTA_LOCAL}` : (argumento("base") ?? process.env.CRM_TESTE_BASE_URL ?? "")).replace(/\/$/, "");
const RODADAS = Number(argumento("rodadas") ?? 5);
const ROTULO = argumento("rotulo") ?? "hospedagem";

async function medirTela(pagina: Page, caminho: string) {
  const inicio = Date.now();
  const resposta = await pagina.goto(`${BASE}${caminho}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const primeiroByte = await pagina.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return n ? n.responseStart - n.startTime : -1;
  });
  await pagina.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 120_000 }).catch(() => undefined);
  return { status: resposta?.status() ?? 0, primeiroByte, completa: Date.now() - inicio, final: new URL(pagina.url()).pathname };
}

async function aguardarServidor() {
  for (let tentativa = 0; tentativa < 120; tentativa++) {
    try {
      if ((await fetch(`${BASE}/login`, { redirect: "manual" })).status < 500) return;
    } catch {
      // Ainda iniciando.
    }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  throw new Error("A aplicação local não iniciou.");
}

async function principal() {
  if (!BASE) throw new Error("Informe --base=<endereço>, --local ou CRM_TESTE_BASE_URL.");
  const servidor = LOCAL
    ? spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(PORTA_LOCAL)], { env: { ...process.env, NODE_ENV: "production" }, stdio: "ignore" })
    : undefined;
  if (servidor) await aguardarServidor();
  const { contas, projetoA } = lerContasDeTeste();
  const navegador = await chromium.launch({ channel: "msedge", headless: true });
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
  const pagina = await contexto.newPage();
  const resultados: Record<string, { primeiroByte: number[]; completa: number[]; status: number[] }> = {};
  const anotar = (nome: string, m: { status: number; primeiroByte: number; completa: number }) => {
    resultados[nome] ??= { primeiroByte: [], completa: [], status: [] };
    resultados[nome].primeiroByte.push(m.primeiroByte);
    resultados[nome].completa.push(m.completa);
    resultados[nome].status.push(m.status);
  };

  try {
    anotar("login (tela)", await medirTela(pagina, "/login?destino=%2Fpaineis"));
    const inicioEntrada = Date.now();
    await pagina.getByLabel("E-mail").fill(contas.administrador.email);
    await pagina.getByLabel("Senha").fill(contas.administrador.senha);
    await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
    await pagina.waitForURL((url) => url.pathname !== "/login", { timeout: 120_000 });
    await pagina.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 120_000 }).catch(() => undefined);
    anotar("entrada (login até o painel)", { status: 200, primeiroByte: -1, completa: Date.now() - inicioEntrada });

    const telas: [string, string][] = [
      ["visão executiva", "/paineis"],
      ["painel do projeto", `/paineis/projetos/${projetoA}`],
      ["relatórios", "/paineis/relatorios"],
      ["matriz de stakeholders", `/projetos-temas/${projetoA}/matriz`],
      ["projeto ou tema", `/projetos-temas/${projetoA}`],
      ["pessoas", "/pessoas"],
      ["instituições", "/instituicoes"],
      ["interações", "/interacoes"],
      ["iniciativas", "/iniciativas"],
      ["planos de ação", "/planos"],
      ["riscos", "/riscos"],
      ["usuários", "/usuarios"],
    ];
    for (let rodada = 1; rodada <= RODADAS; rodada++) {
      for (const [nome, caminho] of telas) anotar(rodada === 1 ? `${nome} (1ª rodada)` : nome, await medirTela(pagina, caminho));
      for (const codigo of ["R1", "R2", "R3", "R4", "R5"]) {
        const inicio = Date.now();
        const resposta = await pagina.request.get(`${BASE}/paineis/relatorios/${codigo}`, { maxRedirects: 0, timeout: 120_000 });
        const corpo = await resposta.body();
        const tipoOk = (resposta.headers()["content-type"] ?? "").includes("spreadsheetml");
        anotar(rodada === 1 ? `${codigo} em XLSX (1ª rodada)` : `${codigo} em XLSX`, { status: tipoOk && corpo.length > 0 ? resposta.status() : -resposta.status(), primeiroByte: -1, completa: Date.now() - inicio });
      }
    }
  } finally {
    await navegador.close();
    servidor?.kill();
  }

  const resumo = Object.entries(resultados).map(([nome, r]) => ({
    tela: nome,
    status: [...new Set(r.status)].join("/"),
    primeiroByte: r.primeiroByte[0] >= 0 ? estatisticas(r.primeiroByte) : null,
    completa: estatisticas(r.completa),
  }));
  console.log(`T3 — ${ROTULO}: ${RODADAS} rodada(s); tempos em milissegundos (mediana / p90)`);
  for (const l of resumo) {
    const ttfb = l.primeiroByte ? `${l.primeiroByte.mediana} / ${l.primeiroByte.p90}` : "—";
    console.log(`  ${l.tela.padEnd(34)} HTTP ${l.status.padEnd(7)} 1º byte ${ttfb.padEnd(13)} completa ${l.completa.mediana} / ${l.completa.p90}`);
  }
  const pasta = path.join(process.cwd(), ".dados", "hospedagem");
  mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, `desempenho-${ROTULO}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(arquivo, JSON.stringify({ rotulo: ROTULO, rodadas: RODADAS, quando: new Date().toISOString(), resumo }, null, 2));
  console.log(`Resultados: ${path.relative(process.cwd(), arquivo)}`);
}

principal().catch((erro) => {
  console.error(`Falha na medição: ${erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido"}`);
  process.exitCode = 1;
});
