/**
 * Confere a chave privada do age e se ela abre uma cópia existente (D-084, item 9; D-085; D-086).
 *
 * Duas formas, no SEU terminal:
 * - npm run backup:conferir-chave -- --arquivo
 *   Lê a chave direto do arquivo local da identidade (CRM_BACKUP_IDENTIDADE_AGE, ou --arquivo=caminho).
 *   O conteúdo do arquivo não passa por este programa: o próprio age lê o arquivo, que não é
 *   alterado nem apagado (o programa confere o resumo do arquivo antes e depois, sem exibi-lo).
 * - npm run backup:conferir-chave
 *   Pede que a chave seja colada; ela não aparece na tela e não é gravada.
 *
 * O programa (1) calcula a chave pública correspondente e compara com a configurada para as cópias,
 * (2) abre, só na memória, cada arquivo da cópia íntegra mais recente da pasta local e compara o
 * conteúdo com o resumo SHA-256 do original guardado no manifesto e (3) mostra se a tarefa diária
 * continua habilitada no Agendador. O registro guarda só o resultado; nenhuma chave nem conteúdo.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { exigir, type Manifesto, programa } from "./comum";
import { conferirDestino, informarSituacaoDaTarefa, registrar } from "./rotina-regras";

const destinatario = exigir("CRM_BACKUP_DESTINATARIO_AGE");
const local = exigir("CRM_BACKUP_PASTA_LOCAL");
const opcaoArquivo = process.argv.find((a) => a === "--arquivo" || a.startsWith("--arquivo="));

/** De onde vem a chave: o arquivo, entregue ao age pelo caminho, ou o texto colado, pela entrada padrão. */
type Origem = { arquivo: string } | { texto: string };
const argumentosDaIdentidade = (origem: Origem) => ("arquivo" in origem ? origem.arquivo : "-");
const entradaDaIdentidade = (origem: Origem) => ("texto" in origem ? `${origem.texto}\n` : undefined);

function lerSemMostrar(pergunta: string): Promise<string> {
  return new Promise((resolver) => {
    const leitor = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let mostrarPergunta = true;
    (leitor as unknown as { _writeToOutput: (texto: string) => void })._writeToOutput = (texto: string) => {
      if (mostrarPergunta) process.stdout.write(texto);
    };
    leitor.question(pergunta, (resposta) => {
      leitor.close();
      process.stdout.write("\n");
      resolver(resposta.trim());
    });
    mostrarPergunta = false;
  });
}

const resumoDoArquivo = (arquivo: string) => createHash("sha256").update(readFileSync(arquivo)).digest("hex");

function chavePublica(origem: Origem): string | null {
  const r = spawnSync(programa("CRM_AGE_BIN", "age-keygen"), ["-y", argumentosDaIdentidade(origem)], {
    input: entradaDaIdentidade(origem),
    encoding: "utf8",
    windowsHide: true,
  });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Abre cada arquivo da cópia só na memória e compara com o resumo do original. */
function abrirCopiaNaMemoria(origem: Origem, pasta: string): { abertos: number; total: number } {
  const manifesto = JSON.parse(readFileSync(path.join(pasta, "manifesto.json"), "utf8")) as Manifesto;
  let abertos = 0;
  for (const arquivo of manifesto.arquivos) {
    const r = spawnSync(programa("CRM_AGE_BIN", "age"), ["-d", "-i", argumentosDaIdentidade(origem), path.join(pasta, arquivo.nome)], {
      input: entradaDaIdentidade(origem),
      maxBuffer: 512 * 1024 * 1024,
      windowsHide: true,
    });
    if (r.status === 0 && createHash("sha256").update(r.stdout).digest("hex") === arquivo.sha256Original) abertos += 1;
  }
  return { abertos, total: manifesto.arquivos.length };
}

async function principal() {
  const inicio = Date.now();
  const falhar = (mensagem: string, categoria: string) => {
    console.log(`[PROBLEMA] ${mensagem}`);
    registrar(local, { etapa: "chave-conferida", resultado: "falha", duracao_ms: Date.now() - inicio, categoria });
    return 1;
  };

  let origem: Origem;
  let resumoAntes: string | null = null;
  if (opcaoArquivo) {
    const arquivo = opcaoArquivo.includes("=") ? opcaoArquivo.slice("--arquivo=".length) : exigir("CRM_BACKUP_IDENTIDADE_AGE");
    if (!existsSync(arquivo)) return falhar(`Arquivo da chave não encontrado: ${arquivo}`, "arquivo-da-chave-ausente");
    console.log(`Chave lida do arquivo local ${arquivo} (o conteúdo não é exibido).`);
    resumoAntes = resumoDoArquivo(arquivo);
    origem = { arquivo };
  } else {
    const texto = await lerSemMostrar("Cole a chave privada do age (não aparece na tela) e tecle Enter: ");
    if (!/^AGE-SECRET-KEY-1[0-9A-Z]+$/.test(texto)) {
      return falhar("O texto colado não tem o formato de uma chave privada do age (começa com AGE-SECRET-KEY-1).", "formato-invalido");
    }
    origem = { texto };
  }

  if (chavePublica(origem) !== destinatario) {
    return falhar("A chave não corresponde à chave pública usada nas cópias.", "chave-divergente");
  }
  console.log("[OK] A chave corresponde à chave pública usada nas cópias.");

  const copia = conferirDestino(local).integras.sort().at(-1);
  if (!copia) return falhar("Não há cópia íntegra na pasta local para testar a abertura.", "sem-copia-integra");
  const { abertos, total } = abrirCopiaNaMemoria(origem, path.join(local, copia));
  if (abertos !== total) return falhar(`A chave abriu ${abertos} de ${total} arquivos da cópia ${copia}.`, "copia-nao-aberta");
  console.log(`[OK] A chave abriu os ${total} arquivos da cópia ${copia}, só na memória; conteúdo idêntico ao original (SHA-256 do manifesto).`);

  if ("arquivo" in origem) {
    if (resumoDoArquivo(origem.arquivo) !== resumoAntes) return falhar("O arquivo da chave mudou durante a conferência.", "arquivo-da-chave-alterado");
    console.log("[OK] Arquivo da chave preservado: não foi alterado nem apagado.");
  }
  registrar(local, { etapa: "chave-conferida", resultado: "ok", duracao_ms: Date.now() - inicio, categoria: null, copia });
  console.log("[OK] Conferência registrada (só o resultado).");
  return informarSituacaoDaTarefa() ? 0 : 1;
}

principal()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch(() => {
    console.error("Falha na conferência da chave.");
    process.exitCode = 1;
  });
