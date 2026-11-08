/**
 * P-071, E3 — equivalência funcional dos painéis e dos relatórios R1 a R5, com contas fictícias.
 * Comando: npm run hospedagem:equivalencia-paineis -- --base=<endereço> --rotulo=<nome> [--comparar=<arquivo>]
 *
 * Captura, por conta de teste: visão executiva, painéis dos projetos A e B, variações com filtros e a
 * página de relatórios (texto visível e controles); e os arquivos R1 a R5, relidos célula a célula
 * (valores, fórmulas, formato numérico, negrito, preenchimento, larguras, mesclagens e painéis
 * congelados). A data e hora da extração é mascarada. Grava em .dados/hospedagem (fora do Git) e,
 * com --comparar, aponta cada diferença. Só leitura; senhas não são exibidas.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { chromium, type Page } from "playwright-core";
import { abrirBancoPostgres, fecharBanco } from "@/lib/banco/conexao";
import { exigir } from "../backup/comum";
import { lerContasDeTeste } from "../contas-teste";

const argumento = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const BASE = (argumento("base") ?? process.env.CRM_TESTE_BASE_URL ?? "").replace(/\/$/, "");
const ROTULO = argumento("rotulo") ?? "captura";
const COMPARAR = argumento("comparar");
const TODAS = ["administrador", "gestor", "colaborador", "leitor", "gestorOutroProjeto", "permissaoVencida", "permissaoRevogada", "semPermissao"] as const;
const EXPORTAM = ["administrador", "gestor", "colaborador", "leitor", "gestorOutroProjeto", "semPermissao"] as const;
const RELATORIOS = ["R1", "R2", "R3", "R4", "R5"];
const DATA_HORA = /\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}(:\d{2})?/g;

async function pagina(p: Page, caminho: string) {
  const resposta = await p.goto(`${BASE}${caminho}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await p.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 120_000 }).catch(() => undefined);
  await p.waitForTimeout(300);
  return p.evaluate((status) => {
    const principal = document.querySelector("main") ?? document.body;
    const controles = [...principal.querySelectorAll("a, button, form, input, select, textarea, option")].map((el) => {
      const e = el as HTMLElement & { href?: string; name?: string; type?: string; value?: string };
      const destino = e.tagName === "A" && e.href ? new URL(e.href).pathname + new URL(e.href).search : "";
      return [e.tagName.toLowerCase(), e.name ?? "", e.type ?? "", e.value ?? "", destino, (e.innerText ?? "").replace(/\s+/g, " ").trim()].join("|");
    });
    return { status, final: location.pathname, texto: principal.innerText.replace(/\s+/g, " ").trim(), controles };
  }, resposta?.status() ?? 0);
}

/** Conteúdo comparável de um XLSX: tudo o que o usuário vê ou que muda o significado dos dados. */
async function lerXlsx(corpo: Buffer) {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(corpo as unknown as ArrayBuffer);
  return livro.worksheets.map((planilha) => {
    const linhas: unknown[][] = [];
    let mascararProxima = false;
    planilha.eachRow({ includeEmpty: true }, (linha, n) => {
      const celulas: unknown[] = [];
      linha.eachCell({ includeEmpty: true }, (c) => {
        let valor: unknown = c.value instanceof Date ? c.value.toISOString() : c.value;
        if (mascararProxima && typeof valor === "string") valor = valor.replace(DATA_HORA, "<data-hora>");
        mascararProxima = valor === "Data e hora da extração";
        celulas.push({ v: valor, f: c.formula ?? null, fmt: c.numFmt ?? null, b: c.font?.bold ?? false, fill: (c.fill as { fgColor?: { argb?: string } })?.fgColor?.argb ?? null });
      });
      linhas[n] = celulas;
    });
    return {
      nome: planilha.name,
      larguras: planilha.columns?.map((c) => c.width ?? null) ?? [],
      mesclagens: (planilha.model as { merges?: string[] }).merges ?? [],
      paineis: planilha.views?.map((v) => ({ estado: v.state, x: (v as { xSplit?: number }).xSplit ?? 0, y: (v as { ySplit?: number }).ySplit ?? 0 })) ?? [],
      linhas,
    };
  });
}

