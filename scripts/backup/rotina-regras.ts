/**
 * Regras da rotina diária de cópias (D-084), sem dependência do banco: registro, cópia única por dia,
 * integridade das cópias, correspondência entre os destinos, trava contra execuções simultâneas e
 * pendências (ensaio mensal e conferência da chave privada).
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Manifesto, PREFIXO_COPIA } from "./comum";

export const ARQUIVO_REGISTRO = "registro-rotina.log";
export const ARQUIVO_TRAVA = ".rotina.trava";
export const PREFIXO_PARCIAL = ".parcial-";
/** Uma trava mais antiga que isto vem de execução interrompida e pode ser desfeita. */
export const TRAVA_VENCIDA_MS = 2 * 60 * 60 * 1000;
/** Ensaio de restauração mensal (D-084): passado este prazo, a rotina avisa. */
export const DIAS_ENSAIO = 31;

export type Registro = {
  data: string;
  etapa: string;
  resultado: "ok" | "falha" | "ignorada" | "alerta";
  duracao_ms: number | null;
  categoria: string | null;
  copia?: string;
};

/** Grava uma linha no registro: só data, etapa, resultado, duração, categoria e nome da cópia. */
export function registrar(pastaLocal: string, registro: Omit<Registro, "data"> & { data?: string }): Registro {
  const completo: Registro = { data: new Date().toISOString(), ...registro };
  appendFileSync(path.join(pastaLocal, ARQUIVO_REGISTRO), `${JSON.stringify(completo)}\n`);
  return completo;
}

export function lerRegistros(pastaLocal: string): Registro[] {
  const arquivo = path.join(pastaLocal, ARQUIVO_REGISTRO);
  if (!existsSync(arquivo)) return [];
  return readFileSync(arquivo, "utf8")
    .split("\n")
    .flatMap((linha) => {
      try {
        return linha.trim() ? [JSON.parse(linha) as Registro] : [];
      } catch {
        return [];
      }
    });
}

export const diaEmBrasilia = (data: Date) => new Date(data.getTime() - 3 * 36e5).toISOString().slice(0, 10);

/** Uma cópia da rotina por dia (Brasília): execuções atrasadas ou repetidas no mesmo dia não duplicam. */
export function jaHouveCopiaDaRotinaHoje(registros: readonly Registro[], agora = new Date()): boolean {
  const hoje = diaEmBrasilia(agora);
  return registros.some((r) => r.etapa === "copia-rotina" && r.resultado === "ok" && diaEmBrasilia(new Date(r.data)) === hoje);
}

export function diasDesdeUltimoEnsaio(registros: readonly Registro[], agora = new Date()): number | null {
  const ensaios = registros.filter((r) => r.etapa === "ensaio" && r.resultado === "ok").map((r) => new Date(r.data).getTime());
  if (ensaios.length === 0) return null;
  return Math.floor((agora.getTime() - Math.max(...ensaios)) / 864e5);
}

/** A chave privada só conta como guardada depois de conferida (npm run backup:conferir-chave). */
export function chaveConferida(registros: readonly Registro[]): boolean {
  return registros.some((r) => r.etapa === "chave-conferida" && r.resultado === "ok");
}

const sha256 = (arquivo: string) => createHash("sha256").update(readFileSync(arquivo)).digest("hex");

/** Só arquivos criptografados e o manifesto (que não contém dados do CRM) podem estar numa cópia. */
const ARQUIVO_PERMITIDO = /^(manifesto\.json|[a-z]+\.(dump|json)\.age)$/;

export function copiaIntegra(pasta: string): { integra: boolean; motivo: string | null } {
  const arquivoManifesto = path.join(pasta, "manifesto.json");
  if (!existsSync(arquivoManifesto)) return { integra: false, motivo: "sem-manifesto" };
  let manifesto: Manifesto;
  try {
    manifesto = JSON.parse(readFileSync(arquivoManifesto, "utf8")) as Manifesto;
  } catch {
    return { integra: false, motivo: "manifesto-ilegivel" };
  }
  if (!Array.isArray(manifesto.arquivos) || manifesto.arquivos.length === 0) return { integra: false, motivo: "manifesto-vazio" };
  for (const nome of readdirSync(pasta)) {
    if (!ARQUIVO_PERMITIDO.test(nome)) return { integra: false, motivo: "arquivo-nao-permitido" };
  }
  for (const a of manifesto.arquivos) {
    const arquivo = path.join(pasta, a.nome);
    if (!existsSync(arquivo)) return { integra: false, motivo: "arquivo-ausente" };
    if (!a.nome.endsWith(".age")) return { integra: false, motivo: "arquivo-nao-criptografado" };
    if (statSync(arquivo).size !== a.bytes || sha256(arquivo) !== a.sha256) return { integra: false, motivo: "resumo-divergente" };
  }
  return { integra: true, motivo: null };
}

export type SituacaoDestino = { integras: string[]; problemas: { nome: string; motivo: string }[]; parciais: string[] };

export function conferirDestino(destino: string): SituacaoDestino {
  const situacao: SituacaoDestino = { integras: [], problemas: [], parciais: [] };
  if (!existsSync(destino)) return situacao;
  for (const nome of readdirSync(destino).sort()) {
    if (nome.startsWith(PREFIXO_PARCIAL)) situacao.parciais.push(nome);
    if (!nome.startsWith(PREFIXO_COPIA)) continue;
    const r = copiaIntegra(path.join(destino, nome));
    if (r.integra) situacao.integras.push(nome);
    else situacao.problemas.push({ nome, motivo: r.motivo as string });
  }
  return situacao;
}

/** Cópias íntegras que existem num destino e não no outro. */
export function divergenciasEntreDestinos(local: SituacaoDestino, nuvem: SituacaoDestino): string[] {
  const a = new Set(local.integras);
  const b = new Set(nuvem.integras);
  return [...[...a].filter((n) => !b.has(n)).map((n) => `${n}: só na pasta local`), ...[...b].filter((n) => !a.has(n)).map((n) => `${n}: só no Google Drive`)];
}

/** Trava contra execuções simultâneas (rotina, comando manual ou execução atrasada do agendador). */
export function adquirirTrava(pastaLocal: string, agora = Date.now()): boolean {
  const arquivo = path.join(pastaLocal, ARQUIVO_TRAVA);
  if (existsSync(arquivo)) {
    try {
      const { inicio } = JSON.parse(readFileSync(arquivo, "utf8")) as { inicio: number };
      if (agora - inicio < TRAVA_VENCIDA_MS) return false;
    } catch {
      // Trava ilegível: tratada como vencida.
    }
  }
  writeFileSync(arquivo, JSON.stringify({ inicio: agora, processo: process.pid }));
  return true;
}

export function liberarTrava(pastaLocal: string) {
  rmSync(path.join(pastaLocal, ARQUIVO_TRAVA), { force: true });
}
