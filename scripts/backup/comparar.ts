/**
 * Conferência de integridade depois de uma reativação ou incidente (C7, D-082). Comando: npm run backup:comparar
 *
 * Compara, tabela a tabela, as contagens atuais do banco de desenvolvimento com as da cópia mais recente.
 * O CRM nunca apaga registros (só arquiva): contagem MENOR que a da cópia indica perda e pede restauração;
 * contagem maior indica registros incluídos depois da cópia. Só lê; nada é gravado.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { eliminarArquivoComSobrescrita } from "../conferencia-ambiente";
import { type Contagens, executarOuFalhar, exigir, type Manifesto, mascarar, PREFIXO_COPIA, programa, sha256 } from "./comum";

async function principal(): Promise<number> {
  const local = exigir("CRM_BACKUP_PASTA_LOCAL");
  const copias = readdirSync(local).filter((n) => n.startsWith(PREFIXO_COPIA)).sort();
  if (copias.length === 0) throw new Error("Nenhuma cópia na pasta local.");
  const pastaCopia = path.join(local, copias[copias.length - 1]);
  const manifesto = JSON.parse(readFileSync(path.join(pastaCopia, "manifesto.json"), "utf8")) as Manifesto;
  const registro = manifesto.arquivos.find((a) => a.nome === "contagens.json.age");
  if (!registro || sha256(path.join(pastaCopia, registro.nome)) !== registro.sha256) throw new Error("Contagens da cópia ausentes ou alteradas.");

  const temporaria = mkdtempSync(path.join(tmpdir(), "crm-comparar-"));
  const aberto = path.join(temporaria, "contagens.json");
  let contagens: Contagens;
  try {
    executarOuFalhar(programa("CRM_AGE_BIN", "age"), ["--decrypt", "--identity", exigir("CRM_BACKUP_IDENTIDADE_AGE"), "--output", aberto, path.join(pastaCopia, registro.nome)]);
    contagens = JSON.parse(readFileSync(aberto, "utf8")) as Contagens;
  } finally {
    if (existsSync(aberto)) eliminarArquivoComSobrescrita(aberto);
    rmSync(temporaria, { recursive: true, force: true });
  }

  const sql = postgres(exigir("CRM_BANCO_ADMIN_URL"), { max: 1, prepare: false, ssl: "require", onnotice: () => {} });
  const perdas: string[] = [];
  let novas = 0;
  try {
    await sql.begin("isolation level repeatable read read only", async (tx) => {
      for (const [tabela, naCopia] of Object.entries(contagens.tabelas)) {
        const [{ n }] = await tx.unsafe(`select count(*)::int as n from public."${tabela}"`);
        if (n < naCopia) perdas.push(`${tabela}: ${naCopia} na cópia, ${n} agora`);
        else if (n > naCopia) novas++;
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
  console.log(`Cópia de referência: ${path.basename(pastaCopia)} (${Object.keys(contagens.tabelas).length} tabelas).`);
  console.log(`[${perdas.length === 0 ? "OK" : "PROBLEMA"}] ${perdas.length} tabela(s) com menos registros que a cópia; ${novas} com registros novos desde a cópia.`);
  for (const p of perdas) console.log(`  - ${p}`);
  if (perdas.length > 0) console.log("Não grave nada e siga o procedimento de restauração (docs/OPERACAO.md, seção 5).");
  return perdas.length === 0 ? 0 : 1;
}

principal()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((erro) => {
    console.error(`Falha na conferência: ${mascarar(erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido").slice(0, 300)}`);
    process.exitCode = 1;
  });
