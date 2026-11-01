/**
 * Leitura e gravação do Cadastro Mestre: pessoas, instituições e vínculos.
 * As gravações devem ser feitas dentro de comoUsuario() (ver lib/banco/conexao),
 * para que a trilha de auditoria registre o responsável.
 */
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/lib/banco/conexao";
import {
  instituicao,
  pessoa,
  registroAuditoria,
  stakeholder,
  usuario,
  vinculoPessoaInstituicao as vinculo,
} from "@/lib/banco/esquema";
import { escaparLike, normalizarTexto } from "@/lib/texto";
import type { DadosInstituicao, DadosPessoa, DadosVinculo } from "./esquemas";

export type PossivelDuplicidade = {
  id: string;
  nome: string;
  motivo: string;
  arquivado: boolean;
};

/** Vínculo vigente: sem data de término e não arquivado. */
const vinculoVigente = and(isNull(vinculo.dataFim), isNull(vinculo.arquivadoEm));

// --- Pessoas -----------------------------------------------------------------

function camposPessoa(dados: DadosPessoa) {
  return {
    nomeCompleto: dados.nomeCompleto,
    nomeTratamento: dados.nomeTratamento ?? null,
    nomeNormalizado: normalizarTexto(dados.nomeCompleto),
    email: dados.email ?? null,
    telefone: dados.telefone ?? null,
    observacoes: dados.observacoes ?? null,
  };
}

export async function listarPessoas(
  banco: Executor,
  filtro: { busca?: string; incluirArquivadas?: boolean } = {},
) {
  const condicoes: (SQL | undefined)[] = [];
  if (!filtro.incluirArquivadas) condicoes.push(isNull(pessoa.arquivadoEm));
  const termo = normalizarTexto(filtro.busca ?? "");
  if (termo) {
    const padrao = `%${escaparLike(termo)}%`;
    condicoes.push(
      or(
        ilike(pessoa.nomeNormalizado, padrao),
        ilike(pessoa.email, `%${escaparLike(filtro.busca!.trim())}%`),
        ilike(instituicao.nomeNormalizado, padrao),
      ),
    );
  }

  return banco
    .select({
      id: pessoa.id,
      nomeCompleto: pessoa.nomeCompleto,
      nomeTratamento: pessoa.nomeTratamento,
      email: pessoa.email,
      telefone: pessoa.telefone,
      arquivadoEm: pessoa.arquivadoEm,
      cargo: vinculo.cargo,
      instituicaoId: instituicao.id,
      instituicaoNome: instituicao.nome,
      instituicaoSigla: instituicao.sigla,
    })
    .from(pessoa)
    .leftJoin(
      vinculo,
      and(eq(vinculo.pessoaId, pessoa.id), eq(vinculo.principal, true), vinculoVigente),
    )
    .leftJoin(instituicao, eq(instituicao.id, vinculo.instituicaoId))
    .where(and(...condicoes))
    .orderBy(asc(pessoa.nomeNormalizado))
    .limit(500);
}

export async function obterPessoa(banco: Executor, id: string) {
  const [encontrada] = await banco.select().from(pessoa).where(eq(pessoa.id, id));
  return encontrada ?? null;
}

export async function criarPessoa(banco: Executor, dados: DadosPessoa): Promise<string> {
  const [novo] = await banco
    .insert(stakeholder)
    .values({ tipo: "pessoa" })
    .returning({ id: stakeholder.id });
  await banco.insert(pessoa).values({ id: novo.id, ...camposPessoa(dados) });
  return novo.id;
}

export async function atualizarPessoa(banco: Executor, id: string, dados: DadosPessoa) {
  await banco.update(pessoa).set(camposPessoa(dados)).where(eq(pessoa.id, id));
}

export async function definirArquivamentoPessoa(banco: Executor, id: string, arquivar: boolean) {
  await banco
    .update(pessoa)
    .set({ arquivadoEm: arquivar ? sql`now()` : null })
    .where(eq(pessoa.id, id));
}

/**
 * Pessoas que podem ser a mesma: mesmo e-mail, mesmo nome ou mesmo primeiro e
 * último nome (por exemplo, "Maria Silva" e "Maria da Silva").
 */
