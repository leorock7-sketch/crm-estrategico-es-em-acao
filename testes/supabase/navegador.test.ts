/**
 * Testes funcionais em navegador de verdade (Edge, sem janela), com login real no Supabase Auth
 * e a aplicação compilada. Quem digita as senhas é este programa, com as contas fictícias de
 * .dados/contas-teste.json. Antes: npm run build. Somente dados fictícios.
 *
 * Cobre o caminho real: telas, sessão em cookies, proxy, operações do servidor (inclusive
 * reenviando a chamada original com a sessão de outro usuário) e auditoria no banco.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { and, eq, like, sql } from "drizzle-orm";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBancoPostgres, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { permissaoContexto, pessoa, planoAcaoVersao, usuario } from "@/lib/banco/esquema";
import { criarContato } from "@/modulos/stakeholders/consultas";
import { type ContaDeTeste, lerContasDeTeste } from "../../scripts/contas-teste";

const PORTA = 3210;
// Com CRM_TESTE_BASE_URL, roda contra um servidor já publicado (hospedagem de testes da Etapa 7B,
// D-087) em vez de iniciar o next start. Os preparativos continuam feitos neste computador.
const EXTERNO = process.env.CRM_TESTE_BASE_URL;
const BASE = EXTERNO ?? `http://127.0.0.1:${PORTA}`;
const PASTA_TELAS = path.join(process.cwd(), ".dados", "telas-etapa-5");
const sufixo = randomUUID().slice(0, 8);

const { contas, projetoA, projetoB } = lerContasDeTeste();
let servidor: ChildProcess;
let navegador: Browser;
let adm: Banco;
let pessoaEmA: string;
let versaoEmAprovacao: string;
let planoDaVersao: string;
const notaRestrita = `Observação fictícia restrita ${sufixo}`;
const contatoRestrito = `pessoal.navegador.${sufixo}@teste.crm-es-em-acao.example.com`;

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
  if (!EXTERNO && !existsSync(path.join(process.cwd(), ".next", "BUILD_ID"))) throw new Error("Rode npm run build antes destes testes.");
  mkdirSync(PASTA_TELAS, { recursive: true });
  adm = abrirBancoPostgres(process.env.CRM_BANCO_ADMIN_URL as string, { max: 2 });

  const [associada] = (
    await adm.execute(sql`
      select sc.stakeholder_id as id from stakeholder_contexto sc
      join pessoa p on p.id = sc.stakeholder_id
      where sc.projeto_tema_id = ${projetoA} and sc.arquivado_em is null limit 1`)
  ).rows as { id: string }[];
  pessoaEmA = associada.id;
  await adm.update(pessoa).set({ observacoes: notaRestrita }).where(eq(pessoa.id, pessoaEmA));
  await comoUsuario(adm, contas.administrador.usuarioId as string, (tx) =>
    criarContato(tx, { stakeholderId: pessoaEmA, tipo: "email", valor: contatoRestrito, natureza: "pessoal", principal: false }),
  );

  const [versao] = await adm
    .select({ id: planoAcaoVersao.id, planoId: planoAcaoVersao.planoAcaoId })
    .from(planoAcaoVersao)
    .where(eq(planoAcaoVersao.situacao, "em_aprovacao"))
    .limit(1);
  versaoEmAprovacao = versao.id;
  planoDaVersao = versao.planoId;

  if (!EXTERNO) {
    const ambiente = { ...process.env, NODE_ENV: "production", PORT: String(PORTA) } as NodeJS.ProcessEnv;
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(PORTA)], {
      env: ambiente,
      stdio: "ignore",
    });
  }
  await aguardarServidor();
  navegador = await chromium.launch({ channel: "msedge", headless: true });
});

afterAll(async () => {
  await navegador?.close();
  servidor?.kill();
  await fecharBanco(adm);
});

async function novaSessao(): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
  const pagina = await contexto.newPage();
  return { contexto, pagina };
}

async function preencherLogin(pagina: Page, email: string, senha: string) {
  await pagina.getByLabel("E-mail").fill(email);
  await pagina.getByLabel("Senha").fill(senha);
  await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
}

async function entrar(conta: ContaDeTeste, destino = "/") {
  const sessao = await novaSessao();
  await sessao.pagina.goto(`${BASE}/login?destino=${encodeURIComponent(destino)}`);
  await preencherLogin(sessao.pagina, conta.email, conta.senha);
  await sessao.pagina.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
  return sessao;
}

const tela = (pagina: Page, nome: string) => pagina.screenshot({ path: path.join(PASTA_TELAS, `${nome}.png`), fullPage: true });

/** Conteúdo visível, depois de as partes da página chegarem do servidor. */
async function textoDaPagina(pagina: Page) {
  await pagina.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 30_000 }).catch(() => {});
  return pagina.locator("body").innerText();
}

