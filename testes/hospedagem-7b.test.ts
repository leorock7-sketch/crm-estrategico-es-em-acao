// @vitest-environment node
/**
 * Hospedagem de testes da Etapa 7B (D-087): regras sem rede nem banco, com valores fictícios.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { opcoesDosCookiesDaSessao } from "../src/lib/autenticacao/cookies-da-sessao";
import {
  analisarCarregamento,
  type EventoDeBanco,
  avaliarCabecalhos,
  detalhesTecnicosNoErro,
  estatisticas,
  motivosContraConexaoDaAplicacao,
  procurarSegredos,
  valoresSensiveis,
  VARIAVEIS_DA_HOSPEDAGEM,
} from "../scripts/hospedagem/regras";
import nextConfig from "../next.config";

const REF = "abcdefghijklmnopqrst";
const conexao = (usuario: string, porta: number, host = "aws-0-sa-east-1.pooler.supabase.com") => `postgresql://${usuario}:senha-ficticia-longa@${host}:${porta}/postgres`;

describe("Credenciais que vão para o Netlify", () => {
  test("só as quatro variáveis da aplicação; nunca a conexão administrativa", () => {
    expect([...VARIAVEIS_DA_HOSPEDAGEM].sort()).toEqual(["CRM_BANCO_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
    expect(VARIAVEIS_DA_HOSPEDAGEM).not.toContain("CRM_BANCO_ADMIN_URL");
  });

  test("a conexão precisa ser do papel crm_app, do mesmo projeto, pelo pooler de transações", () => {
    expect(motivosContraConexaoDaAplicacao(conexao(`crm_app.${REF}`, 6543), REF)).toEqual([]);
    expect(motivosContraConexaoDaAplicacao(conexao(`postgres.${REF}`, 6543), REF)).toEqual(["A conexão da aplicação não usa o papel restrito crm_app."]);
    expect(motivosContraConexaoDaAplicacao(conexao("crm_app.outroprojetoxxxxxxxx", 6543), REF)).toEqual(["A conexão da aplicação é de outro projeto."]);
    expect(motivosContraConexaoDaAplicacao(conexao(`crm_app.${REF}`, 5432), REF)).toEqual(["A conexão da aplicação não passa pelo pooler de transações do Supabase."]);
    expect(motivosContraConexaoDaAplicacao(conexao(`crm_app.${REF}`, 6543, "db.exemplo.invalid"), REF)).toHaveLength(1);
    expect(motivosContraConexaoDaAplicacao(undefined, REF)).toEqual(["Falta CRM_BANCO_URL."]);
  });
});

describe("Cabeçalhos de segurança", () => {
  test("a configuração do Next.js entrega todos os cabeçalhos esperados e esconde a tecnologia", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const regras = await (nextConfig.headers as () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>)();
    const todas = regras.find((r) => r.source === "/:path*");
    const mapa = new Map((todas?.headers ?? []).map((h) => [h.key.toLowerCase(), h.value]));
    const avaliacao = avaliarCabecalhos({ get: (nome) => mapa.get(nome) ?? null });
    expect(avaliacao.filter((c) => !c.ok)).toEqual([]);
  });

  test("cabeçalho ausente ou fraco é apontado", () => {
    const fracos = new Map([["strict-transport-security", "max-age=60"], ["x-powered-by", "Next.js"]]);
    const falhas = avaliarCabecalhos({ get: (nome) => fracos.get(nome) ?? null }).filter((c) => !c.ok).map((c) => c.nome);
    expect(falhas).toContain("strict-transport-security");
    expect(falhas).toContain("x-powered-by");
    expect(falhas).toContain("x-frame-options");
  });
});

describe("Cookies da sessão", () => {
  test("na hospedagem: só por HTTPS, inacessíveis aos programas da página e sem envio entre sites", () => {
    expect(opcoesDosCookiesDaSessao("production")).toEqual({ httpOnly: true, sameSite: "lax", secure: true });
  });

  test("no desenvolvimento local (sem HTTPS) o cookie não exige HTTPS, mas mantém as demais proteções", () => {
    expect(opcoesDosCookiesDaSessao("development")).toEqual({ httpOnly: true, sameSite: "lax", secure: false });
  });

  test("o proxy e o servidor usam as mesmas opções", () => {
    for (const arquivo of ["src/proxy.ts", "src/lib/autenticacao/supabase-servidor.ts"]) {
      const fonte = readFileSync(arquivo, "utf8");
      expect(fonte).toContain("cookieOptions: opcoesDosCookiesDaSessao()");
    }
  });
});

describe("Segredos em arquivos entregues ao navegador", () => {
  const ambiente = {
    // Montada na execução, para não parecer uma chave real aos detectores de segredos.
    SUPABASE_SECRET_KEY: ["sb", "secret", "ficticia_para_teste_1234567890"].join("_"),
    CRM_BANCO_URL: conexao(`crm_app.${REF}`, 6543),
    CRM_BANCO_ADMIN_URL: "postgresql://postgres.x:outra-senha-administrativa@h:5432/postgres",
  };

  test("encontra pelo nome, sem devolver o valor", () => {
    const sensiveis = valoresSensiveis(ambiente);
    expect(procurarSegredos("var a=1;", sensiveis)).toEqual([]);
    expect(procurarSegredos(`x="${ambiente.SUPABASE_SECRET_KEY}"`, sensiveis)).toEqual(["chave secreta do Supabase", "chave secreta do Supabase (formato)"]);
    expect(procurarSegredos("...outra-senha-administrativa...", sensiveis)).toEqual(["senha administrativa do banco"]);
    expect(procurarSegredos('fetch("postgresql://u:p@host/db")', [])).toEqual(["endereço de conexão PostgreSQL"]);
  });

  test("valores curtos não entram na busca, para evitar falso alarme", () => {
    expect(valoresSensiveis({ SUPABASE_SECRET_KEY: "curta" })).toEqual([]);
  });
});

describe("Instrumentação do laboratório (P-071, E1)", () => {
  const evento = (t0: number, fim: number, marcas: EventoDeBanco["marcas"], tipo: EventoDeBanco["tipo"] = "consulta"): EventoDeBanco => ({
    t0, tipo, rotulo: "x", consultas: 1, marcas, fim, falhou: false,
  });

  test("união dos intervalos, paralelismo e fases", () => {
    const eventos = [
      evento(1000, 600, { transacao: 100, identidade: 300, consultas: 500 }),
      evento(1200, 600, { transacao: 100, identidade: 300, consultas: 500 }), // sobrepõe o primeiro
      evento(3000, 400, { transacao: 100, identidade: 200 }, "transacao"),
      evento(9000, 100, { transacao: 50 }), // fora da janela
    ];
    const r = analisarCarregamento(eventos, 900, 4000);
    expect(r.transacoes).toBe(3);
    expect(r.uniaoMs).toBe(800 + 400);
    expect(r.somaMs).toBe(1600);
    expect(r.paralelismo).toBe(1.3);
    expect(r.antesDoBancoMs).toBe(100);
    expect(r.depoisDoBancoMs).toBe(600);
    expect(r.fases).toEqual({ espera: 300, identidade: 500, consultas: 600, encerramento: 200 });
  });

  test("sem eventos, nada é atribuído ao banco", () => {
    expect(analisarCarregamento([], 0, 500)).toMatchObject({ transacoes: 0, uniaoMs: 0, paralelismo: 0 });
  });
});

describe("Páginas de erro e estatísticas", () => {
  test("pilha de chamadas, caminhos do servidor e erros de conexão são apontados", () => {
    expect(detalhesTecnicosNoErro("<h1>Página não encontrada</h1>")).toEqual([]);
    expect(detalhesTecnicosNoErro("Error: x\n    at Object.<anonymous> (/var/task/a.js:1:1)")).toEqual(["pilha de chamadas", "caminho do servidor"]);
    expect(detalhesTecnicosNoErro("connect ECONNREFUSED 127.0.0.1:5432")).toEqual(["erro de conexão"]);
  });

  test("mediana e percentis 90 e 95", () => {
    expect(estatisticas([])).toEqual({ n: 0, mediana: 0, p90: 0, p95: 0, minimo: 0, maximo: 0 });
    expect(estatisticas([5, 1, 3, 2, 4, 6, 7, 8, 9, 10])).toEqual({ n: 10, mediana: 5, p90: 9, p95: 10, minimo: 1, maximo: 10 });
    const vinte = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(estatisticas(vinte)).toMatchObject({ mediana: 10, p90: 18, p95: 19, maximo: 20 });
  });
});
