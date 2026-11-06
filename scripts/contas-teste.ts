/**
 * Contas fictícias de teste, uma para cada situação do plano de testes (D-074, requisito 9).
 * As senhas são geradas aqui, nunca constam do código e ficam somente em .dados/contas-teste.json,
 * pasta que o Git ignora. A chave secreta só é usada aqui e na administração de contas.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { and, eq, like } from "drizzle-orm";
import type { Banco } from "@/lib/banco/conexao";
import { permissaoContexto, projetoTema, usuario } from "@/lib/banco/esquema";

export type ChaveConta =
  | "administrador"
  | "gestor"
  | "colaborador"
  | "leitor"
  | "gestorOutroProjeto"
  | "permissaoVencida"
  | "permissaoRevogada"
  | "inativo"
  | "semPermissao"
  | "semCadastro";

export type ContaDeTeste = { chave: ChaveConta; nome: string; email: string; senha: string; authId: string; usuarioId: string | null };
export type ContasDeTeste = { projetoA: string; projetoB: string; contas: Record<ChaveConta, ContaDeTeste> };

export const ARQUIVO_CONTAS = path.join(process.cwd(), ".dados", "contas-teste.json");

const DEFINICOES: { chave: ChaveConta; nome: string; administrador?: boolean; inativo?: boolean; semCadastro?: boolean }[] = [
  { chave: "administrador", nome: "Teste Administradora", administrador: true },
  { chave: "gestor", nome: "Teste Gestora" },
  { chave: "colaborador", nome: "Teste Colaborador" },
  { chave: "leitor", nome: "Teste Leitora" },
  { chave: "gestorOutroProjeto", nome: "Teste Gestor de Outro Projeto" },
  { chave: "permissaoVencida", nome: "Teste Permissão Vencida" },
  { chave: "permissaoRevogada", nome: "Teste Permissão Revogada" },
  { chave: "inativo", nome: "Teste Inativo", inativo: true },
  { chave: "semPermissao", nome: "Teste Sem Permissão" },
  { chave: "semCadastro", nome: "Teste Sem Cadastro", semCadastro: true },
];

export function clienteAdministrativoDeTeste() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SECRET_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function lerContasDeTeste(): ContasDeTeste {
  return JSON.parse(readFileSync(ARQUIVO_CONTAS, "utf8")) as ContasDeTeste;
}

const DOMINIO_DE_TESTE = "@teste.crm-es-em-acao.example.com";

export function emailDeTeste(chave: string): string {
  return `${chave.replace(/[A-Z]/g, (l) => `.${l.toLowerCase()}`)}${DOMINIO_DE_TESTE}`;
}

async function projetoPorNome(banco: Banco, trecho: string): Promise<string> {
  const [linha] = await banco
    .select({ id: projetoTema.id })
    .from(projetoTema)
    .where(and(like(projetoTema.nomeNormalizado, `%${trecho}%`), eq(projetoTema.tipo, "projeto")))
    .limit(1);
  if (!linha) throw new Error(`Projeto de demonstração não encontrado: ${trecho}.`);
  return linha.id;
}

/** Apaga só as contas do domínio fictício de teste, para refazer o projeto de desenvolvimento. */
export async function apagarContasDeTeste() {
  const auth = clienteAdministrativoDeTeste().auth.admin;
  const { data, error } = await auth.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Não foi possível listar as contas: ${error.code ?? "sem detalhe"}.`);
  const deTeste = data.users.filter((u) => u.email?.endsWith(DOMINIO_DE_TESTE));
  for (const conta of deTeste) await auth.deleteUser(conta.id);
  rmSync(ARQUIVO_CONTAS, { force: true });
  console.log(`[OK] Contas de teste anteriores apagadas: ${deTeste.length}.`);
}

export async function criarContasDeTeste(banco: Banco) {
  if (existsSync(ARQUIVO_CONTAS)) {
    console.log("[OK] Contas de teste: já criadas (.dados/contas-teste.json).");
    return;
  }
  const projetoA = await projetoPorNome(banco, "corredor");
  const projetoB = await projetoPorNome(banco, "porto");
  const auth = clienteAdministrativoDeTeste().auth.admin;
  const contas = {} as Record<ChaveConta, ContaDeTeste>;

  for (const definicao of DEFINICOES) {
    const email = emailDeTeste(definicao.chave);
    const senha = randomBytes(18).toString("base64url");
    const { data, error } = await auth.createUser({ email, password: senha, email_confirm: true });
    if (error || !data.user) throw new Error(`Não foi possível criar a conta de teste "${definicao.chave}": ${error?.code ?? "sem detalhe"}.`);
    let usuarioId: string | null = null;
    if (!definicao.semCadastro) {
      const [novo] = await banco
        .insert(usuario)
        .values({
          nome: definicao.nome,
          email,
          authId: data.user.id,
          administrador: definicao.administrador ?? false,
          situacao: definicao.inativo ? "inativo" : "ativo",
        })
        .returning({ id: usuario.id });
      usuarioId = novo.id;
    }
    contas[definicao.chave] = { chave: definicao.chave, nome: definicao.nome, email, senha, authId: data.user.id, usuarioId };
  }

  const conceder = (chave: ChaveConta, projetoTemaId: string, perfil: "gestor" | "colaborador" | "leitor", extra: object = {}) =>
    banco.insert(permissaoContexto).values({ usuarioId: contas[chave].usuarioId as string, projetoTemaId, perfil, ...extra });
  await conceder("gestor", projetoA, "gestor");
  await conceder("colaborador", projetoA, "colaborador");
  await conceder("leitor", projetoA, "leitor");
  await conceder("gestorOutroProjeto", projetoB, "gestor");
  await conceder("permissaoVencida", projetoA, "gestor", { validaAte: "2020-01-01" });
  await conceder("permissaoRevogada", projetoA, "colaborador", { arquivadoEm: new Date() });
  await conceder("inativo", projetoA, "gestor");

  mkdirSync(path.dirname(ARQUIVO_CONTAS), { recursive: true });
  writeFileSync(ARQUIVO_CONTAS, JSON.stringify({ projetoA, projetoB, contas } satisfies ContasDeTeste, null, 2));
  console.log(`[OK] Contas de teste: ${DEFINICOES.length} criadas; senhas somente em .dados/contas-teste.json.`);
}
