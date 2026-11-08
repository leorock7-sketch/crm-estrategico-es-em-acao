/**
 * P-071, E2 — equivalência funcional da página de projeto ou tema, com contas fictícias.
 * Comando: npm run hospedagem:equivalencia -- --base=<endereço> --rotulo=<nome> [--comparar=<arquivo>]
 *
 * Para cada conta de teste (quatro perfis no projeto A, gestor de outro projeto, permissões vencida e
 * revogada, sem permissão), entra no CRM e abre as páginas dos projetos A e B, registrando: situação
 * HTTP, endereço final, texto visível do conteúdo principal e controles disponíveis (botões, links e
 * formulários). Grava em .dados/hospedagem/equivalencia-<rótulo>.json (fora do Git) e, com --comparar,
 * aponta qualquer diferença em relação a uma captura anterior. Não grava nada no CRM; senhas não são
 * exibidas. O conteúdo capturado é fictício e fica só neste computador.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { lerContasDeTeste } from "../contas-teste";

const argumento = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const BASE = (argumento("base") ?? process.env.CRM_TESTE_BASE_URL ?? "").replace(/\/$/, "");
const ROTULO = argumento("rotulo") ?? "captura";
const COMPARAR = argumento("comparar");
const CONTAS = ["administrador", "gestor", "colaborador", "leitor", "gestorOutroProjeto", "permissaoVencida", "permissaoRevogada", "semPermissao"] as const;

type Captura = { status: number; final: string; texto: string; controles: string[] };

async function principal() {
  if (!BASE) throw new Error("Informe --base=<endereço>.");
  const { contas, projetoA, projetoB } = lerContasDeTeste();
  const navegador = await chromium.launch({ channel: "msedge", headless: true });
  const resultado: Record<string, Record<string, Captura>> = {};
  try {
    for (const nome of CONTAS) {
      const conta = (contas as Record<string, { email: string; senha: string }>)[nome];
      if (!conta) continue;
      const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
      const pagina = await contexto.newPage();
      await pagina.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await pagina.getByLabel("E-mail").fill(conta.email);
      await pagina.getByLabel("Senha").fill(conta.senha);
      await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
      await pagina.waitForURL((url) => url.pathname !== "/login", { timeout: 120_000 }).catch(() => undefined);
      resultado[nome] = {};
      for (const [rotulo, id] of [["projetoA", projetoA], ["projetoB", projetoB]] as const) {
        const resposta = await pagina.goto(`${BASE}/projetos-temas/${id}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await pagina.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 120_000 }).catch(() => undefined);
        await pagina.waitForTimeout(500);
        resultado[nome][rotulo] = await pagina.evaluate((status) => {
          const principal = document.querySelector("main") ?? document.body;
          const controles = [...principal.querySelectorAll("a, button, form, input, select, textarea")].map((el) => {
            const e = el as HTMLElement & { href?: string; name?: string; type?: string; action?: string };
            const destino = e.tagName === "A" && e.href ? new URL(e.href).pathname : "";
            return [e.tagName.toLowerCase(), e.name ?? "", e.type ?? "", destino, (e.innerText ?? "").replace(/\s+/g, " ").trim()].join("|");
          });
          return { status, final: location.pathname, texto: principal.innerText.replace(/\s+/g, " ").trim(), controles };
        }, resposta?.status() ?? 0);
      }
      await contexto.close();
    }
  } finally {
    await navegador.close();
  }
  const pasta = path.join(process.cwd(), ".dados", "hospedagem");
  mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, `equivalencia-${ROTULO}.json`);
  writeFileSync(arquivo, JSON.stringify(resultado, null, 2));
  console.log(`Captura: ${path.relative(process.cwd(), arquivo)}`);
  for (const [conta, paginas] of Object.entries(resultado)) {
    console.log(`  ${conta.padEnd(19)} ${Object.entries(paginas).map(([p, c]) => `${p}: HTTP ${c.status} ${c.final.startsWith("/projetos-temas/") ? "projeto" : c.final} (${c.texto.length} car., ${c.controles.length} controles)`).join(" · ")}`);
  }
  if (COMPARAR) {
    if (!existsSync(COMPARAR)) throw new Error("Arquivo de comparação inexistente.");
    const anterior = JSON.parse(readFileSync(COMPARAR, "utf8")) as typeof resultado;
    let diferencas = 0;
    for (const conta of Object.keys({ ...anterior, ...resultado })) {
      for (const p of ["projetoA", "projetoB"]) {
        const a = anterior[conta]?.[p];
        const b = resultado[conta]?.[p];
        for (const campo of ["status", "final", "texto"] as const) {
          if (JSON.stringify(a?.[campo]) !== JSON.stringify(b?.[campo])) {
            diferencas++;
            console.log(`  DIFERENÇA ${conta}/${p}/${campo}`);
          }
        }
        if (JSON.stringify(a?.controles) !== JSON.stringify(b?.controles)) {
          diferencas++;
          console.log(`  DIFERENÇA ${conta}/${p}/controles`);
        }
      }
    }
    console.log(diferencas === 0 ? "Equivalência: nenhuma diferença." : `Equivalência: ${diferencas} diferença(s).`);
    process.exitCode = diferencas === 0 ? 0 : 1;
  }
}

principal().catch((erro) => {
  console.error(`Falha na captura: ${erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido"}`);
  process.exitCode = 1;
});
