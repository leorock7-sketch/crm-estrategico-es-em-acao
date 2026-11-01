/**
 * Leitura e gravação das avaliações estratégicas (Etapa 2A). As gravações devem
 * ser feitas dentro de comoUsuario(), para a trilha de auditoria, e somente
 * depois de conferida a permissão no contexto (modulos/acesso/permissoes.ts).
 * As regras de publicação e de imutabilidade são garantidas pelo banco.
 */
import { and, asc, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";
import {
  avaliacao,
  avaliacaoNotaCriterio as nota,
  avaliacaoVersao as versao,
  criterioAvaliacao as criterio,
  evidencia,
  instituicao,
  metodologiaVersao as metodologia,
  pessoa,
  stakeholder,
  stakeholderContexto as associacao,
  usuario,
} from "@/lib/banco/esquema";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { calcularResultado } from "./calculo";
import type { DadosEvidencia, DadosRascunho } from "./esquemas";
import type { FichaParaMatriz } from "./matriz";

const nomeDoStakeholder = sql<string>`coalesce(${pessoa.nomeCompleto}, ${instituicao.nome})`;

// --- Metodologias ------------------------------------------------------------

export async function listarMetodologias(banco: Executor) {
  return banco
    .select({
      id: metodologia.id,
      nome: metodologia.nome,
      situacao: metodologia.situacao,
      homologada: metodologia.homologada,
      vigenteDesde: metodologia.vigenteDesde,
      vigenteAte: metodologia.vigenteAte,
      // Consulta de uma só tabela: o Drizzle não qualifica as colunas, por isso
      // a subconsulta usa nomes escritos por extenso (ver listarComites).
      criterios: sql<number>`(
        select count(*)::int from criterio_avaliacao c
        where c.metodologia_versao_id = metodologia_versao.id and c.arquivado_em is null
      )`,
    })
    .from(metodologia)
    .orderBy(sql`${metodologia.situacao} = 'vigente' desc`, desc(metodologia.criadoEm));
}

export async function criteriosDaMetodologia(banco: Executor, metodologiaId: string) {
  return banco
    .select({
      id: criterio.id,
      dimensao: criterio.dimensao,
      nome: criterio.nome,
      descricao: criterio.descricao,
      escalaMinima: criterio.escalaMinima,
      escalaMaxima: criterio.escalaMaxima,
      peso: criterio.peso,
      ordem: criterio.ordem,
    })
    .from(criterio)
    .where(and(eq(criterio.metodologiaVersaoId, metodologiaId), isNull(criterio.arquivadoEm)))
    .orderBy(asc(criterio.dimensao), asc(criterio.ordem), asc(criterio.nome));
}

export type CriterioDaMetodologia = Awaited<ReturnType<typeof criteriosDaMetodologia>>[number];

export async function obterMetodologia(banco: Executor, id: string) {
  const [encontrada] = await banco.select().from(metodologia).where(eq(metodologia.id, id));
  if (!encontrada) return null;
  return { ...encontrada, criterios: await criteriosDaMetodologia(banco, id) };
}

export async function metodologiaVigente(banco: Executor) {
  const [vigente] = await banco
    .select({ id: metodologia.id, nome: metodologia.nome, homologada: metodologia.homologada })
    .from(metodologia)
    .where(eq(metodologia.situacao, "vigente"));
  return vigente ?? null;
}

export type NovaMetodologia = {
  nome: string;
  descricao?: string;
  criterios: {
    dimensao: "poder" | "interesse";
    nome: string;
    descricao?: string;
    escalaMinima: number;
    escalaMaxima: number;
    peso?: number;
  }[];
};

/**
 * Cria uma metodologia em rascunho com seus critérios. Não há tela para isso
 * nesta etapa: só a carga de demonstração e os testes a usam (D-034).
 */
export async function criarMetodologia(tx: Executor, dados: NovaMetodologia): Promise<string> {
  const [nova] = await tx
    .insert(metodologia)
    .values({ nome: dados.nome, descricao: dados.descricao ?? null })
    .returning({ id: metodologia.id });
  if (dados.criterios.length > 0) {
    await tx.insert(criterio).values(
      dados.criterios.map((c, ordem) => ({
        metodologiaVersaoId: nova.id,
        dimensao: c.dimensao,
        nome: c.nome,
        descricao: c.descricao ?? null,
        escalaMinima: c.escalaMinima,
        escalaMaxima: c.escalaMaxima,
        peso: c.peso ?? null,
        ordem,
      })),
    );
  }
  return nova.id;
}

/** Rascunho → vigente → encerrada (as transições permitidas são conferidas pelo banco). */
export async function alterarSituacaoMetodologia(tx: Executor, id: string, situacao: "vigente" | "encerrada") {
  await tx.update(metodologia).set({ situacao }).where(eq(metodologia.id, id));
}

// --- Fichas de um contexto ---------------------------------------------------

/**
 * Stakeholders do contexto para a matriz e a lista de avaliações: os associados
 * hoje e os que já têm ficha (mesmo com a associação encerrada, para não
 * ocultar avaliações históricas).
 */
export async function fichasDoContexto(banco: Executor, projetoTemaId: string): Promise<FichaParaMatriz[]> {
  const [associados, fichas] = await Promise.all([
    banco
      .selectDistinct({ stakeholderId: associacao.stakeholderId })
      .from(associacao)
      .where(
        and(
          eq(associacao.projetoTemaId, projetoTemaId),
          isNull(associacao.dataFim),
          isNull(associacao.arquivadoEm),
        ),
      ),
    banco
      .select({ id: avaliacao.id, stakeholderId: avaliacao.stakeholderId })
      .from(avaliacao)
      .where(eq(avaliacao.projetoTemaId, projetoTemaId)),
  ]);
  const idsAssociados = new Set(associados.map((a) => a.stakeholderId));
  const ids = [...new Set([...idsAssociados, ...fichas.map((f) => f.stakeholderId)])];
  if (ids.length === 0) return [];

  const idsFichas = fichas.map((f) => f.id);
  const [identificacoes, vigentes, rascunhos] = await Promise.all([
    banco
      .select({ id: stakeholder.id, tipo: stakeholder.tipo, nome: nomeDoStakeholder })
      .from(stakeholder)
      .leftJoin(pessoa, eq(pessoa.id, stakeholder.id))
      .leftJoin(instituicao, eq(instituicao.id, stakeholder.id))
      .where(inArray(stakeholder.id, ids)),
    idsFichas.length === 0
      ? []
      : banco
          .select({
            stakeholderId: avaliacao.stakeholderId,
            numeroVersao: versao.numeroVersao,
            metodologiaId: versao.metodologiaVersaoId,
            metodologiaNome: metodologia.nome,
            poder: versao.poder,
            interesse: versao.interesse,
            posicionamento: versao.posicionamento,
            grauConfianca: versao.grauConfianca,
            dataReferencia: versao.dataReferencia,
            proximaRevisao: versao.proximaRevisao,
          })
          .from(versao)
          .innerJoin(avaliacao, eq(avaliacao.id, versao.avaliacaoId))
          .leftJoin(metodologia, eq(metodologia.id, versao.metodologiaVersaoId))
          .where(and(inArray(versao.avaliacaoId, idsFichas), eq(versao.situacao, "vigente"))),
    idsFichas.length === 0
      ? []
      : banco
          .select({ stakeholderId: avaliacao.stakeholderId })
          .from(versao)
          .innerJoin(avaliacao, eq(avaliacao.id, versao.avaliacaoId))
          .where(
            and(inArray(versao.avaliacaoId, idsFichas), eq(versao.situacao, "rascunho"), isNull(versao.arquivadoEm)),
          ),
  ]);

  const vigentePorStakeholder = new Map(vigentes.map((v) => [v.stakeholderId, v]));
  const comRascunho = new Set(rascunhos.map((r) => r.stakeholderId));
  return identificacoes
    .map((s) => {
      const v = vigentePorStakeholder.get(s.id);
      return {
        stakeholderId: s.id,
        nome: s.nome,
        tipoStakeholder: s.tipo,
        associado: idsAssociados.has(s.id),
        temRascunho: comRascunho.has(s.id),
        vigente: v
          ? {
              numeroVersao: v.numeroVersao,
              metodologiaId: v.metodologiaId,
              metodologiaNome: v.metodologiaNome,
              poder: v.poder,
              interesse: v.interesse,
              posicionamento: v.posicionamento,
              grauConfianca: v.grauConfianca,
              // Versões publicadas sempre têm as duas datas (garantido pelo banco).
              dataReferencia: v.dataReferencia ?? "",
              proximaRevisao: v.proximaRevisao ?? "",
            }
          : null,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// --- Ficha individual --------------------------------------------------------

/** Ficha de um stakeholder em um contexto, com todas as versões (nenhuma é ocultada). */
export async function obterFicha(banco: Executor, projetoTemaId: string, stakeholderId: string) {
  const [identificacao] = await banco
    .select({ id: stakeholder.id, tipo: stakeholder.tipo, nome: nomeDoStakeholder })
    .from(stakeholder)
    .leftJoin(pessoa, eq(pessoa.id, stakeholder.id))
    .leftJoin(instituicao, eq(instituicao.id, stakeholder.id))
    .where(eq(stakeholder.id, stakeholderId));
  if (!identificacao) return null;

  const [[associada], [ficha]] = await Promise.all([
    banco
      .select({ id: associacao.id })
      .from(associacao)
      .where(
        and(
          eq(associacao.stakeholderId, stakeholderId),
          eq(associacao.projetoTemaId, projetoTemaId),
          isNull(associacao.dataFim),
          isNull(associacao.arquivadoEm),
        ),
      )
      .limit(1),
    banco
      .select({ id: avaliacao.id })
      .from(avaliacao)
      .where(and(eq(avaliacao.stakeholderId, stakeholderId), eq(avaliacao.projetoTemaId, projetoTemaId))),
  ]);

  const versoes = ficha ? await versoesDaFicha(banco, ficha.id) : [];
  return { stakeholder: identificacao, associado: Boolean(associada), avaliacaoId: ficha?.id ?? null, versoes };
}

async function versoesDaFicha(banco: Executor, avaliacaoId: string) {
  const versoes = await banco
    .select({
      id: versao.id,
      numeroVersao: versao.numeroVersao,
      situacao: versao.situacao,
      metodologiaId: versao.metodologiaVersaoId,
      metodologiaNome: metodologia.nome,
      metodologiaHomologada: metodologia.homologada,
      metodologiaSituacao: metodologia.situacao,
      poder: versao.poder,
      interesse: versao.interesse,
      posicionamento: versao.posicionamento,
      grauConfianca: versao.grauConfianca,
      justificativaConfianca: versao.justificativaConfianca,
      justificativa: versao.justificativa,
      validacaoInstitucional: versao.validacaoInstitucional,
      dataReferencia: versao.dataReferencia,
      proximaRevisao: versao.proximaRevisao,
      publicadaEm: versao.publicadaEm,
      avaliadorNome: usuario.nome,
      arquivadoEm: versao.arquivadoEm,
    })
    .from(versao)
    .leftJoin(metodologia, eq(metodologia.id, versao.metodologiaVersaoId))
    .leftJoin(usuario, eq(usuario.id, versao.avaliadorId))
    .where(eq(versao.avaliacaoId, avaliacaoId))
    .orderBy(desc(versao.numeroVersao));
  if (versoes.length === 0) return [];

  const ids = versoes.map((v) => v.id);
  const [notas, evidencias] = await Promise.all([
    banco
      .select({
        versaoId: nota.avaliacaoVersaoId,
        criterioId: nota.criterioAvaliacaoId,
        nota: nota.nota,
        criterioNome: criterio.nome,
        dimensao: criterio.dimensao,
        escalaMinima: criterio.escalaMinima,
        escalaMaxima: criterio.escalaMaxima,
        ordem: criterio.ordem,
      })
      .from(nota)
      .innerJoin(criterio, eq(criterio.id, nota.criterioAvaliacaoId))
      .where(and(inArray(nota.avaliacaoVersaoId, ids), isNull(nota.arquivadoEm)))
      .orderBy(asc(criterio.dimensao), asc(criterio.ordem), asc(criterio.nome)),
    banco
      .select({
        id: evidencia.id,
        versaoId: evidencia.avaliacaoVersaoId,
        tipo: evidencia.tipo,
        descricao: evidencia.descricao,
        fonte: evidencia.fonte,
        url: evidencia.url,
        dataEvidencia: evidencia.dataEvidencia,
      })
      .from(evidencia)
      .where(and(inArray(evidencia.avaliacaoVersaoId, ids), isNull(evidencia.arquivadoEm)))
      .orderBy(sql`${evidencia.dataEvidencia} desc nulls last`, asc(evidencia.criadoEm)),
  ]);
  return versoes.map((v) => ({
    ...v,
    notas: notas.filter((n) => n.versaoId === v.id),
    evidencias: evidencias.filter((e) => e.versaoId === v.id),
  }));
}

export type VersaoDaFicha = Awaited<ReturnType<typeof versoesDaFicha>>[number];

/** Contexto de uma versão, para conferir permissões antes de gravar. */
export async function contextoDaVersao(banco: Executor, versaoId: string) {
  const [encontrada] = await banco
    .select({
      avaliacaoId: versao.avaliacaoId,
      situacao: versao.situacao,
      arquivadoEm: versao.arquivadoEm,
      metodologiaId: versao.metodologiaVersaoId,
      projetoTemaId: avaliacao.projetoTemaId,
      stakeholderId: avaliacao.stakeholderId,
    })
    .from(versao)
    .innerJoin(avaliacao, eq(avaliacao.id, versao.avaliacaoId))
    .where(eq(versao.id, versaoId));
  return encontrada ?? null;
}

export async function contextoDaEvidencia(banco: Executor, evidenciaId: string) {
  const [encontrada] = await banco
    .select({ versaoId: evidencia.avaliacaoVersaoId })
    .from(evidencia)
    .where(eq(evidencia.id, evidenciaId));
  return encontrada ?? null;
}

// --- Gravações ---------------------------------------------------------------

/**
 * Abre um rascunho (criando a ficha, se preciso) com a metodologia vigente.
 * Parte da versão vigente: copia posicionamento, grau de confiança, validação
 * institucional e evidências; as notas só são copiadas se a metodologia for a
 * mesma. Justificativas começam em branco, para serem revistas.
 */
export async function iniciarRascunho(tx: Executor, projetoTemaId: string, stakeholderId: string): Promise<string> {
  let [ficha] = await tx
    .select({ id: avaliacao.id })
    .from(avaliacao)
    .where(and(eq(avaliacao.stakeholderId, stakeholderId), eq(avaliacao.projetoTemaId, projetoTemaId)));
  if (!ficha) {
    [ficha] = await tx.insert(avaliacao).values({ stakeholderId, projetoTemaId }).returning({ id: avaliacao.id });
  }

  const [vigenteMetodologia, [ultima], [atual]] = await Promise.all([
    metodologiaVigente(tx),
    tx.select({ numero: max(versao.numeroVersao) }).from(versao).where(eq(versao.avaliacaoId, ficha.id)),
    tx.select().from(versao).where(and(eq(versao.avaliacaoId, ficha.id), eq(versao.situacao, "vigente"))),
  ]);

  const [nova] = await tx
    .insert(versao)
    .values({
      avaliacaoId: ficha.id,
      numeroVersao: (ultima?.numero ?? 0) + 1,
      metodologiaVersaoId: vigenteMetodologia?.id ?? null,
      posicionamento: atual?.posicionamento ?? null,
      grauConfianca: atual?.grauConfianca ?? null,
      validacaoInstitucional: atual?.validacaoInstitucional ?? null,
      dataReferencia: hojeEmBrasilia(),
    })
    .returning({ id: versao.id });

  if (atual) {
    const evidenciasAtuais = await tx
      .select()
      .from(evidencia)
      .where(and(eq(evidencia.avaliacaoVersaoId, atual.id), isNull(evidencia.arquivadoEm)));
    if (evidenciasAtuais.length > 0) {
      await tx.insert(evidencia).values(
        evidenciasAtuais.map((e) => ({
          avaliacaoVersaoId: nova.id,
          tipo: e.tipo,
          descricao: e.descricao,
          fonte: e.fonte,
          url: e.url,
          dataEvidencia: e.dataEvidencia,
        })),
      );
    }
    if (atual.metodologiaVersaoId && atual.metodologiaVersaoId === vigenteMetodologia?.id) {
      const notasAtuais = await tx
        .select()
        .from(nota)
        .where(and(eq(nota.avaliacaoVersaoId, atual.id), isNull(nota.arquivadoEm)));
      if (notasAtuais.length > 0) {
        await tx.insert(nota).values(
          notasAtuais.map((n) => ({
            avaliacaoVersaoId: nova.id,
            criterioAvaliacaoId: n.criterioAvaliacaoId,
            nota: n.nota,
            justificativa: n.justificativa,
          })),
        );
      }
    }
  }
  return nova.id;
}

/** Grava os campos e as notas do rascunho. Critério sem nota fica sem nota (nunca zero). */
export async function salvarRascunho(tx: Executor, dados: DadosRascunho, notas: ReadonlyMap<string, number>) {
  const [rascunho] = await tx
    .select({ metodologiaId: versao.metodologiaVersaoId })
    .from(versao)
    .where(and(eq(versao.id, dados.versaoId), eq(versao.situacao, "rascunho"), isNull(versao.arquivadoEm)));
  if (!rascunho) throw new Error("Rascunho não encontrado ou já publicado.");

  await tx
    .update(versao)
    .set({
      posicionamento: dados.posicionamento ?? null,
      grauConfianca: dados.grauConfianca ?? null,
      justificativaConfianca: dados.justificativaConfianca ?? null,
      justificativa: dados.justificativa ?? null,
      validacaoInstitucional: dados.validacaoInstitucional ?? null,
      dataReferencia: dados.dataReferencia ?? null,
    })
    .where(eq(versao.id, dados.versaoId));

  const criterios = rascunho.metodologiaId ? await criteriosDaMetodologia(tx, rascunho.metodologiaId) : [];
  for (const criterioId of notas.keys()) {
    if (!criterios.some((c) => c.id === criterioId)) throw new Error("O critério não pertence à metodologia desta avaliação.");
  }
  for (const c of criterios) {
    const valor = notas.get(c.id);
    if (valor === undefined) {
      await tx
        .update(nota)
        .set({ arquivadoEm: sql`now()` })
        .where(and(eq(nota.avaliacaoVersaoId, dados.versaoId), eq(nota.criterioAvaliacaoId, c.id), isNull(nota.arquivadoEm)));
    } else {
      await tx
        .insert(nota)
        .values({ avaliacaoVersaoId: dados.versaoId, criterioAvaliacaoId: c.id, nota: valor })
        .onConflictDoUpdate({
          target: [nota.avaliacaoVersaoId, nota.criterioAvaliacaoId],
          set: { nota: valor, arquivadoEm: null },
        });
    }
  }
}

export async function adicionarEvidencia(tx: Executor, dados: DadosEvidencia): Promise<string> {
  const [nova] = await tx
    .insert(evidencia)
    .values({
      avaliacaoVersaoId: dados.versaoId,
      tipo: dados.tipo,
      descricao: dados.descricao,
      fonte: dados.fonte ?? null,
      url: dados.url ?? null,
      dataEvidencia: dados.dataEvidencia ?? null,
    })
    .returning({ id: evidencia.id });
  return nova.id;
}

/** Retira a evidência do rascunho (arquivamento; nada é apagado). */
export async function removerEvidencia(tx: Executor, evidenciaId: string) {
  await tx
    .update(evidencia)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(evidencia.id, evidenciaId), isNull(evidencia.arquivadoEm)));
}

/**
 * Publica o rascunho: calcula poder e interesse com a metodologia da versão,
 * marca a vigente anterior como substituída e torna o rascunho a nova vigente.
 * O banco confere justificativa, data de referência, evidência e as demais regras.
 */
export async function publicarRascunho(tx: Executor, versaoId: string) {
  const [rascunho] = await tx
    .select({ avaliacaoId: versao.avaliacaoId, metodologiaId: versao.metodologiaVersaoId })
    .from(versao)
    .where(and(eq(versao.id, versaoId), eq(versao.situacao, "rascunho"), isNull(versao.arquivadoEm)));
  if (!rascunho) throw new Error("Rascunho não encontrado ou já publicado.");

  let resultado: { poder: number | null; interesse: number | null } = { poder: null, interesse: null };
  if (rascunho.metodologiaId) {
    const [criterios, notas] = await Promise.all([
      criteriosDaMetodologia(tx, rascunho.metodologiaId),
      tx
        .select({ criterioId: nota.criterioAvaliacaoId, nota: nota.nota })
        .from(nota)
        .where(and(eq(nota.avaliacaoVersaoId, versaoId), isNull(nota.arquivadoEm))),
    ]);
    resultado = calcularResultado(criterios, new Map(notas.map((n) => [n.criterioId, n.nota])));
  }

  await tx
    .update(versao)
    .set({ situacao: "substituida" })
    .where(and(eq(versao.avaliacaoId, rascunho.avaliacaoId), eq(versao.situacao, "vigente")));
  await tx
    .update(versao)
    .set({ situacao: "vigente", poder: resultado.poder, interesse: resultado.interesse })
    .where(eq(versao.id, versaoId));
  return resultado;
}

/** Descarta o rascunho (arquivamento; fica registrado no histórico). */
export async function descartarRascunho(tx: Executor, versaoId: string) {
  await tx
    .update(versao)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(versao.id, versaoId), eq(versao.situacao, "rascunho"), isNull(versao.arquivadoEm)));
}
