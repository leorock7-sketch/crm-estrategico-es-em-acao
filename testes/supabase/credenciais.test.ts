/**
 * Requisito 8 (D-074), com os valores reais: nada do que é secreto aparece no que é publicado
 * nem no que é enviado ao navegador. Compara sem exibir os valores: em caso de falha, só o nome
 * do arquivo aparece. Antes: npm run build.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { lerContasDeTeste } from "../../scripts/contas-teste";

const RAIZ = process.cwd();

function arquivosDe(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = path.join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivosDe(caminho) : [caminho];
  });
}

const senhaDe = (variavel: string) => decodeURIComponent(new URL(process.env[variavel] as string).password);

const SEGREDOS = [
  process.env.SUPABASE_SECRET_KEY as string,
  process.env.CRM_BANCO_ADMIN_URL as string,
  process.env.CRM_BANCO_URL as string,
  senhaDe("CRM_BANCO_ADMIN_URL"),
  senhaDe("CRM_BANCO_URL"),
  ...Object.values(lerContasDeTeste().contas).map((c) => c.senha),
];

function comSegredo(arquivos: string[]): string[] {
  return arquivos.filter((arquivo) => {
    const conteudo = readFileSync(arquivo).toString("utf8");
    return SEGREDOS.some((segredo) => conteudo.includes(segredo));
  });
}

describe("Requisito 8: segredos fora do que é publicado", () => {
  test("todos os valores secretos foram carregados, para a comparação valer", () => {
    expect(SEGREDOS.every((s) => typeof s === "string" && s.length > 0)).toBe(true);
  });

  test("nenhum arquivo versionado contém os valores reais", () => {
    const versionados = execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map((a) => path.join(RAIZ, a));
    expect(comSegredo(versionados).map((a) => path.relative(RAIZ, a))).toEqual([]);
  });

  test("o pacote enviado ao navegador não contém a chave secreta, as conexões nem as senhas", () => {
    const pasta = path.join(RAIZ, ".next", "static");
    expect(existsSync(pasta)).toBe(true);
    const enviados = arquivosDe(pasta);
    expect(enviados.length).toBeGreaterThan(0);
    expect(comSegredo(enviados).map((a) => path.relative(RAIZ, a))).toEqual([]);
    const nomes = enviados.filter((a) => /\.js$/.test(a) && /SUPABASE_SECRET_KEY|CRM_BANCO_ADMIN_URL|CRM_BANCO_URL/.test(readFileSync(a, "utf8")));
    expect(nomes.map((a) => path.relative(RAIZ, a))).toEqual([]);
  });

  test("a chave pública é a única que chega ao navegador", () => {
    const pasta = path.join(RAIZ, ".next", "static");
    const comChavePublica = arquivosDe(pasta).filter((a) => readFileSync(a).toString("utf8").includes(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string));
    // O CRM não usa o cliente do Supabase no navegador: nem a chave pública precisa ir para lá.
    expect(comChavePublica.map((a) => path.relative(RAIZ, a))).toEqual([]);
  });
});
