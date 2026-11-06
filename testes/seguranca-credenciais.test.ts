// @vitest-environment node
/**
 * Requisitos 1 e 8 (D-074): como as credenciais e a identidade são tratadas no código. Roda a
 * cada Pull Request, sem segredos. A varredura com os valores reais das chaves e do pacote
 * enviado ao navegador fica em testes/supabase/credenciais.test.ts.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { modoDeAcesso } from "@/lib/banco/ambiente";

const RAIZ = process.cwd();

function arquivosDe(pasta: string): string[] {
  return readdirSync(path.join(RAIZ, pasta)).flatMap((nome) => {
    const relativo = path.join(pasta, nome);
    return statSync(path.join(RAIZ, relativo)).isDirectory() ? arquivosDe(relativo) : [relativo];
  });
}

const codigo = arquivosDe("src")
  .filter((a) => /\.tsx?$/.test(a))
  .map((a) => ({ arquivo: a.replaceAll("\\", "/"), texto: readFileSync(path.join(RAIZ, a), "utf8") }));

const quemUsa = (trecho: string) => codigo.filter((c) => c.texto.includes(trecho)).map((c) => c.arquivo).sort();

describe("Requisito 8: proteção de credenciais", () => {
  test("a chave secreta só é lida em um arquivo exclusivo do servidor", () => {
    expect(quemUsa("SUPABASE_SECRET_KEY")).toEqual(["src/lib/autenticacao/administracao.ts"]);
    expect(codigo.find((c) => c.arquivo === "src/lib/autenticacao/administracao.ts")?.texto).toContain('import "server-only"');
  });

  test("a conexão administrativa não é usada pela aplicação, só pelos comandos de manutenção", () => {
    expect(quemUsa("CRM_BANCO_ADMIN_URL")).toEqual([]);
  });

  test("nenhum componente do navegador importa código de conexão, sessão ou administração de contas", () => {
    const doNavegador = codigo.filter((c) => /^["']use client["']/.test(c.texto));
    expect(doNavegador.length).toBeGreaterThan(0);
    for (const { arquivo, texto } of doNavegador) {
      expect(texto, arquivo).not.toMatch(/lib\/banco\/(conexao|identidade|requisicao)|autenticacao\/(administracao|sessao|supabase-servidor)/);
    }
  });

  test("variáveis enviadas ao navegador são só o endereço e a chave pública", () => {
    const nomes = new Set(codigo.flatMap((c) => c.texto.match(/NEXT_PUBLIC_[A-Z_]+/g) ?? []));
    expect([...nomes].sort()).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
  });

  test("os arquivos locais de segredos e de contas de teste são ignorados pelo Git", () => {
    const ignorados = execFileSync("git", ["check-ignore", ".env.local", ".dados/contas-teste.json"], { encoding: "utf8" });
    expect(ignorados).toContain(".env.local");
    expect(ignorados).toContain(".dados/contas-teste.json");
  });

  test("o repositório não contém chaves, tokens nem conexões com senha", () => {
    const versionados = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
    const padroes = [
      /sb_(secret|publishable)_[A-Za-z0-9_-]{16,}/,
      /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}/,
      /postgres(ql)?:\/\/[^\s"'`$<{[]+:[^\s"'`$<{[]+@[a-z0-9.-]+\.(supabase\.(co|com))/,
    ];
    const encontrados = versionados.filter((arquivo) => {
      if (/package-lock\.json$|\.(png|jpg|ico|svg|woff2?)$/.test(arquivo)) return false;
      const texto = readFileSync(path.join(RAIZ, arquivo), "utf8");
      return padroes.some((p) => p.test(texto));
    });
    expect(encontrados).toEqual([]);
  });
});

describe("Requisito 1: identidade somente pelo caminho verificado", () => {
  test("nenhum código usa getSession: a identidade vem de getClaims, que confere a assinatura", () => {
    const usos = codigo.filter((c) => /\.getSession\(/.test(c.texto)).map((c) => c.arquivo);
    expect(usos).toEqual([]);
    expect(quemUsa("getClaims(").length).toBeGreaterThan(0);
  });

  test("telas e operações não usam a conexão-base: recebem sempre o banco com identidade", () => {
    const permitidos = ["src/lib/autenticacao/sessao.ts", "src/lib/banco/conexao.ts", "src/lib/banco/requisicao.ts"];
    expect(quemUsa("obterBancoBase").filter((a) => !permitidos.includes(a))).toEqual([]);
    const operacoes = codigo.filter((c) => c.arquivo.startsWith("src/modulos/") && /^["']use server["']/.test(c.texto));
    expect(operacoes.length).toBeGreaterThanOrEqual(8);
    for (const { arquivo, texto } of operacoes) {
      expect(texto, arquivo).toContain("bancoDaSessao");
    }
  });

  test("toda tela que lê dados pede o banco com identidade", () => {
    const telas = codigo.filter((c) => c.arquivo.startsWith("src/app/") && c.texto.includes("drizzle"));
    for (const { arquivo, texto } of telas) {
      expect(texto, arquivo).toContain("bancoDaRequisicao");
    }
  });

  test("o administrador fictício só é usado no modo local", () => {
    const usos = quemUsa("USUARIO_DESENVOLVIMENTO");
    expect(usos).toEqual(["src/lib/banco/requisicao.ts", "src/modulos/acesso/usuario-atual.ts"]);
  });
});

describe("Modo de acesso", () => {
  const supabase = {
    CRM_BANCO_URL: "postgresql://ficticio",
    NEXT_PUBLIC_SUPABASE_URL: "https://ficticio.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "ficticia",
  };

  test("com a configuração do Supabase, vale o login real", () => {
    expect(modoDeAcesso({ ...supabase, NODE_ENV: "production" })).toBe("supabase");
    expect(modoDeAcesso({ ...supabase, NODE_ENV: "development" })).toBe("supabase");
  });

  test("em produção, sem configuração, recusa iniciar: nunca cai no administrador fictício", () => {
    expect(() => modoDeAcesso({ NODE_ENV: "production" })).toThrow(/sem configuração de acesso/);
    expect(() => modoDeAcesso({ NODE_ENV: "production", CRM_BANCO_URL: "postgresql://ficticio" })).toThrow();
  });

  test("o modo local exige desenvolvimento ou autorização explícita", () => {
    expect(modoDeAcesso({ NODE_ENV: "development" })).toBe("local");
    expect(modoDeAcesso({ NODE_ENV: "production", CRM_BANCO: "pglite" })).toBe("local");
    expect(modoDeAcesso({ ...supabase, CRM_BANCO: "pglite" })).toBe("local");
  });
});
