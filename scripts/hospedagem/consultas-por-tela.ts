/**
 * T3 complementar — comandos do banco por tela na hospedagem (Etapa 7B, D-087), com contas fictícias.
 * Comando: npm run hospedagem:consultas -- --base=<endereço> [--repeticoes=3]
 *
 * Para cada tela aberta no endereço informado, compara as estatísticas do PostgreSQL
 * (pg_stat_statements, somente leitura, sem reiniciar nada) antes e depois de cada carregamento:
 * quantos comandos o papel da aplicação (crm_app) executou, de que tipo (abertura e fim de transação,
 * identificação do usuário, consultas) e quanto tempo o próprio banco gastou neles. O restante do
 * tempo da tela é rede, conexão, função do servidor e navegador. Comandos iguais repetidos num mesmo
 * carregamento são listados (sinal de consultas em série ou do tipo N+1).
 * A leitura das estatísticas usa a conexão administrativa deste computador, que nunca vai para a
 * hospedagem; os textos dos comandos vêm normalizados pelo PostgreSQL, sem valores.
 * Requer que não haja outro uso do CRM durante a medição (o resultado seria somado).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { chromium, type Page } from "playwright-core";
import { abrirBancoPostgres, fecharBanco } from "@/lib/banco/conexao";
import { exigir } from "../backup/comum";
import { lerContasDeTeste } from "../contas-teste";
import { analisarCarregamento, type EventoDeBanco, estatisticas } from "./regras";

const argumento = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const BASE = (argumento("base") ?? process.env.CRM_TESTE_BASE_URL ?? "").replace(/\/$/, "");
const REPETICOES = Number(argumento("repeticoes") ?? 3);
// --instrumentacao=<arquivo>: eventos gravados pelo servidor do laboratório (CRM_INSTRUMENTACAO), para
// decompor o tempo de banco de cada carregamento. --telas=<lista>: só as telas indicadas (parte do nome).
const INSTRUMENTACAO = argumento("instrumentacao");
const FILTRO_TELAS = argumento("telas")?.split(",").map((t) => t.trim().toLowerCase());
const ROTULO = argumento("rotulo") ?? "medicao";
const lerEventos = (): EventoDeBanco[] =>
  INSTRUMENTACAO && existsSync(INSTRUMENTACAO)
    ? readFileSync(INSTRUMENTACAO, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as EventoDeBanco)
    : [];

type Contador = { texto: string; comandos: number; ms: number };

/** Classe do comando, pelo texto normalizado. */
function classeDoComando(texto: string): "abertura" | "fim" | "identidade" | "conexao" | "consulta" {
  const t = texto.trim().toLowerCase();
  // O driver lê o catálogo de tipos uma vez a cada conexão nova: conta conexões abertas.
  if (t.includes("pg_catalog.pg_type")) return "conexao";
  if (/^(begin|start transaction)\b/.test(t)) return "abertura";
  if (/^(commit|rollback|end)\b/.test(t)) return "fim";
  if (t.includes("set_config") || t.includes("identificar_usuario") || /^set\s/.test(t)) return "identidade";
  return "consulta";
}

