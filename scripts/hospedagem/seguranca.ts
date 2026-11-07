/**
 * T8 — segurança na hospedagem (Etapa 7B, D-087), com contas fictícias.
 * Comando: npm run hospedagem:seguranca -- --base=<endereço> (ou CRM_TESTE_BASE_URL)
 *
 * Confere, sem exibir valores sensíveis:
 * 1. HTTPS: o endereço sem HTTPS é redirecionado; cabeçalhos de segurança em todas as respostas.
 * 2. Sem sessão: telas, relatórios e arquivos levam ao login; /saude não entrega dados.
 * 3. Página de erro sem pilha de chamadas, caminhos do servidor ou detalhes da conexão.
 * 4. Arquivos entregues ao navegador (antes e depois do login) sem segredos: chave secreta do
 *    Supabase, senhas e endereços de conexão; sem mapas do código-fonte publicados.
 * 5. Cookies da sessão: só por HTTPS, inacessíveis a programas da página, sem envio entre sites.
 * 6. A chave pública (que vai para o navegador) não lê dados pela API do Supabase.
 * Termina com 0 se tudo passar.
 */
import { chromium } from "playwright-core";
import { exigir } from "../backup/comum";
import { lerContasDeTeste } from "../contas-teste";
import { avaliarCabecalhos, detalhesTecnicosNoErro, procurarSegredos, valoresSensiveis } from "./regras";

const argumento = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const BASE = (argumento("base") ?? process.env.CRM_TESTE_BASE_URL ?? "").replace(/\/$/, "");
const falhas: string[] = [];
const conferir = (ok: boolean, descricao: string) => {
  console.log(`  [${ok ? "OK" : "FALHA"}] ${descricao}`);
  if (!ok) falhas.push(descricao);
};

/** Endereços dos arquivos de programa (JS) citados numa página. */
const scriptsDaPagina = (html: string) => [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];

async function principal() {
  if (!BASE) throw new Error("Informe --base=<endereço> ou CRM_TESTE_BASE_URL.");
  const sensiveis = valoresSensiveis(process.env);
  const { contas, projetoA } = lerContasDeTeste();

  console.log("1. HTTPS e cabeçalhos");
  const semHttps = await fetch(BASE.replace(/^https:/, "http:") + "/login", { redirect: "manual" });
  conferir(semHttps.status >= 300 && semHttps.status < 400 && (semHttps.headers.get("location") ?? "").startsWith("https:"), `endereço sem HTTPS redirecionado para HTTPS (HTTP ${semHttps.status})`);
  const login = await fetch(`${BASE}/login`);
  for (const c of avaliarCabecalhos(login.headers)) conferir(c.ok, `cabeçalho ${c.nome}: ${c.descricao}`);

  console.log("2. Sem sessão");
  for (const caminho of ["/paineis", "/pessoas", `/paineis/projetos/${projetoA}`, "/paineis/relatorios/R1", "/usuarios", "/minha-conta"]) {
    const r = await fetch(`${BASE}${caminho}`, { redirect: "manual" });
    conferir(r.status >= 300 && r.status < 400 && (r.headers.get("location") ?? "").includes("/login"), `${caminho} leva ao login (HTTP ${r.status})`);
  }
  const saude = await fetch(`${BASE}/saude`);
  const corpoSaude = await saude.text();
  conferir(saude.status === 200 && corpoSaude.length < 200 && procurarSegredos(corpoSaude, sensiveis).length === 0, `/saude responde (HTTP ${saude.status}) sem dados (${corpoSaude.length} caracteres)`);

  console.log("3. Página de erro");
  const inexistente = await fetch(`${BASE}/rota-inexistente-${Date.now()}`, { redirect: "manual" });
  const corpoErro = await inexistente.text();
  const sinais = detalhesTecnicosNoErro(corpoErro);
  conferir(sinais.length === 0, `endereço inexistente (HTTP ${inexistente.status}) sem detalhes técnicos${sinais.length ? `: ${sinais.join(", ")}` : ""}`);

  console.log("4. Arquivos entregues ao navegador");
  const navegador = await chromium.launch({ channel: "msedge", headless: true });
  const contexto = await navegador.newContext({ locale: "pt-BR" });
  const pagina = await contexto.newPage();
  const arquivosJs = new Set<string>();
  pagina.on("response", (r) => {
    const url = new URL(r.url());
    if (url.origin === new URL(BASE).origin && url.pathname.endsWith(".js")) arquivosJs.add(url.pathname);
  });
  try {
    for (const s of scriptsDaPagina(await (await fetch(`${BASE}/login`)).text())) arquivosJs.add(s);
    await pagina.goto(`${BASE}/login?destino=%2Fpaineis`);
    await pagina.getByLabel("E-mail").fill(contas.administrador.email);
    await pagina.getByLabel("Senha").fill(contas.administrador.senha);
    await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
    await pagina.waitForURL((url) => url.pathname !== "/login", { timeout: 120_000 });
    for (const caminho of ["/paineis", "/paineis/relatorios", "/pessoas", "/usuarios", `/projetos-temas/${projetoA}/matriz`, "/minha-conta"]) {
      await pagina.goto(`${BASE}${caminho}`);
      await pagina.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 120_000 }).catch(() => undefined);
    }
    let encontrados: string[] = [];
    let mapas = 0;
    for (const arquivo of arquivosJs) {
      const texto = await (await fetch(`${BASE}${arquivo}`)).text();
      encontrados = [...encontrados, ...procurarSegredos(texto, sensiveis)];
      if ((await fetch(`${BASE}${arquivo}.map`, { method: "HEAD" })).status === 200) mapas += 1;
    }
    conferir(encontrados.length === 0, `${arquivosJs.size} arquivos de programa conferidos: nenhum segredo${encontrados.length ? ` (ACHADOS: ${[...new Set(encontrados)].join(", ")})` : ""}`);
    conferir(mapas === 0, `mapas do código-fonte não publicados (${mapas} encontrados)`);
    const html = await pagina.content();
    conferir(procurarSegredos(html, sensiveis).length === 0, "página entregue depois do login sem segredos");

    console.log("5. Cookies da sessão");
    const cookies = (await contexto.cookies()).filter((c) => c.name.startsWith("sb-"));
    conferir(cookies.length > 0, `${cookies.length} cookie(s) de sessão`);
    conferir(cookies.every((c) => c.secure), "cookies só por HTTPS (Secure)");
    conferir(cookies.every((c) => c.httpOnly), "cookies inacessíveis a programas da página (HttpOnly)");
    conferir(cookies.every((c) => c.sameSite === "Lax" || c.sameSite === "Strict"), `cookies sem envio entre sites (SameSite ${[...new Set(cookies.map((c) => c.sameSite))].join("/")})`);
  } finally {
    await navegador.close();
  }

  console.log("6. Chave pública na API do Supabase");
  const supabase = exigir("NEXT_PUBLIC_SUPABASE_URL");
  const chavePublica = exigir("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const api = await fetch(`${supabase}/rest/v1/pessoa?select=id&limit=1`, { headers: { apikey: chavePublica } });
  const corpoApi = await api.text();
  conferir(api.status >= 400 || corpoApi.trim() === "[]", `consulta direta à tabela de pessoas com a chave pública não devolve dados (HTTP ${api.status})`);

  console.log(falhas.length === 0 ? "T8: todas as conferências passaram." : `T8: ${falhas.length} falha(s).`);
  return falhas.length === 0 ? 0 : 1;
}

principal()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((erro) => {
    console.error(`Falha nas conferências: ${erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido"}`);
    process.exitCode = 1;
  });
