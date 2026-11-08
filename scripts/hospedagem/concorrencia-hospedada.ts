/**
 * P-071, E7 — consistência dos painéis e do relatório R1 no endereço publicado, com dados mudando
 * durante as leituras (PostgreSQL em READ COMMITTED). Contas e dados fictícios.
 * Comando: npm run hospedagem:concorrencia -- --base=<endereço>
 *
 * 1. Sem gravações: três downloads simultâneos do R1 devolvem o mesmo conteúdo.
 * 2. Com gravações: enquanto uma iniciativa fictícia em curso é incluída no projeto A e, segundos depois,
 *    arquivada, o R1 é baixado e o painel é aberto várias vezes em paralelo. Cada arquivo vê a iniciativa
 *    ou não a vê: o total de "Iniciativas em curso" varia 0 ou 1 e a linha do comitê principal do
 *    projeto A varia exatamente o mesmo (sem estado intermediário entre leituras do mesmo arquivo).
 * 3. Depois do arquivamento, R1 e painel voltam a ser idênticos aos de antes.
 * A gravação usa a conexão administrativa deste computador com a identidade do administrador fictício;
 * nada é excluído (a iniciativa fica arquivada). Senhas e valores sensíveis não são exibidos.
 */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { chromium, type Page } from "playwright-core";
import { abrirBancoPostgres, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { criarIniciativa, definirArquivamentoIniciativa } from "@/modulos/iniciativas/consultas";
import { exigir } from "../backup/comum";
import { lerContasDeTeste } from "../contas-teste";

const argumento = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const BASE = (argumento("base") ?? "").replace(/\/$/, "");
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
let falhas = 0;
const conferir = (ok: boolean, descricao: string) => {
  console.log(`  [${ok ? "OK" : "FALHA"}] ${descricao}`);
  if (!ok) falhas++;
};

type Panorama = { linhas: Map<string, number>; total: number; assinatura: string };

async function baixarR1(p: Page): Promise<Panorama> {
  const resposta = await p.request.get(`${BASE}/paineis/relatorios/R1`, { timeout: 120_000 });
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load((await resposta.body()) as unknown as ArrayBuffer);
  const aba = livro.getWorksheet("Panorama");
  if (!aba) throw new Error("R1 sem a aba Panorama.");
  const cabecalho = (aba.getRow(1).values as unknown[]).map(String);
  const coluna = cabecalho.indexOf("Iniciativas em curso");
  const linhas = new Map<string, number>();
  const conteudo: unknown[] = [];
  aba.eachRow((linha, n) => {
    conteudo.push(linha.values);
    if (n > 1) linhas.set(String(linha.getCell(1).value), Number(linha.getCell(coluna).value ?? 0));
  });
  const total = [...linhas.entries()].at(-1)?.[1] ?? 0;
  return { linhas, total, assinatura: JSON.stringify(conteudo) };
}

async function textoDoPainel(p: Page) {
  await p.goto(`${BASE}/paineis`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await p.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 120_000 }).catch(() => undefined);
  return p.evaluate(() => (document.querySelector("main") ?? document.body).innerText.replace(/\s+/g, " ").trim());
}

async function principal() {
  if (!BASE) throw new Error("Informe --base=<endereço>.");
  const { contas, projetoA } = lerContasDeTeste();
  const adm = abrirBancoPostgres(exigir("CRM_BANCO_ADMIN_URL"), { max: 2 });
  const navegador = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const [{ id: administradorId }] = (await adm.execute(
      sql`select id::text as id from usuario where lower(email) = lower(${contas.administrador.email})`,
    )) as unknown as { id: string }[];
    const [{ comite }] = (await adm.execute(
      sql`select c.nome as comite from projeto_tema p join comite c on c.id = p.comite_id where p.id = ${projetoA}`,
    )) as unknown as { comite: string }[];
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
    const pagina = await contexto.newPage();
    await pagina.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await pagina.getByLabel("E-mail").fill(contas.administrador.email);
    await pagina.getByLabel("Senha").fill(contas.administrador.senha);
    await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
    await pagina.waitForURL((url) => url.pathname !== "/login", { timeout: 120_000 });

    console.log("1. Sem gravações: downloads simultâneos");
    const simultaneos = await Promise.all([baixarR1(pagina), baixarR1(pagina), baixarR1(pagina)]);
    conferir(simultaneos.every((r) => r.assinatura === simultaneos[0].assinatura), "três downloads simultâneos do R1 com o mesmo conteúdo");
    const antes = simultaneos[0];
    const painelAntes = await textoDoPainel(pagina);

    console.log("2. Com gravações durante as leituras");
    const titulo = `Iniciativa de concorrência E7 ${randomUUID().slice(0, 8)}`;
    let novaId = "";
    const escritor = (async () => {
      await espera(800);
      novaId = await comoUsuario(adm, administradorId, (tx) =>
        criarIniciativa(tx, { tipo: "demanda", titulo, situacao: "em_andamento", dataAbertura: hojeEmBrasilia(), projetos: [projetoA] } as never),
      );
      await espera(5000);
      await comoUsuario(adm, administradorId, (tx) => definirArquivamentoIniciativa(tx, novaId, true));
    })();
    const leituras = [0, 1500, 3000, 4500, 6500, 8000].map(async (ms) => {
      await espera(ms);
      return baixarR1(pagina);
    });
    const resultados = await Promise.all([escritor, ...leituras]).then(([, ...r]) => r as Panorama[]);
    for (const [i, r] of resultados.entries()) {
      const dTotal = r.total - antes.total;
      const dComite = (r.linhas.get(comite) ?? 0) - (antes.linhas.get(comite) ?? 0);
      conferir((dTotal === 0 || dTotal === 1) && dComite === dTotal, `R1 nº ${i + 1}: variação do total ${dTotal} e da linha do comitê do projeto A ${dComite}`);
    }

    console.log("3. Depois do arquivamento");
    await espera(1000);
    const depois = await baixarR1(pagina);
    conferir(depois.assinatura === antes.assinatura, "R1 idêntico ao de antes");
    conferir((await textoDoPainel(pagina)) === painelAntes, "painel idêntico ao de antes");
    conferir(novaId !== "", "iniciativa fictícia incluída e arquivada");
  } finally {
    await navegador.close();
    await fecharBanco(adm);
  }
  console.log(falhas === 0 ? "Concorrência: todas as conferências passaram." : `Concorrência: ${falhas} falha(s).`);
  process.exitCode = falhas === 0 ? 0 : 1;
}

principal().catch((erro) => {
  console.error(`Falha na conferência: ${erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido"}`);
  process.exitCode = 1;
});