type ChamadaCapturada = { url: string; cabecalhos: Record<string, string>; corpo: Buffer };

/** Captura a chamada original de uma operação do servidor, sem deixá-la chegar ao servidor. */
async function capturarChamada(pagina: Page, acionar: () => Promise<void>): Promise<ChamadaCapturada> {
  let captura: ChamadaCapturada | undefined;
  await pagina.route("**/*", async (rota) => {
    const requisicao = rota.request();
    if (requisicao.method() === "POST" && requisicao.headers()["next-action"]) {
      const cabecalhos = { ...requisicao.headers() };
      delete cabecalhos.cookie;
      captura = { url: requisicao.url(), cabecalhos, corpo: requisicao.postDataBuffer() as Buffer };
      await rota.abort();
    } else {
      await rota.continue();
    }
  });
  await acionar();
  await expect.poll(() => captura !== undefined, { timeout: 15_000 }).toBe(true);
  await pagina.unroute("**/*");
  return captura as ChamadaCapturada;
}

/** Reenvia a chamada com a sessão de outro contexto, como faria um usuário mal-intencionado. */
async function reenviar(contexto: BrowserContext, chamada: ChamadaCapturada) {
  const resposta = await contexto.request.fetch(chamada.url, {
    method: "POST",
    headers: chamada.cabecalhos,
    data: chamada.corpo,
    maxRedirects: 0,
  });
  return { status: resposta.status(), texto: await resposta.text() };
}

