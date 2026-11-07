/**
 * Painéis e relatórios em navegador de verdade (Edge, sem janela), com login real no Supabase Auth e a
 * aplicação compilada. Quem digita as senhas é este programa, com as contas fictícias de
 * .dados/contas-teste.json. Antes: npm run build. Somente dados fictícios; nada é gravado.
 *
 * Cobre as telas por perfil, o download real dos arquivos, a chamada direta ao endereço do relatório
 * (a recusa é do servidor, e não só da tela) e a ausência de dados de outro projeto.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type ContaDeTeste, lerContasDeTeste } from "../../scripts/contas-teste";

const PORTA = 3211;
const BASE = `http://127.0.0.1:${PORTA}`;
const PASTA_TELAS = path.join(process.cwd(), ".dados", "telas-etapa-6");
const PASTA_ARQUIVOS = path.join(PASTA_TELAS, "arquivos");
const NOME_A = "Corredor Logístico Exemplo";
const NOME_B = "Ampliação do Porto Modelo";
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const { contas, projetoA, projetoB } = lerContasDeTeste();
let servidor: ChildProcess;
let navegador: Browser;

async function aguardarServidor() {
  for (let tentativa = 0; tentativa < 120; tentativa++) {
    try {
      const resposta = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (resposta.status < 500) return;
    } catch {
      // Ainda iniciando.
    }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  throw new Error("A aplicação não iniciou.");
}

beforeAll(async () => {
  if (!existsSync(path.join(process.cwd(), ".next", "BUILD_ID"))) throw new Error("Rode npm run build antes destes testes.");
  mkdirSync(PASTA_ARQUIVOS, { recursive: true });
  const ambiente = { ...process.env, NODE_ENV: "production", PORT: String(PORTA) } as NodeJS.ProcessEnv;
  servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(PORTA)], { env: ambiente, stdio: "ignore" });
  await aguardarServidor();
  navegador = await chromium.launch({ channel: "msedge", headless: true });
});

afterAll(async () => {
  await navegador?.close();
  servidor?.kill();
});

async function entrar(conta: ContaDeTeste, destino = "/paineis"): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR", acceptDownloads: true });
  const pagina = await contexto.newPage();
  await pagina.goto(`${BASE}/login?destino=${encodeURIComponent(destino)}`);
  await pagina.getByLabel("E-mail").fill(conta.email);
  await pagina.getByLabel("Senha").fill(conta.senha);
  await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
  await pagina.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 });
  return { contexto, pagina };
}

async function textoDaPagina(pagina: Page) {
  await pagina.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 90_000 }).catch(() => undefined);
  return pagina.locator("body").innerText();
}

const tela = (pagina: Page, nome: string) => pagina.screenshot({ path: path.join(PASTA_TELAS, `${nome}.png`), fullPage: true });

async function linhasDoArquivo(conteudo: Buffer) {
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(conteudo as never);
  const abas = new Map<string, string[][]>();
  pasta.eachSheet((aba) => {
    const linhas: string[][] = [];
    aba.eachRow((linha) => linhas.push(Array.from((linha.values as unknown[]).slice(1), (v) => (v === null || v === undefined ? "" : String(v)))));
    abas.set(aba.name, linhas);
  });
  return abas;
}

/** Baixa pelo botão da tela, como o usuário faria, e devolve o conteúdo do arquivo. */
async function baixarPelaTela(pagina: Page, titulo: string, nome: string) {
  const item = pagina.locator("li", { hasText: titulo });
  const [download] = await Promise.all([pagina.waitForEvent("download", { timeout: 90_000 }), item.getByRole("link", { name: "Exportar XLSX" }).click()]);
  const destino = path.join(PASTA_ARQUIVOS, nome);
  await download.saveAs(destino);
  return { conteudo: readFileSync(destino), sugerido: download.suggestedFilename() };
}

/** Chamada direta ao endereço do relatório, com a sessão do navegador. */
const chamar = (pagina: Page, caminho: string) => pagina.request.get(`${BASE}${caminho}`, { maxRedirects: 0 });

describe("Sem sessão", () => {
  test("painéis, relatórios e arquivos levam ao login", async () => {
    for (const caminho of ["/paineis", "/paineis/relatorios", `/paineis/projetos/${projetoA}`, "/paineis/relatorios/R1"]) {
      const resposta = await fetch(`${BASE}${caminho}`, { redirect: "manual" });
      expect(resposta.status, caminho).toBeGreaterThanOrEqual(300);
      expect(resposta.status, caminho).toBeLessThan(400);
      expect(resposta.headers.get("location"), caminho).toContain("/login");
    }
  });
});

