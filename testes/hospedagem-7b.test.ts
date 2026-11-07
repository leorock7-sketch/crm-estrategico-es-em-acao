// @vitest-environment node
/**
 * Hospedagem de testes da Etapa 7B (D-087): regras sem rede nem banco, com valores fictícios.
 */
import { describe, expect, test } from "vitest";
import {
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

describe("Páginas de erro e estatísticas", () => {
  test("pilha de chamadas, caminhos do servidor e erros de conexão são apontados", () => {
    expect(detalhesTecnicosNoErro("<h1>Página não encontrada</h1>")).toEqual([]);
    expect(detalhesTecnicosNoErro("Error: x\n    at Object.<anonymous> (/var/task/a.js:1:1)")).toEqual(["pilha de chamadas", "caminho do servidor"]);
    expect(detalhesTecnicosNoErro("connect ECONNREFUSED 127.0.0.1:5432")).toEqual(["erro de conexão"]);
  });

  test("mediana e percentil 90", () => {
    expect(estatisticas([])).toEqual({ n: 0, mediana: 0, p90: 0, minimo: 0, maximo: 0 });
    expect(estatisticas([5, 1, 3, 2, 4, 6, 7, 8, 9, 10])).toEqual({ n: 10, mediana: 5, p90: 9, minimo: 1, maximo: 10 });
  });
});
