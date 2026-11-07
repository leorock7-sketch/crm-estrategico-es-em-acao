// @vitest-environment node
/**
 * Conferência do projeto Supabase de desenvolvimento (D-075): aponta o que corrigir
 * sem nunca repetir os valores. Valores fictícios, montados por partes para não se
 * parecerem com chaves verdadeiras nas varreduras do repositório.
 */
import { describe, expect, test } from "vitest";
import {
  conferirAjustesDeAutenticacao,
  conexaoComNovaSenha,
  conferirVariaveis,
  explicarFalhaDeConexao,
  gerarSenhaForte,
} from "../scripts/conferencia-ambiente";

const REFERENCIA = "projetoficticio";
const CHAVE_PUBLICA = ["sb", "publishable", "valorficticiopublico"].join("_");
const CHAVE_SECRETA = ["sb", "secret", "valorficticiosecreto"].join("_");
const SENHA = "senhaficticia12345678";
const POOLER = "aws-1-sa-east-1.pooler.supabase.com";

const correto = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${REFERENCIA}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE_PUBLICA,
  SUPABASE_SECRET_KEY: CHAVE_SECRETA,
  CRM_BANCO_ADMIN_URL: `postgresql://postgres.${REFERENCIA}:${SENHA}@${POOLER}:5432/postgres`,
};

function situacao(ambiente: Record<string, string | undefined>, item: string) {
  return conferirVariaveis(ambiente).find((i) => i.item === item);
}