describe("Administrador", () => {
  test("vê a visão executiva, o projeto e exporta todos os relatórios", async () => {
    const { contexto, pagina } = await entrar(contas.administrador);
    try {
      const texto = await textoDaPagina(pagina);
      expect(texto).toContain("Painéis executivos");
      expect(texto).toContain("Panorama por comitê");
      expect(texto).toContain("Total geral");
      expect(texto).toContain(NOME_A);
      expect(texto).toContain(NOME_B);
      expect(texto).toContain("Regra provisória P-049");
      await tela(pagina, "01-administrador-visao-executiva");

      await pagina.goto(`${BASE}/paineis/projetos/${projetoA}`);
      const doProjeto = await textoDaPagina(pagina);
      expect(doProjeto).toContain(NOME_A);
      expect(doProjeto).toContain("Risco inerente");
      expect(doProjeto).toContain("Risco residual");
      expect(doProjeto).toContain("Versões ainda não aprovadas");
      await tela(pagina, "02-administrador-projeto");

      await pagina.goto(`${BASE}/paineis/relatorios`);
      await textoDaPagina(pagina);
      await tela(pagina, "03-administrador-relatorios");

      for (const [titulo, codigo] of [["R1 —", "R1"], ["R2 —", "R2"], ["R3 —", "R3"], ["R4 —", "R4"], ["R5 —", "R5"]]) {
        const { conteudo, sugerido } = await baixarPelaTela(pagina, titulo, `administrador-${codigo}.xlsx`);
        expect(sugerido).toMatch(new RegExp(`^crm-${codigo}-.*\\.xlsx$`));
        const abas = await linhasDoArquivo(conteudo);
        const extracao = new Map((abas.get("Extração") ?? []).map((l) => [l[0], l[1]]));
        expect(extracao.get("Usuário responsável")).toBeTruthy();
        expect(extracao.get("Data e hora da extração")).toBeTruthy();
      }
      const r5 = await linhasDoArquivo(readFileSync(path.join(PASTA_ARQUIVOS, "administrador-R5.xlsx")));
      expect(r5.has("Avaliações nominais")).toBe(true);
    } finally {
      await contexto.close();
    }
  });
});