describe("Requisito 1: login, sessão e saída no navegador", () => {
  test("sem sessão, as páginas levam ao login e não entregam dados", async () => {
    const { contexto, pagina } = await novaSessao();
    for (const rota of ["/", "/pessoas", `/pessoas/${pessoaEmA}`, "/usuarios", "/projetos-temas", "/planos", "/riscos"]) {
      await pagina.goto(`${BASE}${rota}`);
      expect(new URL(pagina.url()).pathname, rota).toBe("/login");
      expect(await pagina.content()).not.toContain(notaRestrita);
    }
    await pagina.getByLabel("E-mail").waitFor({ timeout: 30_000 });
    await tela(pagina, "01-login");
    await contexto.close();
  });

  test("senha errada não entra, com mensagem que não revela se a conta existe", async () => {
    const { contexto, pagina } = await novaSessao();
    await pagina.goto(`${BASE}/login`);
    await preencherLogin(pagina, contas.gestor.email, "senha-errada-ficticia");
    await pagina.getByText("E-mail ou senha incorretos").waitFor({ timeout: 30_000 });
    expect(new URL(pagina.url()).pathname).toBe("/login");
    await contexto.close();
  });

  test("login válido abre a sessão, leva ao destino pedido e mostra o usuário", async () => {
    const { contexto, pagina } = await novaSessao();
    await pagina.goto(`${BASE}/pessoas`);
    expect(pagina.url()).toContain("destino=%2Fpessoas");
    await preencherLogin(pagina, contas.gestor.email, contas.gestor.senha);
    await pagina.waitForURL(`${BASE}/pessoas`, { timeout: 30_000 });
    await pagina.locator('[data-teste="usuario-conectado"]').waitFor({ timeout: 30_000 });
    expect(await pagina.locator('[data-teste="usuario-conectado"]').innerText()).toBe(contas.gestor.nome);
    await tela(pagina, "02-gestor-pessoas");
    await contexto.close();
  });

  test("o cookie de sessão não é legível por programas da página", async () => {
    const { contexto, pagina } = await entrar(contas.leitor);
    const cookies = await contexto.cookies();
    const deSessao = cookies.filter((c) => c.name.startsWith("sb-"));
    expect(deSessao.length).toBeGreaterThan(0);
    expect(deSessao.every((c) => c.httpOnly)).toBe(true);
    expect(await pagina.evaluate(() => document.cookie)).not.toContain("sb-");
    await contexto.close();
  });

  test("cookie adulterado é recusado: a identidade não pode ser forjada", async () => {
    const { contexto, pagina } = await entrar(contas.leitor);
    const cookies = await contexto.cookies();
    await contexto.clearCookies();
    await contexto.addCookies(
      cookies.map((c) => (c.name.startsWith("sb-") ? { ...c, value: `${c.value.slice(0, -12)}AAAAAAAAAAAA` } : c)),
    );
    await pagina.goto(`${BASE}/pessoas`);
    expect(new URL(pagina.url()).pathname).toBe("/login");
    await contexto.close();
  });

  test("destino externo no login é ignorado", async () => {
    const { contexto, pagina } = await novaSessao();
    await pagina.goto(`${BASE}/login?destino=${encodeURIComponent("https://exemplo.invalid/")}`);
    await preencherLogin(pagina, contas.leitor.email, contas.leitor.senha);
    await pagina.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
    expect(new URL(pagina.url()).origin).toBe(BASE);
    await contexto.close();
  });

  test("sair encerra o acesso", async () => {
    const { contexto, pagina } = await entrar(contas.leitor);
    await pagina.getByRole("button", { name: "Sair" }).click();
    await pagina.waitForURL((url) => url.pathname === "/login", { timeout: 30_000 });
    await pagina.goto(`${BASE}/pessoas`);
    expect(new URL(pagina.url()).pathname).toBe("/login");
    await contexto.close();
  });

  test("conta sem cadastro interno e usuário inativo chegam ao aviso de falta de acesso, sem dados", async () => {
    for (const conta of [contas.semCadastro, contas.inativo]) {
      const { contexto, pagina } = await entrar(conta, "/pessoas");
      await pagina.waitForURL((url) => url.pathname === "/sem-acesso", { timeout: 30_000 }).catch(() => {});
      const texto = await textoDaPagina(pagina);
      expect(texto).toContain("Sem acesso");
      expect(texto).not.toContain(notaRestrita);
      if (conta.chave === "semCadastro") await tela(pagina, "03-sem-acesso");
      await contexto.close();
    }
  });
});

