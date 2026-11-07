/**
 * Proteção das operações destrutivas (D-076). ÚNICO lugar do projeto que apaga esquemas do banco.
 * Só apaga quando TODAS as condições abaixo são comprovadas; na dúvida, recusa, sem apagar nada.
 *
 * 1. A conexão aponta para um projeto Supabase identificado, no formato esperado.
 * 2. Esse projeto é o mesmo no endereço, na conexão e na lista local de autorizados
 *    (CRM_BANCO_DESCARTAVEL_REF, em .env.local).
 * 3. O próprio banco traz a marca de ambiente descartável, gravada de propósito em um esquema que
 *    não é apagado e que cita esse mesmo projeto. Banco sem a marca, ou copiado de outro, é recusado.
 * 4. Não há sinal de dado real: todas as contas e os e-mails usam domínios fictícios. É salvaguarda
 *    complementar, não comprovação de ausência de dados reais (nomes ou notas não são examinados).
 *    O que protege é a regra da D-077: banco marcado como descartável não recebe dados institucionais reais.
 * 5. Quem executa escreveu, nesta execução, a frase de confirmação com o identificador do projeto.
 * 6. Não é ambiente de produção nem de hospedagem ou integração contínua.
 *
 * Nome de ambiente, como "development" ou "test", nunca autoriza nada: a condição 6 só recusa.
 */
import { sql } from "drizzle-orm";
import type { Banco, Executor } from "@/lib/banco/conexao";

export type Ambiente = Record<string, string | undefined>;

export class OperacaoDestrutivaRecusadaError extends Error {
  constructor(readonly motivos: string[]) {
    super(`Operação recusada; nada foi apagado. ${motivos.join(" ")}`);
    this.name = "OperacaoDestrutivaRecusadaError";
  }
}

const FORMATO_REFERENCIA = /^[a-z0-9]{8,40}$/;
const POOLER_DA_REGIAO = /^aws-\d+-sa-east-1\.pooler\.supabase\.com$/;
const SINAIS_DE_HOSPEDAGEM = ["CI", "GITHUB_ACTIONS", "VERCEL", "VERCEL_ENV", "NETLIFY", "RENDER"];

/** Domínios reservados para exemplos (RFC 2606) e o domínio fictício fixo da demonstração. */
const DOMINIOS_FICTICIOS = String.raw`(\.invalid|\.test|\.example|[@.]example\.(com|org|net)|@exemplo\.org)$`;

export const fraseDeExclusao = (referencia: string) => `APAGAR DADOS FICTICIOS DE ${referencia}`;
export const fraseDeMarcacao = (referencia: string) => `MARCAR COMO DESCARTAVEL ${referencia}`;

/** Referência do projeto, se a conexão for a administrativa do Session pooler, no formato esperado. */
function referenciaDaConexao(conexao: string | undefined): string | null {
  if (!conexao) return null;
  try {
    const url = new URL(conexao);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") return null;
    if (!POOLER_DA_REGIAO.test(url.hostname) || url.port !== "5432" || url.pathname !== "/postgres") return null;
    const [papel, referencia, sobra] = url.username.split(".");
    if (papel !== "postgres" || sobra !== undefined || !referencia || !FORMATO_REFERENCIA.test(referencia)) return null;
    return referencia;
  } catch {
    return null;
  }
}

function referenciaDoEndereco(endereco: string | undefined): string | null {
  if (!endereco) return null;
  try {
    const url = new URL(endereco);
    const referencia = /^([a-z0-9]+)\.supabase\.co$/.exec(url.hostname)?.[1];
    return url.protocol === "https:" && referencia ? referencia : null;
  } catch {
    return null;
  }
}

/** Condições 1, 2 e 6, sem acessar o banco. */
export function conferirConfiguracao(
  ambiente: Ambiente,
  opcoes: { exigirListaLocal?: boolean } = {},
): { referencia: string | null; motivos: string[] } {
  const motivos: string[] = [];
  if (ambiente.NODE_ENV === "production") motivos.push("Ambiente de produção.");
  const sinais = SINAIS_DE_HOSPEDAGEM.filter((nome) => ambiente[nome]);
  if (sinais.length > 0) motivos.push(`Ambiente de hospedagem ou integração contínua (${sinais.join(", ")}).`);

  const referencia = referenciaDaConexao(ambiente.CRM_BANCO_ADMIN_URL);
  if (!referencia) {
    motivos.push("A conexão administrativa não é a de um projeto identificado (Session pooler, em sa-east-1).");
    return { referencia: null, motivos };
  }
  if (referenciaDoEndereco(ambiente.NEXT_PUBLIC_SUPABASE_URL) !== referencia) {
    motivos.push("O endereço do projeto não corresponde à conexão administrativa.");
  }
  if ((opcoes.exigirListaLocal ?? true) && ambiente.CRM_BANCO_DESCARTAVEL_REF !== referencia) {
    motivos.push("Este projeto não é o autorizado neste computador (CRM_BANCO_DESCARTAVEL_REF).");
  }
  return { referencia, motivos };
}

