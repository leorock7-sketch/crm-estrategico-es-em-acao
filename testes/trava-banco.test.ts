// @vitest-environment node
/**
 * Trava exclusiva da pasta de dados (correção C1) e proteção de ambiente (C3).
 * A revisão de homologação comprovou que dois processos na mesma pasta perdiam
 * gravações sem aviso; estes testes garantem que o segundo acesso é recusado.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { abrirBanco, fecharBanco, verificarUsoDoBancoLocal } from "@/lib/banco/conexao";
import { adquirirTrava, arquivoDaTrava, BancoEmUsoError, liberarTrava } from "@/lib/banco/trava";

let base: string;
let pasta: string;
let processoVizinho: ChildProcess | undefined;

beforeEach(() => {
  base = mkdtempSync(path.join(tmpdir(), "crm-trava-"));
  pasta = path.join(base, "pglite");
});

afterEach(() => {
  processoVizinho?.kill();
  liberarTrava(pasta);
  rmSync(base, { recursive: true, force: true });
});

function iniciarProcessoVizinho(): Promise<ChildProcess> {
  return new Promise((resolve) => {
    const filho = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });
    filho.once("spawn", () => resolve(filho));
  });
}

function encerrar(filho: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    filho.once("exit", () => resolve());
    filho.kill();
  });
}

describe("Trava da pasta de dados", () => {
  test("recusa a segunda abertura da mesma pasta, com mensagem clara", () => {
    adquirirTrava(pasta);
    expect(() => adquirirTrava(pasta)).toThrow(BancoEmUsoError);
    expect(() => adquirirTrava(pasta)).toThrow(/já está em uso/);
  });

  test("respeita a trava de outro processo ativo e a substitui depois que ele termina", async () => {
    processoVizinho = await iniciarProcessoVizinho();
    writeFileSync(
      arquivoDaTrava(pasta),
      JSON.stringify({ pid: processoVizinho.pid, desde: new Date().toISOString(), comando: "vizinho" }),
    );
    expect(() => adquirirTrava(pasta)).toThrow(`processo ${processoVizinho.pid}`);

    await encerrar(processoVizinho);
    processoVizinho = undefined;
    expect(() => adquirirTrava(pasta)).not.toThrow();
  });

  test("abrirBanco não abre pasta travada; fecharBanco libera a trava", async () => {
    adquirirTrava(pasta);
    await expect(abrirBanco(pasta)).rejects.toThrow(BancoEmUsoError);
    liberarTrava(pasta);
    expect(existsSync(arquivoDaTrava(pasta))).toBe(false);

    const banco = await abrirBanco(pasta);
    expect(existsSync(arquivoDaTrava(pasta))).toBe(true);
    await fecharBanco(banco);
    expect(existsSync(arquivoDaTrava(pasta))).toBe(false);
  }, 60_000);
});

describe("Proteção de ambiente", () => {
  test("em produção, o banco local exige autorização explícita", () => {
    expect(() => verificarUsoDoBancoLocal({ NODE_ENV: "production" })).toThrow(/não pode ser usado em produção/);
    expect(() => verificarUsoDoBancoLocal({ NODE_ENV: "production", CRM_BANCO: "pglite" })).not.toThrow();
    expect(() => verificarUsoDoBancoLocal({ NODE_ENV: "development" })).not.toThrow();
    expect(() => verificarUsoDoBancoLocal({ NODE_ENV: "test" })).not.toThrow();
  });
});