export async function possiveisDuplicidadesPessoa(
  banco: Executor,
  dados: Pick<DadosPessoa, "nomeCompleto" | "email">,
  ignorarId?: string,
): Promise<PossivelDuplicidade[]> {
  const nome = normalizarTexto(dados.nomeCompleto);
  const partes = nome.split(" ");
  const criterios: SQL[] = [eq(pessoa.nomeNormalizado, nome)];
  if (partes.length > 1) {
    criterios.push(
      sql`split_part(${pessoa.nomeNormalizado}, ' ', 1) = ${partes[0]}
        and regexp_replace(${pessoa.nomeNormalizado}, '^.* ', '') = ${partes.at(-1)}`,
    );
  }
  if (dados.email) criterios.push(sql`lower(${pessoa.email}) = lower(${dados.email})`);

  const encontradas = await banco
    .select({
      id: pessoa.id,
      nome: pessoa.nomeCompleto,
      nomeNormalizado: pessoa.nomeNormalizado,
      email: pessoa.email,
      arquivadoEm: pessoa.arquivadoEm,
    })
    .from(pessoa)
    .where(and(or(...criterios), ignorarId ? ne(pessoa.id, ignorarId) : undefined))
    .limit(10);

  return encontradas.map((p) => ({
    id: p.id,
    nome: p.nome,
    motivo:
      dados.email && p.email?.toLowerCase() === dados.email.toLowerCase()
        ? "Mesmo e-mail"
        : p.nomeNormalizado === nome
          ? "Mesmo nome"
          : "Nome semelhante",
    arquivado: p.arquivadoEm !== null,
  }));
}

// --- Instituições ------------------------------------------------------------

function camposInstituicao(dados: DadosInstituicao) {
  return {
    nome: dados.nome,
    sigla: dados.sigla ?? null,
    nomeNormalizado: normalizarTexto(dados.nome),
    natureza: dados.natureza,
    esfera: dados.esfera ?? null,
    cnpj: dados.cnpj ?? null,
    uf: dados.uf ?? null,
    municipio: dados.municipio ?? null,
    site: dados.site ?? null,
    instituicaoSuperiorId: dados.instituicaoSuperiorId ?? null,
  };
}

const superior = alias(instituicao, "superior");

export async function listarInstituicoes(
  banco: Executor,
  filtro: { busca?: string; incluirArquivadas?: boolean } = {},
) {
  const condicoes: (SQL | undefined)[] = [];
  if (!filtro.incluirArquivadas) condicoes.push(isNull(instituicao.arquivadoEm));
  const termo = normalizarTexto(filtro.busca ?? "");
  if (termo) {
    condicoes.push(
      or(
        ilike(instituicao.nomeNormalizado, `%${escaparLike(termo)}%`),
        ilike(instituicao.sigla, `%${escaparLike(filtro.busca!.trim())}%`),
      ),
    );
  }

  return banco
    .select({
      id: instituicao.id,
      nome: instituicao.nome,
      sigla: instituicao.sigla,
      natureza: instituicao.natureza,
      uf: instituicao.uf,
      municipio: instituicao.municipio,
      arquivadoEm: instituicao.arquivadoEm,
      superiorNome: superior.nome,
      pessoasVinculadas: sql<number>`(
        select count(*)::int from ${vinculo}
        where ${vinculo.instituicaoId} = ${instituicao.id}
          and ${vinculo.dataFim} is null and ${vinculo.arquivadoEm} is null
      )`,
    })
    .from(instituicao)
    .leftJoin(superior, eq(superior.id, instituicao.instituicaoSuperiorId))
    .where(and(...condicoes))
    .orderBy(asc(instituicao.nomeNormalizado))
    .limit(500);
}

export async function obterInstituicao(banco: Executor, id: string) {
  const [encontrada] = await banco
    .select({ instituicao, superiorNome: superior.nome })
    .from(instituicao)
    .leftJoin(superior, eq(superior.id, instituicao.instituicaoSuperiorId))
    .where(eq(instituicao.id, id));
  return encontrada ? { ...encontrada.instituicao, superiorNome: encontrada.superiorNome } : null;
}