describe("Requisito 9: telas conforme o perfil", () => {
  test("administrador: administra usuários e permissões", async () => {
    const { contexto, pagina } = await entrar(contas.administrador, "/usuarios");
    await pagina.getByRole("link", { name: contas.gestor.nome }).waitFor({ timeout: 30_000 });
    await tela(pagina, "04-administrador-usuarios");
    await pagina.goto(`${BASE}/usuarios/${contas.gestor.usuarioId}`);
    await pagina.getByText("Permissões por projeto ou tema").waitFor({ timeout: 30_000 });
    await tela(pagina, "05-administrador-permissoes");
    await contexto.close();
  });

  test("demais perfis: não abrem a administração de usuários", async () => {
    for (const conta of [contas.gestor, contas.colaborador, contas.leitor]) {
      const { contexto, pagina } = await entrar(conta, "/usuarios");
      const texto = await textoDaPagina(pagina);
      expect(texto).toContain("não encontrado");
      expect(texto).not.toContain(contas.administrador.email);
      await contexto.close();
    }
  });

  test("gestor de A: vê o projeto A, não abre o projeto B", async () => {
    const { contexto, pagina } = await entrar(contas.gestor, "/projetos-temas");
    const lista = await textoDaPagina(pagina);
    expect(lista).toContain("Corredor Logístico Exemplo");
    expect(lista).not.toContain("Ampliação do Porto Modelo");
    await pagina.goto(`${BASE}/projetos-temas/${projetoB}`);
    expect(await textoDaPagina(pagina)).toContain("não encontrado");
    await pagina.goto(`${BASE}/projetos-temas/${projetoA}`);
    expect(await textoDaPagina(pagina)).toContain("Corredor Logístico Exemplo");
    await contexto.close();
  });

  test("gestor de outro projeto: vê o seu, não o de A", async () => {
    const { contexto, pagina } = await entrar(contas.gestorOutroProjeto, "/projetos-temas");
    const lista = await textoDaPagina(pagina);
    expect(lista).toContain("Ampliação do Porto Modelo");
    expect(lista).not.toContain("Corredor Logístico Exemplo");
    await contexto.close();
  });

  test("permissão vencida ou revogada: nenhum projeto", async () => {
    for (const conta of [contas.permissaoVencida, contas.permissaoRevogada, contas.semPermissao]) {
      const { contexto, pagina } = await entrar(conta, "/projetos-temas");
      expect(await textoDaPagina(pagina)).toContain("Nenhum projeto ou tema encontrado");
      await contexto.close();
    }
  });

  test("leitor: consulta, sem botões de registro", async () => {
    const { contexto, pagina } = await entrar(contas.leitor, "/pessoas");
    await textoDaPagina(pagina);
    expect(await pagina.getByRole("link", { name: "Nova pessoa" }).count()).toBe(0);
    await pagina.goto(`${BASE}/pessoas/${pessoaEmA}`);
    await textoDaPagina(pagina);
    expect(await pagina.getByRole("link", { name: "Editar" }).count()).toBe(0);
    expect(await pagina.getByText("Registrar contato").count()).toBe(0);
    await tela(pagina, "06-leitor-pessoa-restrita");
    // Na página do projeto, os formulários ficam desativados, com o aviso.
    await pagina.goto(`${BASE}/projetos-temas/${projetoA}`);
    await pagina.getByText("permite apenas consulta").waitFor({ timeout: 30_000 });
    expect(await pagina.locator("fieldset[disabled]").count()).toBeGreaterThan(0);
    expect(await pagina.locator("fieldset form:visible").count()).toBe(0);
    expect(await pagina.getByRole("link", { name: "Editar" }).count()).toBe(0);
    expect(await pagina.getByRole("link", { name: "Editar", includeHidden: true }).count()).toBeGreaterThan(0);
    await tela(pagina, "10-leitor-projeto-somente-consulta");
    await contexto.close();
  });

  test("gestor: decide versão do plano; colaborador: vê a versão, sem o formulário de decisão", async () => {
    const caminho = `/planos/${planoDaVersao}/versoes/${versaoEmAprovacao}`;
    const gestor = await entrar(contas.gestor, caminho);
    await gestor.pagina.getByRole("button", { name: "Registrar decisão" }).waitFor({ timeout: 30_000 });
    await tela(gestor.pagina, "07-gestor-decisao-versao");
    await gestor.contexto.close();
    const colaborador = await entrar(contas.colaborador, caminho);
    await colaborador.pagina.getByText("Somente o administrador ou o gestor").waitFor({ timeout: 30_000 });
    expect(await colaborador.pagina.getByRole("button", { name: "Registrar decisão" }).count()).toBe(0);
    await tela(colaborador.pagina, "08-colaborador-sem-decisao");
    await colaborador.contexto.close();
  });
});

