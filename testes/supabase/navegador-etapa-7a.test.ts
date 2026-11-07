/**
 * Fase 7A no navegador de verdade (Edge, sem janela), com login real no Supabase Auth e a aplicação
 * compilada (antes: npm run build). Somente dados e contas fictícios.
 *
 * - P-056: conta com senha provisória só acessa a troca de senha até defini-la; vale para a conta nova
 *   e para a senha redefinida pelo administrador. Operações e arquivos também ficam bloqueados.
 * - Pendência da D-078: quem só consulta não recebe formulário nas páginas de inclusão e alteração
 *   abertas por endereço direto.
 * A conta criada aqui é suspensa ao final (nada é excluído).
 */
import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type Browser, chromium, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBancoPostgres, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { permissaoContexto, usuario } from "@/lib/banco/esquema";
import { criarConta, gerarSenhaProvisoria, redefinirSenha, suspenderConta } from "@/lib/autenticacao/administracao";
import { type ContaDeTeste, lerContasDeTeste } from "../../scripts/contas-teste";

const PORTA = 3212;
// Com CRM_TESTE_BASE_URL, roda contra um servidor já ligado (teste local de compatibilidade com o
// Netlify, D-082) em vez de iniciar o next start.
const EXTERNO = process.env.CRM_TESTE_BASE_URL;
const BASE = EXTERNO ?? `http://127.0.0.1:${PORTA}`;
const PASTA_TELAS = path.join(process.cwd(), ".dados", "telas-etapa-7a");
const sufixo = randomUUID().slice(0, 8);
const { contas, projetoA } = lerContasDeTeste();

let servidor: ChildProcess;
let navegador: Browser;
let adm: Banco;
let authIdNova: string | undefined;
let usuarioIdNovo: string | undefined;

async function aguardarServidor() {
  for (let tentativa = 0; tentativa < 120; tentativa++) {
    try {
      if ((await fetch(`${BASE}/login`, { redirect: "manual" })).status < 500) return;
    } catch {
      // Ainda iniciando.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("A aplicação não iniciou.");
}

beforeAll(async () => {
  if (!EXTERNO && !existsSync(path.join(process.cwd(), ".next", "BUILD_ID"))) throw new Error("Rode npm run build antes destes testes.");
  mkdirSync(PASTA_TELAS, { recursive: true });
  adm = abrirBancoPostgres(process.env.CRM_BANCO_ADMIN_URL as string, { max: 2 });
  if (!EXTERNO) {
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(PORTA)], {
      env: { ...process.env, NODE_ENV: "production", PORT: String(PORTA) } as NodeJS.ProcessEnv,
      stdio: "ignore",
    });
  }
  await aguardarServidor();
  navegador = await chromium.launch({ channel: "msedge", headless: true });
});

afterAll(async () => {
  if (authIdNova) await suspenderConta(authIdNova).catch(() => undefined);
  if (usuarioIdNovo) {
    await comoUsuario(adm, contas.administrador.usuarioId as string, (tx) => tx.update(usuario).set({ situacao: "inativo" }).where(eq(usuario.id, usuarioIdNovo as string))).catch(() => undefined);
  }
  await navegador?.close();
  servidor?.kill();
  await fecharBanco(adm);
});

async function entrar(email: string, senha: string, destino = "/") {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
  const pagina = await contexto.newPage();
  await pagina.goto(`${BASE}/login?destino=${encodeURIComponent(destino)}`);
  await pagina.getByLabel("E-mail").fill(email);
  await pagina.getByLabel("Senha").fill(senha);
  await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
  return { contexto, pagina };
}

const entrarConta = async (conta: ContaDeTeste, destino = "/") => {
  const sessao = await entrar(conta.email, conta.senha, destino);
  await sessao.pagina.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 });
  return sessao;
};

async function textoDaPagina(pagina: Page) {
  await pagina.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 60_000 }).catch(() => undefined);
  return pagina.locator("body").innerText();
}

/** Campos de formulário no conteúdo da página (o botão "Sair" do topo fica fora do conteúdo). */
const camposNoConteudo = (pagina: Page) => pagina.locator("main input:not([type=hidden]), main textarea, main select").count();