describe("Conferência das variáveis", () => {
  test("campos vazios ficam pendentes, sem apontar problema", () => {
    const itens = conferirVariaveis({ NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SECRET_KEY: "" });
    expect(itens.filter((i) => i.situacao === "problema")).toEqual([]);
    expect(itens.filter((i) => i.situacao === "pendente")).toHaveLength(6);
  });

  test("valores corretos ficam aprovados; só a conexão do crm_app aguarda a criação do papel", () => {
    const itens = conferirVariaveis(correto);
    expect(itens.filter((i) => i.situacao !== "ok").map((i) => i.item)).toEqual(["Conexão da aplicação (crm_app)"]);
  });

  test("a chave secreta no campo público é apontada, inclusive como exposição ao navegador", () => {
    const ambiente = { ...correto, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE_SECRETA };
    expect(situacao(ambiente, "Chave publishable")?.situacao).toBe("problema");
    expect(situacao(ambiente, "Campos enviados ao navegador")?.situacao).toBe("problema");
  });

  test("o nome do campo colado junto com o valor é apontado, sem repetir o valor", () => {
    const ambiente = {
      ...correto,
      NEXT_PUBLIC_SUPABASE_URL: `NEXT_PUBLIC_SUPABASE_URL=${correto.NEXT_PUBLIC_SUPABASE_URL}`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${CHAVE_PUBLICA}`,
    };
    for (const item of ["Endereço do projeto", "Chave publishable"]) {
      expect(situacao(ambiente, item)?.detalhe).toContain("nome do campo");
    }
    expect(JSON.stringify(conferirVariaveis(ambiente))).not.toContain(CHAVE_PUBLICA);
  });

  test("conexão com o banco em campo público é apontada", () => {
    const ambiente = { ...correto, NEXT_PUBLIC_QUALQUER: correto.CRM_BANCO_ADMIN_URL };
    expect(situacao(ambiente, "Campos enviados ao navegador")?.situacao).toBe("problema");
  });

  test.each([
    ["senha não substituída", `postgresql://postgres.${REFERENCIA}:[YOUR-PASSWORD]@${POOLER}:5432/postgres`],
    ["conexão direta", `postgresql://postgres:${SENHA}@db.${REFERENCIA}.supabase.co:5432/postgres`],
    ["outra região", `postgresql://postgres.${REFERENCIA}:${SENHA}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`],
    ["Transaction pooler", `postgresql://postgres.${REFERENCIA}:${SENHA}@${POOLER}:6543/postgres`],
    ["sem senha", `postgresql://postgres.${REFERENCIA}@${POOLER}:5432/postgres`],
    ["outro projeto", `postgresql://postgres.outroprojeto:${SENHA}@${POOLER}:5432/postgres`],
    ["texto que não é conexão", "copiei errado"],
  ])("conexão administrativa recusada: %s", (_caso, conexao) => {
    expect(situacao({ ...correto, CRM_BANCO_ADMIN_URL: conexao }, "Conexão administrativa")?.situacao).toBe("problema");
  });

  test("a aplicação não pode usar a conta privilegiada", () => {
    const ambiente = { ...correto, CRM_BANCO_URL: correto.CRM_BANCO_ADMIN_URL };
    expect(situacao(ambiente, "Conexão da aplicação (crm_app)")?.situacao).toBe("problema");
    const certo = { ...correto, CRM_BANCO_URL: `postgresql://crm_app.${REFERENCIA}:${SENHA}@${POOLER}:5432/postgres` };
    expect(situacao(certo, "Conexão da aplicação (crm_app)")?.situacao).toBe("ok");
  });

  test("nenhum resultado repete senha, chave ou identificador do projeto, certo ou errado", () => {
    const casos = [
      correto,
      { ...correto, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE_SECRETA },
      { ...correto, SUPABASE_SECRET_KEY: CHAVE_PUBLICA },
      { ...correto, NEXT_PUBLIC_SUPABASE_URL: `${correto.NEXT_PUBLIC_SUPABASE_URL}/rest/v1` },
      { ...correto, CRM_BANCO_ADMIN_URL: `postgresql://postgres.outroprojeto:${SENHA}@${POOLER}:5432/postgres` },
      { ...correto, CRM_BANCO_URL: correto.CRM_BANCO_ADMIN_URL },
      { ...correto, NEXT_PUBLIC_QUALQUER: correto.CRM_BANCO_ADMIN_URL },
    ];
    for (const caso of casos) {
      const texto = JSON.stringify(conferirVariaveis(caso));
      for (const valor of [SENHA, CHAVE_PUBLICA, CHAVE_SECRETA, REFERENCIA, "outroprojeto", POOLER]) {
        expect(texto).not.toContain(valor);
      }
    }
  });
});

describe("Senha administrativa", () => {
  test("senha curta é apontada, sem repetir o valor", () => {
    const curta = "curta@#1";
    const ambiente = { ...correto, CRM_BANCO_ADMIN_URL: `postgresql://postgres.${REFERENCIA}:${encodeURIComponent(curta)}@${POOLER}:5432/postgres` };
    const item = situacao(ambiente, "Força da senha administrativa");
    expect(item?.situacao).toBe("problema");
    expect(JSON.stringify(item)).not.toContain("curta");
    expect(situacao(correto, "Força da senha administrativa")?.situacao).toBe("ok");
  });

  test("a senha gerada é longa, só com letras e números, e muda a cada geração", () => {
    const bytes = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
    const senha = gerarSenhaForte(bytes);
    expect(senha).toMatch(/^[A-Za-z0-9]{40}$/);
    expect(gerarSenhaForte(bytes)).not.toBe(senha);
  });

  test("a conexão muda só na senha, inclusive com símbolos", () => {
    const nova = new URL(conexaoComNovaSenha(correto.CRM_BANCO_ADMIN_URL, "n@va#senha?1"));
    expect(decodeURIComponent(nova.password)).toBe("n@va#senha?1");
    expect(nova.username).toBe(`postgres.${REFERENCIA}`);
    expect(nova.hostname).toBe(POOLER);
    expect(nova.port).toBe("5432");
    expect(nova.pathname).toBe("/postgres");
  });
});

describe("Conferência dos ajustes de autenticação", () => {
  test("acesso fechado, com e-mail e senha ligado", () => {
    const itens = conferirAjustesDeAutenticacao({ disable_signup: true, external: { email: true } });
    expect(itens.every((i) => i.situacao === "ok")).toBe(true);
  });

  test("autocadastro ligado ou resposta incompleta é problema", () => {
    expect(conferirAjustesDeAutenticacao({ disable_signup: false, external: { email: true } })[0]?.situacao).toBe("problema");
    expect(conferirAjustesDeAutenticacao({}).map((i) => i.situacao)).toEqual(["problema", "problema"]);
  });
});

describe("Explicação das falhas de conexão", () => {
  test("usa só o código do erro e tem resposta para código desconhecido", () => {
    expect(explicarFalhaDeConexao("28P01")).toContain("senha");
    expect(explicarFalhaDeConexao("ETIMEDOUT")).toContain("pausado");
    expect(explicarFalhaDeConexao(undefined)).toContain("não foi possível");
  });
});
