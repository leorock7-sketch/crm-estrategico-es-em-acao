/**
 * Credenciais da hospedagem de testes no Netlify (Etapa 7B, D-087).
 * Comando: npm run hospedagem:credenciais -- --site=<identificador do site no Netlify>
 *
 * Envia ao Netlify SOMENTE as quatro variáveis de que a aplicação precisa no servidor, lidas do
 * .env.local, e substitui qualquer outra que exista lá. Nunca envia a conexão administrativa.
 * Nada é exibido: nem valores, nem endereços de conexão. Antes, confere que:
 * - a conexão da aplicação é a do papel restrito crm_app, pelo pooler de transações, do mesmo projeto;
 * - esse projeto é o de desenvolvimento autorizado neste computador, marcado como descartável e só
 *   com dados fictícios (a mesma proteção usada pelas cópias de segurança).
 * O arquivo temporário da importação fica em .dados (fora do Git) e é sobrescrito e apagado em seguida.
 * Requer a ferramenta do Netlify com o login feito pelo gestor (netlify login).
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { abrirBancoPostgres, fecharBanco } from "@/lib/banco/conexao";
import { exigir } from "../backup/comum";
import { eliminarArquivoComSobrescrita } from "../conferencia-ambiente";
import { conferirConfiguracao, motivosContraCargaDeTeste } from "../protecao-destrutiva";
import { motivosContraConexaoDaAplicacao, VARIAVEIS_DA_HOSPEDAGEM } from "./regras";

/** Segredos do servidor: depois de gravados, deixam de poder ser lidos de volta no painel (quando o plano permitir). */
const SEGREDOS = ["CRM_BANCO_URL", "SUPABASE_SECRET_KEY"];

const CLI = process.env.CRM_NETLIFY_CLI ?? "C:/Projetos/ferramentas/netlify/node_modules/netlify-cli/bin/run.js";
const site = process.argv.find((a) => a.startsWith("--site="))?.slice("--site=".length);

function netlify(argumentos: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...argumentos, "--site", site as string], { encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  // A saída pode conter valores: nunca é exibida.
  return { codigo: r.status ?? 1, saida: r.stdout ?? "" };
}

async function principal(): Promise<number> {
  if (!site) {
    console.log("Informe o site: npm run hospedagem:credenciais -- --site=<identificador>");
    return 1;
  }
  const { referencia, motivos } = conferirConfiguracao(process.env);
  if (!referencia || motivos.length > 0) {
    console.log(`[RECUSADO] Configuração local não é a do projeto de desenvolvimento autorizado (${motivos.length} motivo(s)).`);
    return 1;
  }
  const contraConexao = motivosContraConexaoDaAplicacao(process.env.CRM_BANCO_URL, referencia);
  if (contraConexao.length > 0) {
    for (const m of contraConexao) console.log(`[RECUSADO] ${m}`);
    return 1;
  }
  const banco = abrirBancoPostgres(exigir("CRM_BANCO_ADMIN_URL"), { max: 1 });
  try {
    const contra = await motivosContraCargaDeTeste(banco, process.env);
    if (contra.length > 0) {
      console.log(`[RECUSADO] O banco não está identificado como descartável e só com dados fictícios (${contra.length} motivo(s)).`);
      return 1;
    }
  } finally {
    await fecharBanco(banco);
  }
  console.log("[OK] Projeto de desenvolvimento autorizado, descartável e só com dados fictícios; conexão da aplicação restrita (crm_app).");

  const arquivo = path.join(process.cwd(), ".dados", `netlify-importacao-${Date.now()}.env`);
  writeFileSync(arquivo, `${VARIAVEIS_DA_HOSPEDAGEM.map((nome) => `${nome}=${exigir(nome)}`).join("\n")}\n`, { mode: 0o600 });
  let importado: boolean;
  try {
    importado = netlify(["env:import", arquivo, "--replace-existing"]).codigo === 0;
  } finally {
    eliminarArquivoComSobrescrita(arquivo);
  }
  if (!importado) {
    console.log("[PROBLEMA] O Netlify recusou a importação (confira o login da ferramenta e o identificador do site).");
    return 1;
  }

  const segredos: string[] = [];
  for (const nome of SEGREDOS) {
    if (netlify(["env:set", nome, "--secret", "--force"]).codigo === 0) segredos.push(nome);
  }

  const lista = netlify(["env:list", "--json"]);
  const nomes = lista.codigo === 0 ? Object.keys(JSON.parse(lista.saida) as Record<string, unknown>).sort() : [];
  const esperadas = [...VARIAVEIS_DA_HOSPEDAGEM].sort();
  const iguais = nomes.length === esperadas.length && nomes.every((n, i) => n === esperadas[i]);
  console.log(`[${iguais ? "OK" : "PROBLEMA"}] Variáveis no Netlify (só nomes): ${nomes.join(", ") || "nenhuma lida"}.`);
  console.log(
    segredos.length === SEGREDOS.length
      ? `[OK] Marcadas como secretas (não podem ser lidas de volta): ${segredos.join(", ")}.`
      : `[AVISO] Marcação como secreta indisponível para: ${SEGREDOS.filter((s) => !segredos.includes(s)).join(", ")} (recurso possivelmente fora do plano Free); os valores continuam só no servidor.`,
  );
  return iguais ? 0 : 1;
}

principal()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch(() => {
    console.log("Falha ao configurar as credenciais da hospedagem.");
    process.exitCode = 1;
  });