export async function listarSubordinadas(banco: Executor, id: string) {
  return banco
    .select({ id: instituicao.id, nome: instituicao.nome, sigla: instituicao.sigla })
    .from(instituicao)
    .where(and(eq(instituicao.instituicaoSuperiorId, id), isNull(instituicao.arquivadoEm)))
    .orderBy(asc(instituicao.nomeNormalizado));
}

/** Instituições ativas, para as listas de seleção dos formulários. */
export async function opcoesInstituicoes(banco: Executor) {
  return banco
    .select({ id: instituicao.id, nome: instituicao.nome, sigla: instituicao.sigla })
    .from(instituicao)
    .where(isNull(instituicao.arquivadoEm))
    .orderBy(asc(instituicao.nomeNormalizado));
}

export async function criarInstituicao(
  banco: Executor,
  dados: DadosInstituicao,
): Promise<string> {
  const [novo] = await banco
    .insert(stakeholder)
    .values({ tipo: "instituicao" })
    .returning({ id: stakeholder.id });
  await banco.insert(instituicao).values({ id: novo.id, ...camposInstituicao(dados) });
  return novo.id;
}

export async function atualizarInstituicao(banco: Executor, id: string, dados: DadosInstituicao) {
  await banco.update(instituicao).set(camposInstituicao(dados)).where(eq(instituicao.id, id));
}

export async function definirArquivamentoInstituicao(
  banco: Executor,
  id: string,
  arquivar: boolean,
) {
  await banco
    .update(instituicao)
    .set({ arquivadoEm: arquivar ? sql`now()` : null })
    .where(eq(instituicao.id, id));
}

/** Instituições que podem ser a mesma: mesmo nome, mesma sigla ou mesmo CNPJ. */
export async function possiveisDuplicidadesInstituicao(
  banco: Executor,
  dados: Pick<DadosInstituicao, "nome" | "sigla" | "cnpj">,
  ignorarId?: string,
): Promise<PossivelDuplicidade[]> {
  const nome = normalizarTexto(dados.nome);
  const criterios: SQL[] = [eq(instituicao.nomeNormalizado, nome)];
  if (dados.sigla) criterios.push(sql`lower(${instituicao.sigla}) = lower(${dados.sigla})`);
  if (dados.cnpj) criterios.push(eq(instituicao.cnpj, dados.cnpj));

  const encontradas = await banco
    .select({
      id: instituicao.id,
      nome: instituicao.nome,
      nomeNormalizado: instituicao.nomeNormalizado,
      sigla: instituicao.sigla,
      cnpj: instituicao.cnpj,
      arquivadoEm: instituicao.arquivadoEm,
    })
    .from(instituicao)
    .where(and(or(...criterios), ignorarId ? ne(instituicao.id, ignorarId) : undefined))
    .limit(10);

  return encontradas.map((i) => ({
    id: i.id,
    nome: i.sigla ? `${i.nome} (${i.sigla})` : i.nome,
    motivo:
      dados.cnpj && i.cnpj === dados.cnpj
        ? "Mesmo CNPJ"
        : i.nomeNormalizado === nome
          ? "Mesmo nome"
          : "Mesma sigla",
    arquivado: i.arquivadoEm !== null,
  }));
}

// --- Vínculos ----------------------------------------------------------------

export async function listarVinculosDaPessoa(banco: Executor, pessoaId: string) {
  return banco
    .select({
      id: vinculo.id,
      instituicaoId: instituicao.id,
      instituicaoNome: instituicao.nome,
      instituicaoSigla: instituicao.sigla,
      cargo: vinculo.cargo,
      area: vinculo.area,
      dataInicio: vinculo.dataInicio,
      dataFim: vinculo.dataFim,
      principal: vinculo.principal,
    })
    .from(vinculo)
    .innerJoin(instituicao, eq(instituicao.id, vinculo.instituicaoId))
    .where(and(eq(vinculo.pessoaId, pessoaId), isNull(vinculo.arquivadoEm)))
    .orderBy(sql`${vinculo.dataFim} is null desc`, desc(vinculo.dataInicio), desc(vinculo.criadoEm));
}

