/**
 * Trava exclusiva da pasta de dados do banco local (correção C1 da revisão de
 * homologação da Etapa 1).
 *
 * O PGlite não impede que dois programas abram a mesma pasta ao mesmo tempo, e
 * a revisão comprovou que isso perde gravações sem aviso. A trava é um arquivo
 * criado de forma atômica ao lado da pasta (por exemplo, .dados/pglite.trava),
 * com o número do processo que a detém. Se esse processo já tiver terminado sem
 * liberá-la, a trava é considerada abandonada e substituída.
 */
import { closeSync, openSync, readFileSync, rmSync, statSync, writeSync } from "node:fs";

type ConteudoTrava = { pid: number; desde: string; comando: string };

/** Tempo em que uma trava recém-criada, ainda sem conteúdo, é respeitada. */
const TOLERANCIA_TRAVA_INCOMPLETA_MS = 10_000;

export class BancoEmUsoError extends Error {
  constructor(arquivo: string, conteudo: ConteudoTrava | null) {
    const quem = conteudo
      ? `processo ${conteudo.pid}, desde ${new Date(conteudo.desde).toLocaleString("pt-BR")}`
      : "outro programa";
    super(
      `O banco de dados local já está em uso (${quem}). Feche a aplicação ou o script que o ` +
        `está usando e tente novamente. Se tiver certeza de que nenhum programa está usando o ` +
        `banco, apague o arquivo ${arquivo}.`,
    );
    this.name = "BancoEmUsoError";
  }
}

export function arquivoDaTrava(diretorio: string): string {
  return `${diretorio}.trava`;
}

function processoAtivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    // EPERM: o processo existe, mas pertence a outro usuário do sistema.
    return (erro as NodeJS.ErrnoException).code === "EPERM";
  }
}

function lerTrava(arquivo: string): ConteudoTrava | null {
  try {
    const conteudo = JSON.parse(readFileSync(arquivo, "utf8")) as ConteudoTrava;
    return Number.isInteger(conteudo.pid) ? conteudo : null;
  } catch {
    return null;
  }
}

function travaRecente(arquivo: string): boolean {
  try {
    return Date.now() - statSync(arquivo).mtimeMs < TOLERANCIA_TRAVA_INCOMPLETA_MS;
  } catch {
    return false;
  }
}

const travasDoProcesso = new Set<string>();
let liberacaoRegistrada = false;

function liberarArquivo(arquivo: string) {
  if (lerTrava(arquivo)?.pid === process.pid) rmSync(arquivo, { force: true });
  travasDoProcesso.delete(arquivo);
}

/** Obtém a trava da pasta ou lança BancoEmUsoError se outro processo a detiver. */
export function adquirirTrava(diretorio: string): void {
  const arquivo = arquivoDaTrava(diretorio);
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const descritor = openSync(arquivo, "wx");
      const conteudo: ConteudoTrava = {
        pid: process.pid,
        desde: new Date().toISOString(),
        comando: process.argv.slice(1).join(" "),
      };
      writeSync(descritor, JSON.stringify(conteudo));
      closeSync(descritor);
      travasDoProcesso.add(arquivo);
      if (!liberacaoRegistrada) {
        process.once("exit", () => travasDoProcesso.forEach(liberarArquivo));
        liberacaoRegistrada = true;
      }
      return;
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro;
      const atual = lerTrava(arquivo);
      if (atual ? processoAtivo(atual.pid) : travaRecente(arquivo)) {
        throw new BancoEmUsoError(arquivo, atual);
      }
      // Trava abandonada por um processo que terminou sem liberá-la.
      rmSync(arquivo, { force: true });
    }
  }
  throw new BancoEmUsoError(arquivo, lerTrava(arquivo));
}

export function liberarTrava(diretorio: string): void {
  liberarArquivo(arquivoDaTrava(diretorio));
}

/** Indica se a pasta está travada por um processo ativo (usado antes de apagar o banco). */
export function travaAtiva(diretorio: string): ConteudoTrava | null {
  const atual = lerTrava(arquivoDaTrava(diretorio));
  return atual && processoAtivo(atual.pid) ? atual : null;
}
