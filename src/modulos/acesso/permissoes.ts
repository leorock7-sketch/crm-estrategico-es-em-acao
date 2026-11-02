/**
 * Permissões por projeto ou tema (D-008, RN-03). Toda leitura ou gravação de
 * avaliações passa por estas funções no servidor.
 *
 * ATENÇÃO (D-034): a estrutura está preparada e testada, mas a segurança
 * multiusuário ainda NÃO foi homologada — não há autenticação real (Etapa 5)
 * nem regras de segurança no próprio banco de dados (RLS).
 */
import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";
import { permissaoContexto, usuario } from "@/lib/banco/esquema";

export type OrigemPermissao = "administrador" | "gestor" | "colaborador" | "leitor" | "sem_permissao" | "usuario_inativo";

export type PermissaoNoContexto = { ver: boolean; editar: boolean; origem: OrigemPermissao };

export class AcessoNegadoError extends Error {
  constructor(acao: "ver" | "editar") {
    super(
      acao === "ver"
        ? "Você não tem permissão para ver as avaliações deste projeto ou tema."
        : "Você não tem permissão para alterar as avaliações deste projeto ou tema.",
    );
    this.name = "AcessoNegadoError";
  }
}

/**
 * Administrador ativo: tudo. Demais usuários: conforme o perfil no contexto
 * (gestor e colaborador veem e alteram; leitor só vê), enquanto a permissão
 * estiver válida e não arquivada.
 */
export async function permissaoNoContexto(
  banco: Executor,
  usuarioId: string,
  projetoTemaId: string,
): Promise<PermissaoNoContexto> {
  const [encontrado] = await banco
    .select({ administrador: usuario.administrador, situacao: usuario.situacao })
    .from(usuario)
    .where(eq(usuario.id, usuarioId));
  if (!encontrado || encontrado.situacao !== "ativo") return { ver: false, editar: false, origem: "usuario_inativo" };
  if (encontrado.administrador) return { ver: true, editar: true, origem: "administrador" };

  const [permissao] = await banco
    .select({ perfil: permissaoContexto.perfil })
    .from(permissaoContexto)
    .where(
      and(
        eq(permissaoContexto.usuarioId, usuarioId),
        eq(permissaoContexto.projetoTemaId, projetoTemaId),
        isNull(permissaoContexto.arquivadoEm),
        or(isNull(permissaoContexto.validaAte), sql`${permissaoContexto.validaAte} >= current_date`),
      ),
    );
  if (!permissao) return { ver: false, editar: false, origem: "sem_permissao" };
  return { ver: true, editar: permissao.perfil !== "leitor", origem: permissao.perfil };
}

/** Lança AcessoNegadoError se o usuário não puder realizar a ação no contexto. */
export async function exigirPermissao(
  banco: Executor,
  usuarioId: string,
  projetoTemaId: string,
  acao: "ver" | "editar",
): Promise<PermissaoNoContexto> {
  const permissao = await permissaoNoContexto(banco, usuarioId, projetoTemaId);
  if (!permissao[acao]) throw new AcessoNegadoError(acao);
  return permissao;
}
