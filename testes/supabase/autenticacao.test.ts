/**
 * Autenticação real no Supabase Auth, sem navegador (D-074, requisitos 1, 2, 4, 6 e 9), com as
 * contas fictícias de .dados/contas-teste.json. O navegador é testado em navegador.test.ts.
 */
import { createClient } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBancoPostgres, type Banco, fecharBanco } from "@/lib/banco/conexao";
import { usuario } from "@/lib/banco/esquema";
import { comIdentidade } from "@/lib/banco/identidade";
import { clienteAdministrativoDeTeste, emailDeTeste, lerContasDeTeste } from "../../scripts/contas-teste";

const URL_PROJETO = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;

const clientePublico = () =>
  createClient(URL_PROJETO, CHAVE_PUBLICA, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

const { contas } = lerContasDeTeste();
let administrativo: Banco;
let aplicacao: Banco;

beforeAll(() => {
  administrativo = abrirBancoPostgres(process.env.CRM_BANCO_ADMIN_URL as string, { max: 2 });
  aplicacao = abrirBancoPostgres(process.env.CRM_BANCO_URL as string, { max: 3 });
});

afterAll(async () => {
  await fecharBanco(administrativo);
  await fecharBanco(aplicacao);
});

async function identificar(authId: string) {
  return (await comIdentidade(aplicacao, null).execute(sql`select * from identificar_usuario(${authId}::uuid)`)).rows as {
    id: string;
    situacao: string;
  }[];
}

describe("Requisito 1: autenticação real", () => {
  test("login com e-mail e senha de usuário autorizado abre a sessão, com identidade verificável", async () => {
    const cliente = clientePublico();
    const { data, error } = await cliente.auth.signInWithPassword({ email: contas.gestor.email, password: contas.gestor.senha });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
    const verificado = await cliente.auth.getClaims();
    expect(verificado.data?.claims?.sub).toBe(contas.gestor.authId);
  });

  test("senha errada e conta inexistente não abrem sessão, com a mesma resposta", async () => {
    const errada = await clientePublico().auth.signInWithPassword({ email: contas.gestor.email, password: "senha-errada-ficticia" });
    expect(errada.data.session).toBeNull();
    const inexistente = await clientePublico().auth.signInWithPassword({ email: emailDeTeste("ninguem"), password: "senha-errada-ficticia" });
    expect(inexistente.data.session).toBeNull();
    expect(errada.error?.code).toBe(inexistente.error?.code);
  });

  test("autocadastro público desligado: sem cadastro prévio, não há conta", async () => {
    const { data, error } = await clientePublico().auth.signUp({ email: emailDeTeste(`novo${Date.now()}`), password: "SenhaFicticiaLonga123" });
    expect(data.user).toBeNull();
    expect(error).not.toBeNull();
  });

  test("token adulterado é recusado pela verificação da assinatura", async () => {
    const cliente = clientePublico();
    const { data } = await cliente.auth.signInWithPassword({ email: contas.leitor.email, password: contas.leitor.senha });
    const [cabecalho, carga] = (data.session?.access_token as string).split(".");
    const adulterada = JSON.parse(Buffer.from(carga, "base64url").toString());
    adulterada.sub = contas.administrador.authId;
    const forjado = `${cabecalho}.${Buffer.from(JSON.stringify(adulterada)).toString("base64url")}.assinaturaforjada`;
    const resultado = await clientePublico().auth.getClaims(forjado);
    expect(resultado.data).toBeNull();
    expect(resultado.error).not.toBeNull();
  });

  test("encerrar a sessão invalida a renovação", async () => {
    const cliente = clientePublico();
    const { data } = await cliente.auth.signInWithPassword({ email: contas.leitor.email, password: contas.leitor.senha });
    const renovacao = data.session?.refresh_token as string;
    await cliente.auth.signOut();
    const depois = await clientePublico().auth.refreshSession({ refresh_token: renovacao });
    expect(depois.data.session).toBeNull();
  });
});

describe("Requisito 2: correspondência entre identidade e usuário interno", () => {
  test("cada conta autenticada corresponde ao seu usuário interno por auth_id", async () => {
    for (const chave of ["administrador", "gestor", "colaborador", "leitor"] as const) {
      const [linha] = await identificar(contas[chave].authId);
      expect(linha.id).toBe(contas[chave].usuarioId);
    }
  });

  test("conta válida sem cadastro interno entra no Auth, mas não é identificada e não vê nada", async () => {
    const { error } = await clientePublico().auth.signInWithPassword({ email: contas.semCadastro.email, password: contas.semCadastro.senha });
    expect(error).toBeNull();
    expect(await identificar(contas.semCadastro.authId)).toEqual([]);
  });

  test("usuário interno com o mesmo e-mail de uma conta, sem auth_id, não herda acesso", async () => {
    const [outro] = await administrativo
      .insert(usuario)
      .values({ nome: "Teste Sem Vínculo", email: `sem.vinculo.${Date.now()}@teste.crm-es-em-acao.example.com` })
      .returning({ id: usuario.id });
    expect(outro.id).toBeTruthy();
    expect(await identificar(contas.semCadastro.authId)).toEqual([]);
    await administrativo.update(usuario).set({ situacao: "inativo" }).where(eq(usuario.id, outro.id));
  });

  test("usuário inativo é identificado como inativo, para ser recusado", async () => {
    const [linha] = await identificar(contas.inativo.authId);
    expect(linha.situacao).toBe("inativo");
  });
});

describe("Requisito 4: revogação com token ainda válido", () => {
  test("o token continua válido, mas desativar bloqueia de imediato, e reativar volta a valer", async () => {
    const cliente = clientePublico();
    const { data } = await cliente.auth.signInWithPassword({ email: contas.colaborador.email, password: contas.colaborador.senha });
    const usuarioId = contas.colaborador.usuarioId as string;
    const contar = async () => ((await comIdentidade(aplicacao, usuarioId).execute(sql`select count(*)::int as n from pessoa`)).rows as { n: number }[])[0].n;
    expect(await contar()).toBeGreaterThan(0);

    await administrativo.update(usuario).set({ situacao: "inativo" }).where(eq(usuario.id, usuarioId));
    try {
      const token = await clientePublico().auth.getClaims(data.session?.access_token as string);
      expect(token.data?.claims?.sub).toBe(contas.colaborador.authId);
      expect(await contar()).toBe(0);
    } finally {
      await administrativo.update(usuario).set({ situacao: "ativo" }).where(eq(usuario.id, usuarioId));
    }
    expect(await contar()).toBeGreaterThan(0);
  });

  test("conta suspensa não entra de novo", async () => {
    const auth = clienteAdministrativoDeTeste().auth.admin;
    await auth.updateUserById(contas.inativo.authId, { ban_duration: "876000h" });
    try {
      const { data, error } = await clientePublico().auth.signInWithPassword({ email: contas.inativo.email, password: contas.inativo.senha });
      expect(data.session).toBeNull();
      expect(error).not.toBeNull();
    } finally {
      await auth.updateUserById(contas.inativo.authId, { ban_duration: "none" });
    }
  });
});

describe("Requisito 6: a chave pública não acessa dados pela API do Supabase", () => {
  const consultarApi = async (tabela: string, token?: string) => {
    const resposta = await fetch(`${URL_PROJETO}/rest/v1/${tabela}?select=*&limit=1`, {
      headers: { apikey: CHAVE_PUBLICA, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    return { status: resposta.status, corpo: resposta.ok ? ((await resposta.json()) as unknown[]) : [] };
  };

  test("sem sessão, nenhuma tabela é acessível", async () => {
    for (const tabela of ["pessoa", "contato", "usuario", "permissao_contexto", "registro_auditoria", "projeto_tema"]) {
      const { corpo } = await consultarApi(tabela);
      expect(corpo, tabela).toEqual([]);
    }
  });

  test("com sessão de administrador do CRM, a API continua sem acesso", async () => {
    const { data } = await clientePublico().auth.signInWithPassword({ email: contas.administrador.email, password: contas.administrador.senha });
    for (const tabela of ["pessoa", "usuario", "projeto_tema"]) {
      const { corpo } = await consultarApi(tabela, data.session?.access_token);
      expect(corpo, tabela).toEqual([]);
    }
  });

  test("os papéis da API não têm permissão em nenhuma tabela nem função do CRM", async () => {
    const tabelas = (
      await administrativo.execute(sql`
        select grantee, table_name from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')`)
    ).rows;
    expect(tabelas).toEqual([]);
    const funcoes = (
      await administrativo.execute(sql`
        select grantee, routine_name from information_schema.role_routine_grants
        where routine_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')`)
    ).rows;
    expect(funcoes).toEqual([]);
  });

  test("a autenticação continua operacional, independentemente da API de dados", async () => {
    const resposta = await fetch(`${URL_PROJETO}/auth/v1/settings`, { headers: { apikey: CHAVE_PUBLICA } });
    expect(resposta.status).toBe(200);
    const { error } = await clientePublico().auth.signInWithPassword({ email: contas.leitor.email, password: contas.leitor.senha });
    expect(error).toBeNull();
  });
});
