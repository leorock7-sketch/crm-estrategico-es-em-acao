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

/** Públicas (vão para o navegador): compilação e execução. */
const PUBLICAS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
/**
 * Segredos do servidor, marcados como secretos: depois de gravados, não podem ser lidos de volta no
 * painel nem pela ferramenta, e o Netlify interrompe a compilação se o valor aparecer nos arquivos
 * gerados. O plano Free não permite restringir escopos (conferido em 07/11/2026: a opção é ignorada),
 * por isso eles ficam também disponíveis na compilação, que não os usa (compilação aprovada sem eles).
 * Contextos: produção, prévias e ramos publicados (a marcação secreta exige contexto explícito).
 */
const SEGREDOS = ["CRM_BANCO_URL", "SUPABASE_SECRET_KEY"];
const CONTEXTOS_DOS_SEGREDOS = ["production", "deploy-preview", "branch-deploy"];

const CLI = process.env.CRM_NETLIFY_CLI ?? "C:/Projetos/ferramentas/netlify/node_modules/netlify-cli/bin/run.js";
const site = process.argv.find((a) => a.startsWith("--site="))?.slice("--site=".length);

function netlify(argumentos: string[], comSite = true) {
  // --use-system-ca: a conexão com a API do Netlify é validada pelo repositório de certificados do Windows.
  const r = spawnSync(process.execPath, ["--use-system-ca", CLI, ...argumentos, ...(comSite ? ["--site", site as string] : [])], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
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

  // 1. Públicas, pela importação: substitui tudo o que houver no site (nada além das quatro fica lá).
  const arquivo = path.join(process.cwd(), ".dados", `netlify-importacao-${Date.now()}.env`);
  writeFileSync(arquivo, `${PUBLICAS.map((nome) => `${nome}=${exigir(nome)}`).join("\n")}\n`, { mode: 0o600 });
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

  // 2. Segredos, um a um, marcados como secretos.
  for (const nome of SEGREDOS) {
    if (netlify(["env:set", nome, exigir(nome), "--context", ...CONTEXTOS_DOS_SEGREDOS, "--secret", "--force"]).codigo !== 0) {
      console.log(`[PROBLEMA] O Netlify recusou a gravação de ${nome}.`);
      return 1;
    }
  }

  // 3. Conferência pela API: nomes, escopos e marcação secreta (nunca os valores).
  const dadosDoSite = netlify(["api", "getSite", "--data", JSON.stringify({ site_id: site })], false);
  const conta = dadosDoSite.codigo === 0 ? (JSON.parse(dadosDoSite.saida) as { account_id: string }).account_id : "";
  const lista = netlify(["api", "getEnvVars", "--data", JSON.stringify({ account_id: conta, site_id: site })], false);
  const variaveis = lista.codigo === 0 ? (JSON.parse(lista.saida) as { key: string; scopes: string[]; is_secret?: boolean }[]) : [];
  for (const v of variaveis.sort((a, b) => a.key.localeCompare(b.key))) {
    console.log(`  ${v.key}: escopos ${[...v.scopes].sort().join(", ")}${v.is_secret ? "; secreta" : ""}`);
  }
  const nomes = variaveis.map((v) => v.key).sort();
  const esperadas = [...VARIAVEIS_DA_HOSPEDAGEM].sort();
  const iguais = nomes.length === esperadas.length && nomes.every((n, i) => n === esperadas[i]);
  const segredosCertos = variaveis
    .filter((v) => SEGREDOS.includes(v.key))
    .every((v) => v.is_secret === true && ["functions", "runtime"].every((e) => v.scopes.includes(e)));
  const publicasCertas = variaveis.filter((v) => PUBLICAS.includes(v.key)).every((v) => v.scopes.includes("builds") && v.scopes.includes("functions"));
  console.log(`[${iguais ? "OK" : "PROBLEMA"}] Variáveis no Netlify: só as quatro da aplicação.`);
  console.log(`[${segredosCertos ? "OK" : "PROBLEMA"}] Segredos marcados como secretos e disponíveis na execução.`);
  console.log(`[${publicasCertas ? "OK" : "PROBLEMA"}] Públicas disponíveis na compilação e na execução.`);
  console.log("[AVISO] O plano Free não restringe escopos: os segredos também ficam disponíveis na compilação, que não os usa.");
  return iguais && segredosCertos && publicasCertas ? 0 : 1;
}

principal()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch(() => {
    console.log("Falha ao configurar as credenciais da hospedagem.");
    process.exitCode = 1;
  });
