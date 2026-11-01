/**
 * Apaga o banco LOCAL de desenvolvimento (pasta .dados/pglite), que contém
 * apenas dados fictícios. Na próxima execução da aplicação, um banco novo é
 * criado com a estrutura e os comitês. Comando: npm run banco:reiniciar
 *
 * Execute com a aplicação parada.
 */
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { diretorioDoBanco } from "@/lib/banco/conexao";
import { arquivoDaTrava, travaAtiva } from "@/lib/banco/trava";

const diretorio = diretorioDoBanco();
const relativo = path.relative(process.cwd(), diretorio);
// Proteção: só apaga pastas dentro do projeto, nunca o próprio projeto.
if (!relativo || relativo.startsWith("..") || path.isAbsolute(relativo)) {
  console.error(`Recusado: ${diretorio} não é uma pasta interna do projeto.`);
  process.exit(1);
}
// Proteção: não apaga o banco enquanto outro programa o estiver usando.
const emUso = travaAtiva(diretorio);
if (emUso) {
  console.error(`Recusado: o banco está em uso pelo processo ${emUso.pid}. Pare a aplicação e tente de novo.`);
  process.exit(1);
}
rmSync(arquivoDaTrava(diretorio), { force: true });
if (existsSync(diretorio)) {
  rmSync(diretorio, { recursive: true, force: true });
  console.log(`Banco local apagado: ${diretorio}`);
} else {
  console.log(`Não havia banco local em ${diretorio}.`);
}
