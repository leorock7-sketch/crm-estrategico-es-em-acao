/**
 * Administração de usuários e permissões: consultas e gravações. Tudo passa pelas regras do
 * banco, que só permitem estas gravações ao administrador do sistema; as contas do Supabase
 * Auth são tratadas em acoes-usuarios.ts, depois de conferida a permissão.
 */
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";
import { permissaoContexto, projetoTema, usuario } from "@/lib/banco/esquema";

export async function listarUsuarios(banco: Executor) {
  return banco
    .select({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      administrador: usuario.administrador,
      situacao: usuario.situacao,
      comConta: sql<boolean>`${usuario.authId} is not null`,
      permissoes: sql<number>`(
        select count(*)::int from permissao_contexto pc
        where pc.usuario_id = ${usuario.id} and pc.arquivado_em is null
          and (pc.valida_ate is null or pc.valida_ate >= hoje_em_brasilia())
      )`,
    })
    .from(usuario)
    .orderBy(asc(usuario.situacao), asc(usuario.nome));
}

export async function obterUsuario(banco: Executor, id: string) {
  const [encontrado] = await banco
    .select({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      administrador: usuario.administrador,
      situacao: usuario.situacao,
      authId: usuario.authId,
      criadoEm: usuario.criadoEm,
      atualizadoEm: usuario.atualizadoEm,
    })
    .from(usuario)
    .where(eq(usuario.id, id));
  return encontrado ?? null;
}

export async function criarUsuario(
  banco: Executor,
  dados: { nome: string; email: string; administrador: boolean; authId: string | null },
): Promise<string> {
  const [novo] = await banco
    .insert(usuario)
    .values({ nome: dados.nome, email: dados.email, administrador: dados.administrador, authId: dados.authId })
    .returning({ id: usuario.id });
  return novo.id;
}

export async function atualizarUsuario(banco: Executor, id: string, dados: { nome: string; administrador: boolean }) {
  await banco.update(usuario).set(dados).where(eq(usuario.id, id));
}

export async function definirSituacaoUsuario(banco: Executor, id: string, situacao: "ativo" | "inativo") {
  await banco.update(usuario).set({ situacao }).where(eq(usuario.id, id));
}

/** Permissões do usuário, inclusive as vencidas e as revogadas, para o histórico ficar visível. */
export async function permissoesDoUsuario(banco: Executor, usuarioId: string) {
  return banco
    .select({
      id: permissaoContexto.id,
      projetoTemaId: permissaoContexto.projetoTemaId,
      projetoNome: projetoTema.nome,
      projetoTipo: projetoTema.tipo,
      perfil: permissaoContexto.perfil,
      validaAte: permissaoContexto.validaAte,
      vencida: sql<boolean>`${permissaoContexto.validaAte} is not null and ${permissaoContexto.validaAte} < hoje_em_brasilia()`,
      revogadaEm: permissaoContexto.arquivadoEm,
      concedidaEm: permissaoContexto.criadoEm,
    })
    .from(permissaoContexto)
    .innerJoin(projetoTema, eq(projetoTema.id, permissaoContexto.projetoTemaId))
    .where(eq(permissaoContexto.usuarioId, usuarioId))
    .orderBy(sql`${permissaoContexto.arquivadoEm} is null desc`, asc(projetoTema.nome), desc(permissaoContexto.criadoEm));
}

export async function concederPermissao(
  banco: Executor,
  dados: { usuarioId: string; projetoTemaId: string; perfil: "gestor" | "colaborador" | "leitor"; validaAte: string | null },
) {
  await banco.insert(permissaoContexto).values(dados);
}

/** Revogar é arquivar: a permissão deixa de valer de imediato e continua no histórico. */
export async function revogarPermissao(banco: Executor, permissaoId: string) {
  await banco
    .update(permissaoContexto)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(permissaoContexto.id, permissaoId), isNull(permissaoContexto.arquivadoEm)));
}