/** Condição 4: qualquer conta ou e-mail fora dos domínios fictícios impede a operação. */
async function motivosDeConteudo(banco: Executor): Promise<string[]> {
  const motivos: string[] = [];
  const contar = async (consulta: ReturnType<typeof sql>) =>
    ((await banco.execute(consulta)).rows[0] as { n: number }).n;
  const existe = async (tabela: string) =>
    ((await banco.execute(sql`select to_regclass(${tabela}) is not null as existe`)).rows[0] as { existe: boolean }).existe;

  if (await existe("public.usuario")) {
    const n = await contar(sql`select count(*)::int as n from public.usuario where lower(email) !~ ${DOMINIOS_FICTICIOS}`);
    if (n > 0) motivos.push(`Há ${n} usuário(s) com e-mail fora dos domínios fictícios.`);
  }
  if (await existe("public.contato")) {
    const n = await contar(
      sql`select count(*)::int as n from public.contato where tipo = 'email' and lower(valor) !~ ${DOMINIOS_FICTICIOS}`,
    );
    if (n > 0) motivos.push(`Há ${n} contato(s) de e-mail fora dos domínios fictícios.`);
  }
  if (await existe("auth.users")) {
    const n = await contar(
      sql`select count(*)::int as n from auth.users where email is null or lower(email) !~ ${DOMINIOS_FICTICIOS}`,
    );
    if (n > 0) motivos.push(`Há ${n} conta(s) de acesso fora dos domínios fictícios.`);
  }
  return motivos;
}

/** Condições 3 e 4, no próprio banco. Se não conseguir conferir, recusa. */
export async function conferirBanco(banco: Executor, referencia: string): Promise<string[]> {
  try {
    const marcas = (
      await banco.execute(sql`select to_regclass('crm_ambiente.identificacao') is not null as existe`)
    ).rows as { existe: boolean }[];
    if (!marcas[0]?.existe) return ["O banco não traz a marca de ambiente descartável."];
    const linhas = (
      await banco.execute(sql`select referencia_projeto, finalidade, dados_ficticios from crm_ambiente.identificacao`)
    ).rows as { referencia_projeto: string; finalidade: string; dados_ficticios: boolean }[];
    if (linhas.length !== 1) return ["A marca de ambiente descartável do banco é ambígua."];
    const [marca] = linhas;
    if (marca.referencia_projeto !== referencia) return ["A marca do banco cita outro projeto: pode ser uma cópia."];
    if (marca.finalidade !== "testes_descartaveis" || marca.dados_ficticios !== true) {
      return ["A marca do banco não declara testes descartáveis com dados fictícios."];
    }
    return await motivosDeConteudo(banco);
  } catch {
    return ["Não foi possível conferir o banco."];
  }
}

/** Grava a marca e, só com a frase de confirmação, em banco sem sinal de dado real. Não apaga nada. */
export async function marcarBancoDescartavel(banco: Banco, ambiente: Ambiente, confirmacao: string | undefined): Promise<string> {
  const { referencia, motivos } = conferirConfiguracao(ambiente, { exigirListaLocal: false });
  if (!referencia || motivos.length > 0) throw new OperacaoDestrutivaRecusadaError(motivos);
  if (confirmacao !== fraseDeMarcacao(referencia)) {
    throw new OperacaoDestrutivaRecusadaError(["Falta a frase de confirmação da marcação."]);
  }
  const doConteudo = await motivosDeConteudo(banco).catch(() => ["Não foi possível conferir o banco."]);
  if (doConteudo.length > 0) throw new OperacaoDestrutivaRecusadaError(doConteudo);
  await banco.transaction(async (tx) => {
    await tx.execute(sql`create schema if not exists crm_ambiente`);
    await tx.execute(sql`revoke all on schema crm_ambiente from public`);
    await tx.execute(sql`
      create table if not exists crm_ambiente.identificacao (
        referencia_projeto text primary key,
        finalidade text not null check (finalidade = 'testes_descartaveis'),
        dados_ficticios boolean not null check (dados_ficticios),
        marcado_em timestamptz not null default now()
      )`);
    await tx.execute(sql`
      insert into crm_ambiente.identificacao (referencia_projeto, finalidade, dados_ficticios)
      values (${referencia}, 'testes_descartaveis', true)
      on conflict (referencia_projeto) do nothing`);
  });
  return referencia;
}

/**
 * Apaga os dados do banco descartável, em uma única transação: confere tudo de novo e só então
 * apaga. Qualquer recusa ou falha desfaz a operação. A marca fica preservada, fora do esquema public.
 */
export async function apagarBancoDescartavel(banco: Banco, ambiente: Ambiente, confirmacao: string | undefined): Promise<void> {
  const { referencia, motivos } = conferirConfiguracao(ambiente);
  if (!referencia || motivos.length > 0) throw new OperacaoDestrutivaRecusadaError(motivos);
  if (confirmacao !== fraseDeExclusao(referencia)) {
    throw new OperacaoDestrutivaRecusadaError([
      "Falta a frase de confirmação: APAGAR DADOS FICTICIOS DE <identificador do projeto>, na variável CRM_CONFIRMAR_EXCLUSAO deste comando.",
    ]);
  }
  await banco.transaction(async (tx) => {
    const noBanco = await conferirBanco(tx, referencia);
    if (noBanco.length > 0) throw new OperacaoDestrutivaRecusadaError(noBanco);
    await tx.execute(sql`drop schema if exists drizzle cascade`);
    await tx.execute(sql`drop schema if exists public cascade`);
    await tx.execute(sql`create schema public`);
  });
}

/**
 * Carga de dados e de contas de teste: não apaga nada, mas não deve ocorrer fora do banco
 * descartável, porque criaria contas com senhas conhecidas. Devolve os motivos da recusa.
 */
export async function motivosContraCargaDeTeste(banco: Executor, ambiente: Ambiente): Promise<string[]> {
  const { referencia, motivos } = conferirConfiguracao(ambiente);
  if (!referencia || motivos.length > 0) return motivos;
  return conferirBanco(banco, referencia);
}
