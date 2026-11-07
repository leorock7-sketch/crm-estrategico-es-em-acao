/**
 * Confere se a chave privada do age guardada no gerenciador de senhas é a certa e se ela abre uma
 * cópia existente (D-084, item 9; D-085). Comando, no SEU terminal: npm run backup:conferir-chave
 *
 * Cole a chave quando pedido: ela não aparece na tela, não é gravada em arquivo nem no registro. O
 * programa (1) calcula a chave pública correspondente e compara com a configurada para as cópias e
 * (2) abre, só na memória, cada arquivo da cópia íntegra mais recente da pasta local, comparando o
 * conteúdo com o resumo SHA-256 do original guardado no manifesto. Nenhum conteúdo aberto é gravado.
 * Só depois desta conferência as cópias passam a contar como protegidas.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { executar, exigir, type Manifesto, programa } from "./comum";
import { conferirDestino, registrar } from "./rotina-regras";

const destinatario = exigir("CRM_BACKUP_DESTINATARIO_AGE");
const local = exigir("CRM_BACKUP_PASTA_LOCAL");

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

/** Abre cada arquivo da cópia só na memória e compara com o resumo do original. */
function abrirCopiaNaMemoria(chave: string, pasta: string): { abertos: number; total: number } {
  const manifesto = JSON.parse(readFileSync(path.join(pasta, "manifesto.json"), "utf8")) as Manifesto;
  let abertos = 0;
  for (const arquivo of manifesto.arquivos) {
    const r = spawnSync(programa("CRM_AGE_BIN", "age"), ["-d", "-i", "-", path.join(pasta, arquivo.nome)], {
      input: `${chave}\n`,
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

  const chave = await lerSemMostrar("Cole a chave privada do age guardada no gerenciador de senhas (não aparece na tela) e tecle Enter: ");
  if (!/^AGE-SECRET-KEY-1[0-9A-Z]+$/.test(chave)) {
    return falhar("O texto colado não tem o formato de uma chave privada do age (começa com AGE-SECRET-KEY-1).", "formato-invalido");
  }
  const publica = executar(programa("CRM_AGE_BIN", "age-keygen"), ["-y"], process.env, `${chave}\n`);
  if (publica.codigo !== 0 || publica.saida.trim() !== destinatario) {
    return falhar("A chave colada não corresponde à usada nas cópias. Confira no gerenciador de senhas.", "chave-divergente");
  }
  console.log("[OK] A chave colada corresponde à chave pública usada nas cópias.");

  const integras = conferirDestino(local).integras.sort();
  const copia = integras.at(-1);
  if (!copia) return falhar("Não há cópia íntegra na pasta local para testar a abertura.", "sem-copia-integra");
  const { abertos, total } = abrirCopiaNaMemoria(chave, path.join(local, copia));
  if (abertos !== total) {
    return falhar(`A chave abriu ${abertos} de ${total} arquivos da cópia ${copia}.`, "copia-nao-aberta");
  }
  console.log(`[OK] A chave abriu os ${total} arquivos da cópia ${copia}, só na memória; conteúdo idêntico ao original (SHA-256).`);
  console.log("[OK] As cópias passam a contar como protegidas.");
  registrar(local, { etapa: "chave-conferida", resultado: "ok", duracao_ms: Date.now() - inicio, categoria: null, copia });
  return 0;
}

principal()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch(() => {
    console.error("Falha na conferência da chave.");
    process.exitCode = 1;
  });