describe("Decisão D4 e P-054 nas telas", () => {
  test("todos os perfis ativos veem o diretório básico da pessoa", async () => {
    for (const conta of [contas.gestor, contas.leitor, contas.gestorOutroProjeto, contas.semPermissao]) {
      const { contexto, pagina } = await entrar(conta, `/pessoas/${pessoaEmA}`);
      expect(await textoDaPagina(pagina)).toContain("Vínculos institucionais");
      await contexto.close();
    }
  });

  test("gestor do projeto associado vê contato pessoal e observações", async () => {
    const { contexto, pagina } = await entrar(contas.gestor, `/pessoas/${pessoaEmA}`);
    const texto = await textoDaPagina(pagina);
    expect(texto).toContain(notaRestrita);
    expect(texto).toContain(contatoRestrito);
    await tela(pagina, "09-gestor-pessoa-completa");
    await contexto.close();
  });

  test("leitor e gestor de outro projeto não recebem esses dados, nem no código da página", async () => {
    for (const conta of [contas.leitor, contas.gestorOutroProjeto]) {
      const { contexto, pagina } = await entrar(conta, `/pessoas/${pessoaEmA}`);
      await textoDaPagina(pagina);
      const codigo = await pagina.content();
      expect(codigo).not.toContain(notaRestrita);
      expect(codigo).not.toContain(contatoRestrito);
      await contexto.close();
    }
  });
});

describe("Requisito 4: revogação e desativação com sessão aberta", () => {
  test("permissão revogada: a sessão continua aberta, mas o projeto some na navegação seguinte", async () => {
    const id = contas.leitor.usuarioId as string;
    const { contexto, pagina } = await entrar(contas.leitor, `/projetos-temas/${projetoA}`);
    expect(await textoDaPagina(pagina)).toContain("Corredor Logístico Exemplo");
    await adm.update(permissaoContexto).set({ arquivadoEm: new Date() }).where(and(eq(permissaoContexto.usuarioId, id), eq(permissaoContexto.projetoTemaId, projetoA)));
    try {
      await pagina.goto(`${BASE}/projetos-temas/${projetoA}`);
      expect(await textoDaPagina(pagina)).toContain("não encontrado");
    } finally {
      await adm.update(permissaoContexto).set({ arquivadoEm: null }).where(and(eq(permissaoContexto.usuarioId, id), eq(permissaoContexto.projetoTemaId, projetoA)));
    }
    await pagina.goto(`${BASE}/projetos-temas/${projetoA}`);
    expect(await textoDaPagina(pagina)).toContain("Corredor Logístico Exemplo");
    await contexto.close();
  });

  test("usuário desativado: com a sessão aberta, perde o acesso na navegação seguinte", async () => {
    const id = contas.colaborador.usuarioId as string;
    const { contexto, pagina } = await entrar(contas.colaborador, "/pessoas");
    await textoDaPagina(pagina);
    await adm.update(usuario).set({ situacao: "inativo" }).where(eq(usuario.id, id));
    try {
      await pagina.goto(`${BASE}/pessoas`);
      await pagina.waitForURL((url) => url.pathname === "/sem-acesso", { timeout: 30_000 }).catch(() => {});
      expect(await textoDaPagina(pagina)).toContain("Sem acesso");
    } finally {
      await adm.update(usuario).set({ situacao: "ativo" }).where(eq(usuario.id, id));
    }
    await contexto.close();
  });

  test("permissão concedida pelo administrador na tela passa a valer, e revogada na tela deixa de valer", async () => {
    const admin = await entrar(contas.administrador, `/usuarios/${contas.semPermissao.usuarioId}`);
    await admin.pagina.locator("summary", { hasText: "Conceder permissão" }).click();
    await admin.pagina.locator('select[name="projetoTemaId"]').selectOption(projetoA);
    await admin.pagina.locator('select[name="perfil"]').selectOption("leitor");
    await admin.pagina.getByRole("button", { name: "Conceder permissão" }).click();
    await admin.pagina.getByRole("button", { name: "Revogar" }).waitFor({ timeout: 30_000 });
    const usuarioAlvo = await entrar(contas.semPermissao, `/projetos-temas/${projetoA}`);
    expect(await textoDaPagina(usuarioAlvo.pagina)).toContain("Corredor Logístico Exemplo");
    await admin.pagina.getByRole("button", { name: "Revogar" }).click();
    // Execuções anteriores deixam permissões revogadas no histórico: o sinal é o botão sumir,
    // inclusive com o texto "Revogando…", que aparece enquanto a operação está em andamento.
    await admin.pagina.getByRole("button", { name: /Revog/ }).waitFor({ state: "detached", timeout: 30_000 });
    await usuarioAlvo.pagina.goto(`${BASE}/projetos-temas/${projetoA}`);
    expect(await textoDaPagina(usuarioAlvo.pagina)).toContain("não encontrado");
    await admin.contexto.close();
    await usuarioAlvo.contexto.close();
  });
});