describe("Quem só consulta não recebe formulários de inclusão ou alteração", () => {
  test("leitor: todas as páginas de inclusão e alteração mostram só o aviso", async () => {
    const id = async (consulta: ReturnType<typeof sql>) => ((await adm.execute(consulta)).rows[0] as { id: string } | undefined)?.id;
    const iniciativa = await id(sql`select iniciativa_id as id from iniciativa_projeto_tema where projeto_tema_id = ${projetoA} and arquivado_em is null limit 1`);
    const interacao = await id(sql`select interacao_id as id from interacao_projeto_tema where projeto_tema_id = ${projetoA} and arquivado_em is null limit 1`);
    const plano = await id(sql`select id from plano_acao where projeto_tema_id = ${projetoA} and arquivado_em is null limit 1`);
    const risco = await id(sql`select id from risco where projeto_tema_id = ${projetoA} and arquivado_em is null limit 1`);
    const pessoa = await id(sql`select stakeholder_id as id from stakeholder_contexto sc join pessoa p on p.id = sc.stakeholder_id where sc.projeto_tema_id = ${projetoA} and sc.arquivado_em is null limit 1`);
    const instituicao = await id(sql`select id from instituicao where arquivado_em is null limit 1`);
    const enderecos = [
      "/iniciativas/nova", "/interacoes/nova", "/planos/novo", "/riscos/novo", "/pessoas/nova", "/instituicoes/nova", "/projetos-temas/novo",
      `/iniciativas/${iniciativa}/editar`, `/interacoes/${interacao}/editar`, `/planos/${plano}/editar`, `/riscos/${risco}/editar`,
      `/pessoas/${pessoa}/editar`, `/instituicoes/${instituicao}/editar`, `/projetos-temas/${projetoA}/editar`,
    ];
    expect(enderecos.every((e) => !e.includes("undefined"))).toBe(true);
    const { contexto, pagina } = await entrarConta(contas.leitor);
    try {
      const comFormulario: string[] = [];
      for (const endereco of enderecos) {
        await pagina.goto(`${BASE}${endereco}`);
        const texto = await textoDaPagina(pagina);
        const aviso = await pagina.locator("[data-teste=somente-consulta]").count();
        if (aviso !== 1 || (await camposNoConteudo(pagina)) > 0 || !texto.includes("apenas consulta")) comFormulario.push(endereco);
      }
      expect(comFormulario).toEqual([]);
      await pagina.goto(`${BASE}/iniciativas/nova`);
      await textoDaPagina(pagina);
      await pagina.screenshot({ path: path.join(PASTA_TELAS, "01-leitor-inclusao-sem-formulario.png"), fullPage: true });
    } finally {
      await contexto.close();
    }
  });

  test("colaborador continua com os formulários de inclusão e alteração", async () => {
    const { contexto, pagina } = await entrarConta(contas.colaborador);
    try {
      for (const endereco of ["/iniciativas/nova", "/riscos/novo", `/projetos-temas/${projetoA}/editar`]) {
        await pagina.goto(`${BASE}${endereco}`);
        await textoDaPagina(pagina);
        expect(await pagina.locator("[data-teste=somente-consulta]").count(), endereco).toBe(0);
        expect(await camposNoConteudo(pagina), endereco).toBeGreaterThan(0);
      }
      // Incluir projeto é só do administrador: o colaborador também recebe o aviso.
      await pagina.goto(`${BASE}/projetos-temas/novo`);
      await textoDaPagina(pagina);
      expect(await pagina.locator("[data-teste=somente-consulta]").count()).toBe(1);
    } finally {
      await contexto.close();
    }
  });
});

