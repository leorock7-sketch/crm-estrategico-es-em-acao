// @vitest-environment node
/**
 * Rotina diária de cópias (D-084): regras sem banco, com pastas temporárias e arquivos fictícios.
 */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { selecionarParaManter } from "../scripts/backup/retencao";
import {
  adquirirTrava,
  ARQUIVO_REGISTRO,
  ARQUIVO_TRAVA,
  chaveConferida,
  conferirDestino,
  copiaIntegra,
  diasDesdeUltimoEnsaio,
  divergenciasEntreDestinos,
  jaHouveCopiaDaRotinaHoje,
  lerRegistros,
  liberarTrava,
  type Registro,
  registrar,
  TRAVA_VENCIDA_MS,
} from "../scripts/backup/rotina-regras";

const base = mkdtempSync(path.join(tmpdir(), "crm-rotina-teste-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

let contador = 0;
const pastaNova = () => {
  const p = path.join(base, `caso-${contador++}`);
  mkdirSync(p, { recursive: true });
  return p;
};

/** Cria uma cópia fictícia com manifesto coerente; os "arquivos criptografados" são só bytes de teste. */
function criarCopia(destino: string, nome: string, extras: Record<string, string> = {}) {
  const pasta = path.join(destino, nome);
  mkdirSync(pasta, { recursive: true });
  const arquivos = ["aplicacao.dump.age", "autenticacao.dump.age", "contagens.json.age"].map((n) => {
    const conteudo = Buffer.from(`conteudo-ficticio-${nome}-${n}`);
    writeFileSync(path.join(pasta, n), conteudo);
    return { nome: n, bytes: conteudo.length, sha256: createHash("sha256").update(conteudo).digest("hex"), sha256Original: "x", entradasNoIndice: 1 };
  });
  writeFileSync(path.join(pasta, "manifesto.json"), JSON.stringify({ formato: 1, criadaEm: "", origem: "", versaoPgDump: "", versaoServidor: "", duracaoMs: 0, arquivos }));
  for (const [n, c] of Object.entries(extras)) writeFileSync(path.join(pasta, n), c);
  return pasta;
}

const registro = (etapa: string, resultado: Registro["resultado"], data: string): Registro => ({ data, etapa, resultado, duracao_ms: 1, categoria: null });

describe("Registro da rotina", () => {
  test("grava só os campos previstos e ignora linhas inválidas na leitura", () => {
    const pasta = pastaNova();
    registrar(pasta, { etapa: "copia-rotina", resultado: "ok", duracao_ms: 10, categoria: null, copia: "crm-backup-2026-11-07T12-30-00" });
    writeFileSync(path.join(pasta, ARQUIVO_REGISTRO), `${readFileSync(path.join(pasta, ARQUIVO_REGISTRO), "utf8")}linha quebrada\n`);
    const lidos = lerRegistros(pasta);
    expect(lidos).toHaveLength(1);
    expect(Object.keys(lidos[0]).sort()).toEqual(["categoria", "copia", "data", "duracao_ms", "etapa", "resultado"]);
  });

  test("uma cópia da rotina por dia, no calendário de Brasília", () => {
    const agora = new Date("2026-11-08T15:30:00Z"); // 12:30 em Brasília
    expect(jaHouveCopiaDaRotinaHoje([registro("copia-rotina", "ok", "2026-11-08T03:30:00Z")], agora)).toBe(true); // 00:30 do dia 8
    expect(jaHouveCopiaDaRotinaHoje([registro("copia-rotina", "ok", "2026-11-08T02:30:00Z")], agora)).toBe(false); // 23:30 do dia 7
    expect(jaHouveCopiaDaRotinaHoje([registro("copia-rotina", "falha", "2026-11-08T14:00:00Z")], agora)).toBe(false);
    expect(jaHouveCopiaDaRotinaHoje([registro("copia-rotina", "ignorada", "2026-11-08T14:00:00Z")], agora)).toBe(false);
  });

  test("ensaio mensal e conferência da chave privada", () => {
    const agora = new Date("2026-12-20T15:00:00Z");
    expect(diasDesdeUltimoEnsaio([], agora)).toBeNull();
    expect(diasDesdeUltimoEnsaio([registro("ensaio", "ok", "2026-11-07T21:00:00Z"), registro("ensaio", "falha", "2026-12-19T21:00:00Z")], agora)).toBe(42);
    expect(chaveConferida([registro("chave-conferida", "falha", "2026-11-07T21:00:00Z")])).toBe(false);
    expect(chaveConferida([registro("chave-conferida", "ok", "2026-11-07T21:00:00Z")])).toBe(true);
    expect(chaveConferida([registro("chave-conferida", "ok", "2026-11-07T21:00:00Z"), registro("chave-conferida", "falha", "2026-11-08T21:00:00Z")])).toBe(false);
  });
});

describe("Integridade das cópias e correspondência entre os destinos", () => {
  test("cópia coerente com o manifesto é íntegra; alteração de um byte não é", () => {
    const destino = pastaNova();
    const pasta = criarCopia(destino, "crm-backup-2026-11-07T12-30-00");
    expect(copiaIntegra(pasta)).toEqual({ integra: true, motivo: null });
    writeFileSync(path.join(pasta, "aplicacao.dump.age"), "conteudo-ficticio-crm-backup-2026-11-07T12-30-00-aplicacao.dump.agX");
    expect(copiaIntegra(pasta)).toEqual({ integra: false, motivo: "resumo-divergente" });
  });

  test("arquivo sem criptografia numa pasta de cópia é recusado (nada em texto aberto nos destinos)", () => {
    const destino = pastaNova();
    expect(copiaIntegra(criarCopia(destino, "crm-backup-2026-11-07T12-30-00", { "aplicacao.dump": "texto aberto" })).motivo).toBe("arquivo-nao-permitido");
    expect(copiaIntegra(criarCopia(destino, "crm-backup-2026-11-07T12-31-00", { "contagens.json": "{}" })).motivo).toBe("arquivo-nao-permitido");
    const semManifesto = path.join(destino, "crm-backup-2026-11-07T12-32-00");
    mkdirSync(semManifesto);
    expect(copiaIntegra(semManifesto).motivo).toBe("sem-manifesto");
  });

  test("conferência dos destinos: íntegras, com problema, provisórias e divergências", () => {
    const local = pastaNova();
    const nuvem = pastaNova();
    for (const destino of [local, nuvem]) {
      criarCopia(destino, "crm-backup-2026-11-06T12-30-00");
      criarCopia(destino, "crm-backup-2026-11-07T12-30-00");
    }
    criarCopia(local, "crm-backup-2026-11-08T12-30-00");
    mkdirSync(path.join(nuvem, ".parcial-crm-backup-2026-11-08T12-30-00"));
    const sLocal = conferirDestino(local);
    const sNuvem = conferirDestino(nuvem);
    expect(sLocal.integras).toHaveLength(3);
    expect(sNuvem.integras).toHaveLength(2);
    expect(sNuvem.parciais).toEqual([".parcial-crm-backup-2026-11-08T12-30-00"]);
    expect(divergenciasEntreDestinos(sLocal, sNuvem)).toEqual(["crm-backup-2026-11-08T12-30-00: só na pasta local"]);
  });

  test("a retenção só considera cópias íntegras: uma cópia nova danificada nunca tira o lugar da última íntegra", () => {
    const destino = pastaNova();
    criarCopia(destino, "crm-backup-2026-11-07T12-30-00");
    const danificada = criarCopia(destino, "crm-backup-2026-11-08T12-30-00");
    writeFileSync(path.join(danificada, "contagens.json.age"), "danificado");
    const situacao = conferirDestino(destino);
    expect(situacao.integras).toEqual(["crm-backup-2026-11-07T12-30-00"]);
    expect(situacao.problemas).toEqual([{ nome: "crm-backup-2026-11-08T12-30-00", motivo: "resumo-divergente" }]);
    const manter = selecionarParaManter(situacao.integras, new Date("2026-11-08T16:00:00Z"));
    expect(manter.has("crm-backup-2026-11-07T12-30-00")).toBe(true);
  });
});

describe("Trava contra execuções simultâneas", () => {
  test("a segunda execução não começa enquanto a primeira está em curso; trava vencida é desfeita", () => {
    const pasta = pastaNova();
    expect(adquirirTrava(pasta)).toBe(true);
    expect(adquirirTrava(pasta)).toBe(false);
    liberarTrava(pasta);
    expect(adquirirTrava(pasta)).toBe(true);
    writeFileSync(path.join(pasta, ARQUIVO_TRAVA), JSON.stringify({ inicio: Date.now() - TRAVA_VENCIDA_MS - 1000 }));
    expect(adquirirTrava(pasta)).toBe(true);
    liberarTrava(pasta);
  });
});