describe("Gestor do projeto A", () => {
  test("painel e arquivos só de A; R5 nominal; projeto B inexistente, também por endereço", async () => {
    const { contexto, pagina } = await entrar(contas.gestor);
    try {
      const texto = await textoDaPagina(pagina);
      expect(texto).toContain(NOME_A);
      expect(texto).not.toContain(NOME_B);
      await tela(pagina, "04-gestor-visao-executiva");

      // Impressão pelo próprio navegador: nenhum serviço de geração de documentos.
      const pdf = await pagina.pdf({ path: path.join(PASTA_ARQUIVOS, "gestor-visao-executiva.pdf"), format: "A4", printBackground: true });
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      const larguras = await pagina.evaluate(() => {
        const tabela = document.querySelector("[data-teste=panorama]");
        return { tabela: tabela?.scrollWidth ?? 0, pai: tabela?.parentElement?.clientWidth ?? 0 };
      });
      expect(larguras.tabela).toBeLessThanOrEqual(larguras.pai);
      await pagina.setViewportSize({ width: 794, height: 1123 });
      await pagina.emulateMedia({ media: "print" });
      await tela(pagina, "10-gestor-impressao");
      await pagina.emulateMedia({ media: "screen" });
      await pagina.setViewportSize({ width: 1280, height: 900 });

      await pagina.goto(`${BASE}/paineis/projetos/${projetoB}`);
      expect(await textoDaPagina(pagina)).not.toContain(NOME_B);
      await tela(pagina, "05-gestor-projeto-proibido");

      await pagina.goto(`${BASE}/paineis/relatorios`);
      await textoDaPagina(pagina);
      for (const codigo of ["R1", "R2", "R3", "R4", "R5"]) {
        const { conteudo } = await baixarPelaTela(pagina, `${codigo} —`, `gestor-${codigo}.xlsx`);
        const abas = await linhasDoArquivo(conteudo);
        expect([...abas.values()].flat(2).join("\n"), codigo).not.toContain(NOME_B);
        if (codigo === "R5") expect(abas.has("Avaliações nominais")).toBe(true);
      }

      // Mesmo pedindo B no endereço, o arquivo não traz B.
      const pedido = await chamar(pagina, `/paineis/relatorios/R3?projeto=${projetoB}`);
      expect(pedido.status()).toBe(200);
      const comFiltro = await linhasDoArquivo(Buffer.from(await pedido.body()));
      const tudo = [...comFiltro.values()].flat(2).join("\n");
      expect(tudo).not.toContain(NOME_B);
      expect(comFiltro.get("Ações")).toHaveLength(1);
    } finally {
      await contexto.close();
    }
  });

  test("cabeçalhos do arquivo: anexo, tipo correto e sem guardar em cache", async () => {
    const { contexto, pagina } = await entrar(contas.gestor);
    try {
      const resposta = await chamar(pagina, "/paineis/relatorios/R1");
      expect(resposta.status()).toBe(200);
      expect(resposta.headers()["content-type"]).toBe(TIPO_XLSX);
      expect(resposta.headers()["content-disposition"]).toMatch(/^attachment; filename="crm-R1-/);
      expect(resposta.headers()["cache-control"]).toContain("no-store");
      expect((await chamar(pagina, "/paineis/relatorios/R9")).status()).toBe(404);
    } finally {
      await contexto.close();
    }
  });
});

describe("Colaborador do projeto A", () => {
  test("exporta, mas R5 só com contagens, sem nomes de stakeholders", async () => {
    const { contexto, pagina } = await entrar(contas.colaborador, "/paineis/relatorios");
    try {
      const texto = await textoDaPagina(pagina);
      expect(texto).toContain("Exportar XLSX");
      expect(texto).toContain("só onde você é gestor");
      await tela(pagina, "06-colaborador-relatorios");
      const { conteudo } = await baixarPelaTela(pagina, "R5 —", "colaborador-R5.xlsx");
      const abas = await linhasDoArquivo(conteudo);
      expect([...abas.keys()]).toEqual(["Extração", "Contagens"]);
      expect((abas.get("Contagens") ?? []).slice(1).map((l) => l[0])).toEqual([NOME_A]);
      const r3 = await chamar(pagina, "/paineis/relatorios/R3");
      expect(r3.status()).toBe(200);
      expect([...(await linhasDoArquivo(Buffer.from(await r3.body()))).values()].flat(2).join("\n")).not.toContain(NOME_B);
    } finally {
      await contexto.close();
    }
  });
});

describe("Leitor do projeto A", () => {
  test("consulta os painéis; sem botão de exportação; o servidor recusa a chamada direta", async () => {
    const { contexto, pagina } = await entrar(contas.leitor);
    try {
      const texto = await textoDaPagina(pagina);
      expect(texto).toContain("Panorama por comitê");
      expect(texto).toContain(NOME_A);
      expect(texto).not.toContain(NOME_B);
      await tela(pagina, "07-leitor-visao-executiva");

      await pagina.goto(`${BASE}/paineis/relatorios`);
      const relatorios = await textoDaPagina(pagina);
      expect(relatorios).not.toContain("Exportar XLSX");
      expect(relatorios).toContain("não impede capturas ou impressões feitas pelo próprio navegador");
      await tela(pagina, "08-leitor-sem-exportacao");

      for (const codigo of ["R1", "R2", "R3", "R4", "R5"]) {
        const resposta = await chamar(pagina, `/paineis/relatorios/${codigo}`);
        expect(resposta.status(), codigo).toBe(403);
        expect(resposta.headers()["content-type"], codigo).not.toContain("spreadsheet");
      }
      // A impressão continua sendo do navegador: o botão existe e os filtros somem no papel.
      expect(await pagina.getByRole("button", { name: "Imprimir ou salvar em PDF" }).count()).toBe(1);
      await pagina.emulateMedia({ media: "print" });
      expect(await pagina.locator("form[role=search]").isVisible()).toBe(false);
      await pagina.emulateMedia({ media: "screen" });
    } finally {
      await contexto.close();
    }
  });
});

describe("Outros casos", () => {
  test("gestor de outro projeto vê só B, e nem pede arquivo de A", async () => {
    const { contexto, pagina } = await entrar(contas.gestorOutroProjeto);
    try {
      const texto = await textoDaPagina(pagina);
      expect(texto).toContain(NOME_B);
      expect(texto).not.toContain(NOME_A);
      const pedido = await chamar(pagina, `/paineis/relatorios/R2?projeto=${projetoA}`);
      expect(pedido.status()).toBe(200);
      const abas = await linhasDoArquivo(Buffer.from(await pedido.body()));
      expect([...abas.values()].flat(2).join("\n")).not.toContain(NOME_A);
      expect(abas.get("Compromissos")).toHaveLength(1);
    } finally {
      await contexto.close();
    }
  });

  test("permissão vencida ou revogada: sem acesso e sem arquivo", async () => {
    for (const conta of [contas.permissaoVencida, contas.permissaoRevogada]) {
      const { contexto, pagina } = await entrar(conta);
      try {
        const texto = await textoDaPagina(pagina);
        expect(texto).not.toContain(NOME_A);
        expect(texto).not.toContain(NOME_B);
        expect((await chamar(pagina, "/paineis/relatorios/R1")).status()).toBeGreaterThanOrEqual(300);
      } finally {
        await contexto.close();
      }
    }
  });

  test("em tela de celular, a visão executiva não transborda a página", async () => {
    const { contexto, pagina } = await entrar(contas.gestor);
    try {
      await textoDaPagina(pagina);
      await pagina.setViewportSize({ width: 390, height: 800 });
      await pagina.waitForTimeout(300);
      const transborda = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(transborda).toBeLessThanOrEqual(1);
      await tela(pagina, "09-gestor-celular");
    } finally {
      await contexto.close();
    }
  });
});