describe("Requisito 6: chamadas diretas às operações do servidor", () => {
  test("cadastro: sem sessão e como leitor, a chamada original reenviada não grava nada", async () => {
    const nome = `Pessoa Chamada Direta ${sufixo}`;
    const gestor = await entrar(contas.gestor, "/pessoas/nova");
    await gestor.pagina.getByLabel("Nome completo").fill(nome);
    const chamada = await capturarChamada(gestor.pagina, () => gestor.pagina.getByRole("button", { name: "Salvar" }).click());
    await gestor.contexto.close();

    const semSessao = await novaSessao();
    const respostaSemSessao = await reenviar(semSessao.contexto, chamada);
    expect(respostaSemSessao.status).toBeGreaterThanOrEqual(300);
    await semSessao.contexto.close();

    const leitor = await entrar(contas.leitor);
    const respostaLeitor = await reenviar(leitor.contexto, chamada);
    expect(respostaLeitor.texto).toContain("apenas consulta");
    await leitor.contexto.close();

    const gravadas = await adm.select({ id: pessoa.id }).from(pessoa).where(like(pessoa.nomeCompleto, nome));
    expect(gravadas).toEqual([]);
  });

  test("decisão de versão: colaborador e gestor de outro projeto não decidem por chamada direta", async () => {
    const gestor = await entrar(contas.gestor, `/planos/${planoDaVersao}/versoes/${versaoEmAprovacao}`);
    await gestor.pagina.getByLabel(/^Aprovar/).check();
    const chamada = await capturarChamada(gestor.pagina, () => gestor.pagina.getByRole("button", { name: "Registrar decisão" }).click());
    await gestor.contexto.close();

    for (const conta of [contas.colaborador, contas.gestorOutroProjeto, contas.leitor]) {
      const sessao = await entrar(conta);
      await reenviar(sessao.contexto, chamada);
      await sessao.contexto.close();
      const [versao] = await adm.select({ situacao: planoAcaoVersao.situacao }).from(planoAcaoVersao).where(eq(planoAcaoVersao.id, versaoEmAprovacao));
      expect(versao.situacao, conta.chave).toBe("em_aprovacao");
    }
  });

  test("administração: usuário comum não cria usuário nem concede permissão por chamada direta", async () => {
    const admin = await entrar(contas.administrador, "/usuarios/novo");
    const email = `direto.${sufixo}@teste.crm-es-em-acao.example.com`;
    await admin.pagina.getByLabel("Nome").fill("Teste Chamada Direta");
    await admin.pagina.getByLabel("E-mail").fill(email);
    const criacao = await capturarChamada(admin.pagina, () => admin.pagina.getByRole("button", { name: "Cadastrar" }).click());

    await admin.pagina.goto(`${BASE}/usuarios/${contas.gestor.usuarioId}`);
    await admin.pagina.locator("summary", { hasText: "Conceder permissão" }).click();
    await admin.pagina.locator('select[name="projetoTemaId"]').selectOption(projetoB);
    await admin.pagina.locator('select[name="perfil"]').selectOption("gestor");
    const concessao = await capturarChamada(admin.pagina, () => admin.pagina.getByRole("button", { name: "Conceder permissão" }).click());
    await admin.contexto.close();

    const gestor = await entrar(contas.gestor);
    const respostaCriacao = await reenviar(gestor.contexto, criacao);
    expect(respostaCriacao.texto).toContain("Somente o administrador do sistema");
    const respostaConcessao = await reenviar(gestor.contexto, concessao);
    expect(respostaConcessao.texto).toContain("Somente o administrador do sistema");
    await gestor.contexto.close();

    expect(await adm.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, email))).toEqual([]);
    const permissoes = await adm
      .select({ id: permissaoContexto.id })
      .from(permissaoContexto)
      .where(and(eq(permissaoContexto.usuarioId, contas.gestor.usuarioId as string), eq(permissaoContexto.projetoTemaId, projetoB)));
    expect(permissoes).toEqual([]);
  });
});