async function principal() {
  if (!BASE) throw new Error("Informe --base=<endereço>.");
  const { contas, projetoA, projetoB } = lerContasDeTeste();
  const adm = abrirBancoPostgres(exigir("CRM_BANCO_ADMIN_URL"), { max: 1 });
  const [{ id: comiteDoProjetoA }] = (await adm.execute(sql`select comite_id::text as id from projeto_tema where id = ${projetoA}`)) as unknown as { id: string }[];
  await fecharBanco(adm);
  const periodo = "de=2026-01-01&ate=2026-12-31";
  const resultado: Record<string, unknown> = {};
  const navegador = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const nome of TODAS) {
      const conta = (contas as Record<string, { email: string; senha: string }>)[nome];
      const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
      const p = await contexto.newPage();
      await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await p.getByLabel("E-mail").fill(conta.email);
      await p.getByLabel("Senha").fill(conta.senha);
      await p.getByRole("button", { name: "Entrar", exact: true }).click();
      await p.waitForURL((url) => url.pathname !== "/login", { timeout: 120_000 }).catch(() => undefined);
      const caminhos = ["/paineis", `/paineis/projetos/${projetoA}`, `/paineis/projetos/${projetoB}`];
      if (nome === "administrador" || nome === "gestor") caminhos.push(`/paineis?projeto=${projetoA}`, `/paineis?comite=${comiteDoProjetoA}&${periodo}`);
      if (nome === "administrador" || nome === "leitor") caminhos.push("/paineis/relatorios");
      for (const c of caminhos) resultado[`${nome} ${c.replace(projetoA, "A").replace(projetoB, "B").replace(comiteDoProjetoA, "C")}`] = await pagina(p, c);
      if ((EXPORTAM as readonly string[]).includes(nome)) {
        const filtros = nome === "administrador" ? ["", `?projeto=${projetoA}`, `?${periodo}`] : [""];
        for (const f of filtros) {
          for (const r of RELATORIOS) {
            const resposta = await p.request.get(`${BASE}/paineis/relatorios/${r}${f}`, { maxRedirects: 0, timeout: 120_000 });
            const corpo = await resposta.body();
            const ehXlsx = (resposta.headers()["content-type"] ?? "").includes("spreadsheetml");
            resultado[`${nome} ${r}${f.replace(projetoA, "A")}`] = {
              status: resposta.status(),
              tipo: resposta.headers()["content-type"] ?? "",
              arquivo: resposta.headers()["content-disposition"]?.replace(/\d{4}-\d{2}-\d{2}/g, "<data>") ?? "",
              conteudo: ehXlsx ? await lerXlsx(corpo) : corpo.toString("utf8").replace(/\s+/g, " ").slice(0, 300),
            };
          }
        }
      }
      await contexto.close();
    }
  } finally {
    await navegador.close();
  }
  const pasta = path.join(process.cwd(), ".dados", "hospedagem");
  mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, `equivalencia-paineis-${ROTULO}.json`);
  writeFileSync(arquivo, JSON.stringify(resultado, null, 1));
  const chaves = Object.keys(resultado);
  console.log(`Captura: ${path.relative(process.cwd(), arquivo)} (${chaves.length} itens: ${chaves.filter((k) => /R\d/.test(k)).length} relatórios, ${chaves.filter((k) => !/R\d/.test(k)).length} páginas)`);
  if (COMPARAR) {
    if (!existsSync(COMPARAR)) throw new Error("Arquivo de comparação inexistente.");
    const anterior = JSON.parse(readFileSync(COMPARAR, "utf8")) as Record<string, unknown>;
    const diferentes = [...new Set([...Object.keys(anterior), ...chaves])].filter((k) => JSON.stringify(anterior[k]) !== JSON.stringify(resultado[k]));
    for (const k of diferentes.slice(0, 20)) console.log(`  DIFERENÇA ${k}`);
    console.log(diferentes.length === 0 ? "Equivalência: nenhuma diferença." : `Equivalência: ${diferentes.length} item(ns) diferente(s).`);
    process.exitCode = diferentes.length === 0 ? 0 : 1;
  }
}

principal().catch((erro) => {
  console.error(`Falha na captura: ${erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido"}`);
  process.exitCode = 1;
});