async function principal() {
  if (!BASE) throw new Error("Informe --base=<endereço> ou CRM_TESTE_BASE_URL.");
  const banco = abrirBancoPostgres(exigir("CRM_BANCO_ADMIN_URL"), { max: 1 });
  const instantaneo = async (): Promise<Map<string, Contador>> => {
    const linhas = (await banco.execute(sql`
      select s.queryid::text as id, left(s.query, 400) as texto, s.calls::bigint as comandos, s.total_exec_time::float8 as ms
        from pg_stat_statements s join pg_roles r on r.oid = s.userid
       where r.rolname = 'crm_app'`)) as unknown as { id: string; texto: string; comandos: string | number; ms: number }[];
    return new Map(linhas.map((l) => [l.id, { texto: l.texto, comandos: Number(l.comandos), ms: Number(l.ms) }]));
  };
  const diferenca = (antes: Map<string, Contador>, depois: Map<string, Contador>) => {
    const lista: Contador[] = [];
    for (const [id, d] of depois) {
      const a = antes.get(id);
      const comandos = d.comandos - (a?.comandos ?? 0);
      if (comandos > 0) lista.push({ texto: d.texto, comandos, ms: d.ms - (a?.ms ?? 0) });
    }
    return lista;
  };

  const { contas, projetoA } = lerContasDeTeste();
  const navegador = await chromium.launch({ channel: "msedge", headless: true });
  const pagina: Page = await (await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" })).newPage();
  const telas: [string, string, boolean][] = [
    ["visão executiva", "/paineis", false],
    ["painel do projeto", `/paineis/projetos/${projetoA}`, false],
    ["projeto ou tema", `/projetos-temas/${projetoA}`, false],
    ["matriz de stakeholders", `/projetos-temas/${projetoA}/matriz`, false],
    ["pessoas", "/pessoas", false],
    ["planos de ação", "/planos", false],
    ["R1 em XLSX", "/paineis/relatorios/R1", true],
    ["relatórios (página)", "/paineis/relatorios", false],
    ["R2 em XLSX", "/paineis/relatorios/R2", true],
    ["R3 em XLSX", "/paineis/relatorios/R3", true],
    ["R4 em XLSX", "/paineis/relatorios/R4", true],
    ["R5 em XLSX", "/paineis/relatorios/R5", true],
  ].filter(([nome]) => !FILTRO_TELAS || FILTRO_TELAS.some((f) => String(nome).toLowerCase().includes(f))) as [string, string, boolean][];
  type Medida = { comandos: number; abertura: number; fim: number; identidade: number; conexao: number; consulta: number; consultasDistintas: number; msBanco: number; msTela: number; repetidos: Contador[]; lista: Contador[]; banco?: ReturnType<typeof analisarCarregamento> };
  const resultados: { tela: string; medidas: Medida[] }[] = [];
  try {
    await pagina.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await pagina.getByLabel("E-mail").fill(contas.administrador.email);
    await pagina.getByLabel("Senha").fill(contas.administrador.senha);
    await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
    await pagina.waitForURL((url) => url.pathname !== "/login", { timeout: 120_000 });
    await pagina.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 120_000 }).catch(() => undefined);
    await pagina.waitForTimeout(3000);
    for (const [tela, caminho, arquivo] of telas) {
      const medidas: Medida[] = [];
      for (let i = 0; i < REPETICOES; i++) {
        const antes = await instantaneo();
        const inicio = Date.now();
        if (arquivo) {
          await (await pagina.request.get(`${BASE}${caminho}`, { timeout: 120_000 })).body();
        } else {
          await pagina.goto(`${BASE}${caminho}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
          await pagina.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 120_000 }).catch(() => undefined);
        }
        const fimDoCarregamento = Date.now();
        const msTela = fimDoCarregamento - inicio;
        await pagina.waitForTimeout(2500); // as estatísticas são gravadas ao fim de cada comando
        const lista = diferenca(antes, await instantaneo());
        const soma = (classe: string) => lista.filter((c) => classeDoComando(c.texto) === classe).reduce((t, c) => t + c.comandos, 0);
        medidas.push({
          comandos: lista.reduce((t, c) => t + c.comandos, 0),
          abertura: soma("abertura"),
          fim: soma("fim"),
          identidade: soma("identidade"),
          conexao: soma("conexao"),
          consulta: soma("consulta"),
          consultasDistintas: lista.filter((c) => classeDoComando(c.texto) === "consulta").length,
          msBanco: Math.round(lista.reduce((t, c) => t + c.ms, 0)),
          msTela,
          repetidos: lista.filter((c) => classeDoComando(c.texto) === "consulta" && c.comandos > 1).sort((a, b) => b.comandos - a.comandos),
          lista: lista.map((c) => ({ ...c, texto: c.texto.replace(/\s+/g, " ").slice(0, 300), ms: Math.round(c.ms * 10) / 10 })),
          banco: INSTRUMENTACAO ? analisarCarregamento(lerEventos(), inicio, fimDoCarregamento) : undefined,
        });
      }
      resultados.push({ tela, medidas });
    }
  } finally {
    await navegador.close();
    await fecharBanco(banco);
  }

  const faixa = (valores: number[]) => {
    const e = estatisticas(valores);
    return e.minimo === e.maximo ? `${e.mediana}` : `${e.mediana} [${e.minimo}–${e.maximo}]`;
  };
  console.log(`Comandos do banco por carregamento (${REPETICOES} repetições; mediana [mínimo–máximo])`);
  console.log("| Tela | Comandos | Transações (abertura/fim) | Identificação | Conexões novas | Consultas do CRM (distintas) | Tempo no banco (ms) | Tela completa (ms) |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const { tela, medidas } of resultados) {
    const m = (campo: keyof Omit<Medida, "repetidos" | "lista" | "banco">) => faixa(medidas.map((x) => x[campo]));
    console.log(`| ${tela} | ${m("comandos")} | ${m("abertura")} / ${m("fim")} | ${m("identidade")} | ${m("conexao")} | ${m("consulta")} (${m("consultasDistintas")}) | ${m("msBanco")} | ${m("msTela")} |`);
  }
  if (INSTRUMENTACAO) {
    const lab = path.join(process.cwd(), ".dados", "hospedagem", "laboratorio.json");
    const idaEVolta = existsSync(lab) ? (JSON.parse(readFileSync(lab, "utf8")) as { idaEVoltaMs: number }).idaEVoltaMs : 0;
    console.log(`\nDecomposição do tempo (instrumentação; ida e volta do laboratório: ${idaEVolta} ms; mediana [mínimo–máximo])`);
    console.log("| Tela | Tela completa | Antes do banco | Banco no relógio (união) | Depois do banco | Transações | Paralelismo (x10) | Espera+BEGIN | Identidade | Consultas | COMMIT | Idas e voltas em série (estim.) |");
    console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const { tela, medidas } of resultados) {
      const b = medidas.map((x) => x.banco).filter((x): x is NonNullable<typeof x> => Boolean(x));
      if (b.length === 0) continue;
      const f = (sel: (x: (typeof b)[number]) => number) => faixa(b.map(sel));
      const serie = idaEVolta ? f((x) => Math.round(x.uniaoMs / idaEVolta)) : "-";
      console.log(`| ${tela} | ${faixa(medidas.map((x) => x.msTela))} | ${f((x) => x.antesDoBancoMs)} | ${f((x) => x.uniaoMs)} | ${f((x) => x.depoisDoBancoMs)} | ${f((x) => x.transacoes)} | ${f((x) => Math.round(x.paralelismo * 10))} | ${f((x) => x.fases.espera)} | ${f((x) => x.fases.identidade)} | ${f((x) => x.fases.consultas)} | ${f((x) => x.fases.encerramento)} | ${serie} |`);
    }
  }
  console.log("\nConsultas repetidas no mesmo carregamento (última repetição; texto normalizado, sem valores):");
  for (const { tela, medidas } of resultados) {
    const repetidos = medidas.at(-1)?.repetidos ?? [];
    if (repetidos.length === 0) continue;
    console.log(`  ${tela}:`);
    for (const r of repetidos.slice(0, 6)) console.log(`    ${String(r.comandos).padStart(3)}× ${r.texto.replace(/\s+/g, " ").slice(0, 150)}`);
  }
  const pasta = path.join(process.cwd(), ".dados", "hospedagem");
  mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, `consultas-${ROTULO}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(arquivo, JSON.stringify({ base: BASE, repeticoes: REPETICOES, quando: new Date().toISOString(), resultados }, null, 2));
  console.log(`Resultados: ${path.relative(process.cwd(), arquivo)}`);
}

principal().catch((erro) => {
  console.error(`Falha na medição: ${erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido"}`);
  process.exitCode = 1;
});
