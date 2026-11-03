/**
 * Visibilidade de iniciativas, interações e compromissos (docs/MODELO_DADOS.md,
 * seção 7): o administrador vê tudo; os demais usuários, o que estiver ligado a
 * projetos ou temas em que tenham permissão válida (permissoes.ts). Alterar
 * exige perfil de gestor ou colaborador em pelo menos um desses contextos.
 *
 * ATENÇÃO (D-034): mesma ressalva das avaliações — sem autenticação real nem
 * regras de segurança no próprio banco, a segurança multiusuário NÃO está homologada.
 */
import { and, asc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";
import { permissaoContexto, usuario } from "@/lib/banco/esquema";
import { permissaoNoContexto } from "./permissoes";

/** "todos" para o administrador; senão, os projetos e temas com permissão válida. */
export type ProjetosVisiveis = "todos" | string[];

export class EdicaoNegadaError extends Error {
  constructor() {
    super("Você não tem permissão para alterar registros destes projetos ou temas.");
    this.name = "EdicaoNegadaError";
  }
}

export async function projetosVisiveis(banco: Executor, usuarioId: string): Promise<ProjetosVisiveis> {
  const [encontrado] = await banco
    .select({ administrador: usuario.administrador, situacao: usuario.situacao })
    .from(usuario)
    .where(eq(usuario.id, usuarioId));
  if (!encontrado || encontrado.situacao !== "ativo") return [];
  if (encontrado.administrador) return "todos";
  const permissoes = await banco
    .select({ projetoTemaId: permissaoContexto.projetoTemaId })
    .from(permissaoContexto)
    .where(
      and(
        eq(permissaoContexto.usuarioId, usuarioId),
        isNull(permissaoContexto.arquivadoEm),
        or(isNull(permissaoContexto.validaAte), sql`${permissaoContexto.validaAte} >= current_date`),
      ),
    );
  return permissoes.map((p) => p.projetoTemaId);
}

/**
 * Condição SQL "o projeto ou tema da coluna informada é visível". Sem restrição
 * para o administrador; sem permissão nenhuma, nada é visível.
 */
export function projetoVisivel(coluna: SQL, visiveis: ProjetosVisiveis): SQL {
  if (visiveis === "todos") return sql`true`;
  if (visiveis.length === 0) return sql`false`;
  return sql`${coluna} in (${sql.join(
    visiveis.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

/** Pode alterar se for administrador ou gestor/colaborador em algum dos projetos ou temas. */
export async function podeEditarEmAlgum(
  banco: Executor,
  usuarioId: string,
  projetoTemaIds: readonly string[],
): Promise<boolean> {
  if ((await projetosVisiveis(banco, usuarioId)) === "todos") return true;
  for (const projetoTemaId of new Set(projetoTemaIds)) {
    if ((await permissaoNoContexto(banco, usuarioId, projetoTemaId)).editar) return true;
  }
  return false;
}

/** Lança EdicaoNegadaError se o usuário não puder alterar nenhum dos contextos. */
export async function exigirEdicaoEmAlgum(banco: Executor, usuarioId: string, projetoTemaIds: readonly string[]) {
  if (!(await podeEditarEmAlgum(banco, usuarioId, projetoTemaIds))) throw new EdicaoNegadaError();
}

/** Usuários ativos (equipe interna), para responsáveis e participantes internos. */
export async function opcoesUsuarios(banco: Executor) {
  return banco
    .select({ id: usuario.id, nome: usuario.nome })
    .from(usuario)
    .where(eq(usuario.situacao, "ativo"))
    .orderBy(asc(usuario.nome));
}