export async function listarVinculosDaInstituicao(banco: Executor, instituicaoId: string) {
  return banco
    .select({
      id: vinculo.id,
      pessoaId: pessoa.id,
      pessoaNome: pessoa.nomeCompleto,
      cargo: vinculo.cargo,
      area: vinculo.area,
      dataInicio: vinculo.dataInicio,
      dataFim: vinculo.dataFim,
      principal: vinculo.principal,
    })
    .from(vinculo)
    .innerJoin(pessoa, eq(pessoa.id, vinculo.pessoaId))
    .where(and(eq(vinculo.instituicaoId, instituicaoId), isNull(vinculo.arquivadoEm)))
    .orderBy(sql`${vinculo.dataFim} is null desc`, asc(pessoa.nomeNormalizado));
}

export async function criarVinculo(banco: Executor, dados: DadosVinculo): Promise<string> {
  const [novo] = await banco
    .insert(vinculo)
    .values({
      pessoaId: dados.pessoaId,
      instituicaoId: dados.instituicaoId,
      cargo: dados.cargo ?? null,
      area: dados.area ?? null,
      dataInicio: dados.dataInicio ?? null,
      dataFim: dados.dataFim ?? null,
      principal: dados.principal,
    })
    .returning({ id: vinculo.id });
  return novo.id;
}

/** Encerra um vínculo vigente. Retorna falso se ele não existir ou já estiver encerrado. */
export async function encerrarVinculo(
  banco: Executor,
  vinculoId: string,
  dataFim: string,
): Promise<boolean> {
  const alterados = await banco
    .update(vinculo)
    .set({ dataFim })
    .where(and(eq(vinculo.id, vinculoId), isNull(vinculo.dataFim)))
    .returning({ id: vinculo.id });
  return alterados.length > 0;
}

// --- Histórico ---------------------------------------------------------------

/** Registros da trilha de auditoria de uma pessoa ou instituição, incluindo seus vínculos. */
export async function historicoDoStakeholder(banco: Executor, id: string) {
  const dados = sql`coalesce(${registroAuditoria.dadosNovos}, ${registroAuditoria.dadosAnteriores})`;
  return banco
    .select({
      id: registroAuditoria.id,
      tabela: registroAuditoria.tabela,
      operacao: registroAuditoria.operacao,
      dadosAnteriores: registroAuditoria.dadosAnteriores,
      dadosNovos: registroAuditoria.dadosNovos,
      ocorridoEm: registroAuditoria.ocorridoEm,
      usuarioNome: usuario.nome,
    })
    .from(registroAuditoria)
    .leftJoin(usuario, eq(usuario.id, registroAuditoria.usuarioId))
    .where(
      or(
        eq(registroAuditoria.registroId, id),
        and(
          eq(registroAuditoria.tabela, "vinculo_pessoa_instituicao"),
          or(sql`${dados} ->> 'pessoa_id' = ${id}`, sql`${dados} ->> 'instituicao_id' = ${id}`),
        ),
      ),
    )
    .orderBy(desc(registroAuditoria.ocorridoEm), desc(registroAuditoria.id))
    .limit(200);
}

export type RegistroHistorico = Awaited<ReturnType<typeof historicoDoStakeholder>>[number];

/** Nomes de pessoas e instituições a partir dos identificadores (usado no histórico). */
export async function nomesDosStakeholders(
  banco: Executor,
  ids: string[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const [pessoas, instituicoes] = await Promise.all([
    banco
      .select({ id: pessoa.id, nome: pessoa.nomeCompleto })
      .from(pessoa)
      .where(inArray(pessoa.id, unicos)),
    banco
      .select({ id: instituicao.id, nome: instituicao.nome })
      .from(instituicao)
      .where(inArray(instituicao.id, unicos)),
  ]);
  return new Map([...pessoas, ...instituicoes].map((registro) => [registro.id, registro.nome]));
}

/** Identificadores de pessoas e instituições citados nos registros do histórico. */
export function idsCitadosNoHistorico(registros: RegistroHistorico[]): string[] {
  const ids: string[] = [];
  for (const registro of registros) {
    for (const dados of [registro.dadosAnteriores, registro.dadosNovos]) {
      if (!dados || typeof dados !== "object") continue;
      for (const [campo, valor] of Object.entries(dados)) {
        if (campo.endsWith("_id") && typeof valor === "string") ids.push(valor);
      }
    }
  }
  return ids;
}
