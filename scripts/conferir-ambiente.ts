/**
 * Confere se o projeto Supabase de desenvolvimento está pronto (D-075), lendo o
 * arquivo .env.local, sem exibir nenhum valor e sem gravar nada no projeto.
 * Comando: npm run ambiente:conferir
 *
 * Cada verificação usa só a credencial de que precisa: a chave publishable para os
 * ajustes de autenticação, a chave secreta para confirmar que ela é válida e a
 * conexão administrativa para confirmar o banco.
 */
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import {
  conferirAjustesDeAutenticacao,
  conferirVariaveis,
  explicarFalhaDeConexao,
  type ItemConferido,
} from "./conferencia-ambiente";

const ESPERA_MS = 15_000;

loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
const ambiente = process.env;

async function conferirAutenticacao(): Promise<ItemConferido[]> {
  try {
    const resposta = await fetch(`${ambiente.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: ambiente.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!resposta.ok) {
      return [{ item: "Ajustes de autenticação", situacao: "problema", detalhe: `o Supabase respondeu ${resposta.status}: confira o endereço e a chave publishable` }];
    }
    return conferirAjustesDeAutenticacao(await resposta.json());
  } catch {
    return [{ item: "Ajustes de autenticação", situacao: "problema", detalhe: "sem resposta do Supabase: confira a internet e o endereço do projeto" }];
  }
}

async function conferirValidadeDaChaveSecreta(): Promise<ItemConferido> {
  const item = "Validade da chave secreta";
  const chave = ambiente.SUPABASE_SECRET_KEY ?? "";
  try {
    const resposta = await fetch(`${ambiente.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=1`, {
      headers: { apikey: chave, Authorization: `Bearer ${chave}` },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    return resposta.ok
      ? { item, situacao: "ok", detalhe: "aceita pelo Supabase" }
      : { item, situacao: "problema", detalhe: `o Supabase respondeu ${resposta.status}: copie novamente a chave secreta` };
  } catch {
    return { item, situacao: "problema", detalhe: "sem resposta do Supabase" };
  }
}

async function conferirBanco(): Promise<ItemConferido> {
  const item = "Conexão com o banco";
  const banco = postgres(ambiente.CRM_BANCO_ADMIN_URL ?? "", {
    max: 1,
    prepare: false,
    ssl: "require",
    connect_timeout: ESPERA_MS / 1000,
    onnotice: () => {},
  });
  try {
    const [linha] = await banco<{ versao: number }[]>`select current_setting('server_version_num')::int as versao`;
    return { item, situacao: "ok", detalhe: `PostgreSQL ${Math.floor((linha?.versao ?? 0) / 10000)}` };
  } catch (erro) {
    return { item, situacao: "problema", detalhe: explicarFalhaDeConexao((erro as { code?: unknown }).code) };
  } finally {
    await banco.end({ timeout: 5 }).catch(() => {});
  }
}

const SELOS = { ok: "[OK]      ", pendente: "[PENDENTE]", problema: "[PROBLEMA]" } as const;

async function principal() {
  const itens = conferirVariaveis(ambiente);
  const pronto = (nome: string) => itens.find((i) => i.item === nome)?.situacao === "ok";

  if (pronto("Endereço do projeto") && pronto("Chave publishable")) itens.push(...(await conferirAutenticacao()));
  if (pronto("Endereço do projeto") && pronto("Chave secreta")) itens.push(await conferirValidadeDaChaveSecreta());
  if (pronto("Conexão administrativa")) itens.push(await conferirBanco());

  console.log("Conferência do projeto Supabase de desenvolvimento (nenhum valor é exibido)\n");
  for (const { item, situacao, detalhe } of itens) console.log(`${SELOS[situacao]} ${item}: ${detalhe}`);

  // A conexão do papel crm_app é criada depois; o ambiente já pode estar pronto sem ela.
  const faltando = itens.filter((i) => i.situacao !== "ok" && !(i.item.startsWith("Conexão da aplicação") && i.situacao === "pendente"));
  console.log(faltando.length === 0 ? "\nAmbiente pronto para a Etapa 5." : `\nFaltam ${faltando.length} item(ns).`);
  process.exitCode = faltando.length === 0 ? 0 : 1;
}

void principal();