describe("P-056: troca obrigatória da senha provisória", () => {
  const email = `p056.${sufixo}@teste.crm-es-em-acao.example.com`;
  let senhaProvisoria = gerarSenhaProvisoria();
  const senhaPessoal = `Pessoal-ficticia-${sufixo}-2026`;

  beforeAll(async () => {
    authIdNova = await criarConta(email, senhaProvisoria);
    usuarioIdNovo = await comoUsuario(adm, contas.administrador.usuarioId as string, async (tx) => {
      const [linha] = await tx.insert(usuario).values({ nome: `Conta fictícia P-056 ${sufixo}`, email, authId: authIdNova }).returning({ id: usuario.id });
      await tx.insert(permissaoContexto).values({ usuarioId: linha.id, projetoTemaId: projetoA, perfil: "leitor" });
      return linha.id;
    });
  });

  test("com a senha provisória, qualquer tela, operação ou arquivo leva à troca de senha", async () => {
    const { contexto, pagina } = await entrar(email, senhaProvisoria, "/paineis");
    try {
      await pagina.waitForURL((url) => url.pathname === "/minha-conta", { timeout: 60_000 });
      expect(new URL(pagina.url()).search).toBe("?troca=obrigatoria");
      expect(await textoDaPagina(pagina)).toContain("Defina sua senha pessoal para continuar");
      await pagina.screenshot({ path: path.join(PASTA_TELAS, "02-troca-obrigatoria.png"), fullPage: true });
      for (const endereco of ["/paineis", "/pessoas", `/projetos-temas/${projetoA}`, "/"]) {
        await pagina.goto(`${BASE}${endereco}`);
        expect(new URL(pagina.url()).pathname, endereco).toBe("/minha-conta");
      }
      const arquivo = await pagina.request.get(`${BASE}/paineis/relatorios/R1`, { maxRedirects: 0 });
      expect(arquivo.status()).toBe(303);
      expect(arquivo.headers().location).toContain("/minha-conta?troca=obrigatoria");
      const envio = await pagina.request.post(`${BASE}/pessoas/nova`, { maxRedirects: 0, headers: { "Next-Action": "0".repeat(42) }, data: "x" });
      expect(envio.status()).toBe(303);
    } finally {
      await contexto.close();
    }
  });

  test("a nova senha precisa ser diferente; depois da troca, o acesso fica liberado e a senha provisória deixa de valer", async () => {
    const { contexto, pagina } = await entrar(email, senhaProvisoria, "/");
    try {
      await pagina.waitForURL((url) => url.pathname === "/minha-conta", { timeout: 60_000 });
      await textoDaPagina(pagina);
      await pagina.locator("#senhaAtual").fill(senhaProvisoria);
      await pagina.locator("#novaSenha").fill(senhaProvisoria.padEnd(12, "x"));
      await pagina.locator("#confirmacao").fill(senhaProvisoria.padEnd(12, "x"));
      if (senhaProvisoria.length >= 12) {
        await pagina.getByRole("button", { name: /Trocar/ }).click();
        await expect.poll(async () => pagina.locator("body").innerText(), { timeout: 30_000 }).toContain("diferente da atual");
      }
      await pagina.locator("#senhaAtual").fill(senhaProvisoria);
      await pagina.locator("#novaSenha").fill(senhaPessoal);
      await pagina.locator("#confirmacao").fill(senhaPessoal);
      await pagina.getByRole("button", { name: /Trocar/ }).click();
      await pagina.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
      await pagina.goto(`${BASE}/paineis`);
      expect(new URL(pagina.url()).pathname).toBe("/paineis");
      expect(await textoDaPagina(pagina)).toContain("Painéis executivos");
    } finally {
      await contexto.close();
    }
    const antiga = await entrar(email, senhaProvisoria);
    try {
      await antiga.pagina.waitForTimeout(2000);
      expect(new URL(antiga.pagina.url()).pathname).toBe("/login");
      expect(await antiga.pagina.locator("body").innerText()).toContain("E-mail ou senha incorretos");
    } finally {
      await antiga.contexto.close();
    }
    const nova = await entrar(email, senhaPessoal, "/paineis");
    try {
      await nova.pagina.waitForURL((url) => url.pathname === "/paineis", { timeout: 60_000 });
    } finally {
      await nova.contexto.close();
    }
  });

  test("senha redefinida pelo administrador volta a exigir a troca", async () => {
    senhaProvisoria = gerarSenhaProvisoria();
    await redefinirSenha(authIdNova as string, senhaProvisoria);
    const { contexto, pagina } = await entrar(email, senhaProvisoria, "/paineis");
    try {
      await pagina.waitForURL((url) => url.pathname === "/minha-conta", { timeout: 60_000 });
      expect(await textoDaPagina(pagina)).toContain("Defina sua senha pessoal para continuar");
    } finally {
      await contexto.close();
    }
    const [permissao] = await adm
      .select({ perfil: permissaoContexto.perfil })
      .from(permissaoContexto)
      .where(and(eq(permissaoContexto.usuarioId, usuarioIdNovo as string), isNull(permissaoContexto.arquivadoEm)));
    expect(permissao.perfil).toBe("leitor");
  });
});