describe("Requisitos 3 e 5: autoria e caminho real da aplicação", () => {
  test("inclusão pela tela registra o usuário autenticado, não o administrador fictício", async () => {
    const nome = `Pessoa Pela Tela ${sufixo}`;
    const { contexto, pagina } = await entrar(contas.colaborador, "/pessoas/nova");
    await pagina.getByLabel("Nome completo").fill(nome);
    await pagina.getByRole("button", { name: "Salvar" }).click();
    await pagina.waitForURL(/\/pessoas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const [linha] = await adm.select({ criadoPor: pessoa.criadoPor }).from(pessoa).where(eq(pessoa.nomeCompleto, nome));
    expect(linha.criadoPor).toBe(contas.colaborador.usuarioId);
    await contexto.close();
  });

  test("o administrador cadastra usuário pela tela: conta e cadastro nascem juntos, e a nova pessoa entra direto na troca de senha (P-056)", async () => {
    const email = `novo.pela.tela.${sufixo}@teste.crm-es-em-acao.example.com`;
    const { contexto, pagina } = await entrar(contas.administrador, "/usuarios/novo");
    await pagina.getByLabel("Nome").fill("Teste Novo Pela Tela");
    await pagina.getByLabel("E-mail").fill(email);
    await pagina.getByRole("button", { name: "Cadastrar" }).click();
    const campoSenha = pagina.locator('[data-teste="senha-provisoria"]');
    await campoSenha.waitFor({ timeout: 30_000 });
    const senha = await campoSenha.innerText();
    await contexto.close();

    const [cadastro] = await adm.select({ authId: usuario.authId }).from(usuario).where(eq(usuario.email, email));
    expect(cadastro.authId).toBeTruthy();

    const nova = await novaSessao();
    await nova.pagina.goto(`${BASE}/login?destino=${encodeURIComponent("/pessoas")}`);
    await preencherLogin(nova.pagina, email, senha);
    // Senha provisória: a primeira tela é a troca obrigatória (Fase 7A), qualquer que seja o destino pedido.
    await nova.pagina.waitForURL(`${BASE}/minha-conta?troca=obrigatoria`, { timeout: 30_000 });
    await nova.pagina.locator('[data-teste="usuario-conectado"]').waitFor({ timeout: 30_000 });
    await nova.pagina.getByText("Defina sua senha pessoal para continuar").waitFor({ timeout: 30_000 });
    await nova.contexto.close();
  });

  test("as conexões abertas pela aplicação no banco são do papel crm_app", async () => {
    const { contexto, pagina } = await entrar(contas.gestor, "/pessoas");
    await textoDaPagina(pagina);
    const papeis = (
      await adm.execute(sql`select count(*)::int as n from pg_stat_activity where usename = 'crm_app'`)
    ).rows as { n: number }[];
    expect(papeis[0].n).toBeGreaterThan(0);
    await contexto.close();
  });
});
