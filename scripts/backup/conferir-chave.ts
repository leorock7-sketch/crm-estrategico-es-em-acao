/**
 * Confere se a chave privada do age guardada no gerenciador de senhas é a certa (D-084, item 9).
 * Comando, no SEU terminal: npm run backup:conferir-chave
 *
 * Cole a chave quando pedido: ela não aparece na tela, não é gravada em arquivo nem no registro. O
 * programa calcula a chave pública correspondente e compara com a configurada para as cópias. Só
 * depois desta conferência as cópias passam a contar como protegidas.
 */
import { createInterface } from "node:readline";
import { executar, exigir, programa } from "./comum";
import { registrar } from "./rotina-regras";

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

async function principal() {
  const chave = await lerSemMostrar("Cole a chave privada do age guardada no gerenciador de senhas (não aparece na tela) e tecle Enter: ");
  if (!/^AGE-SECRET-KEY-1[0-9A-Z]+$/.test(chave)) {
    console.log("[PROBLEMA] O texto colado não tem o formato de uma chave privada do age (começa com AGE-SECRET-KEY-1).");
    registrar(local, { etapa: "chave-conferida", resultado: "falha", duracao_ms: null, categoria: "formato-invalido" });
    return 1;
  }
  const r = executar(programa("CRM_AGE_BIN", "age-keygen"), ["-y"], process.env, `${chave}\n`);
  const publica = r.saida.trim();
  if (r.codigo === 0 && publica === destinatario) {
    console.log("[OK] A chave guardada corresponde à usada nas cópias. As cópias passam a contar como protegidas.");
    registrar(local, { etapa: "chave-conferida", resultado: "ok", duracao_ms: null, categoria: null });
    return 0;
  }
  console.log("[PROBLEMA] A chave colada não corresponde à usada nas cópias. Confira no gerenciador de senhas.");
  registrar(local, { etapa: "chave-conferida", resultado: "falha", duracao_ms: null, categoria: "chave-divergente" });
  return 1;
}

principal()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch(() => {
    console.error("Falha na conferência da chave.");
    process.exitCode = 1;
  });
