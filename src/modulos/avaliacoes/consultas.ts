/**
 * Leitura e gravação das avaliações estratégicas (Etapas 2A e 2B). As gravações
 * devem ser feitas dentro de comoUsuario(), para a trilha de auditoria, e
 * somente depois de conferida a permissão no contexto (modulos/acesso/permissoes.ts).
 * As regras técnicas (escalas, publicação e imutabilidade) são garantidas pelo
 * banco; as regras de interpretação da V2.2 são alertas (alertas.ts).
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
  rubricaNivel as rubrica,
  stakeholder,
  stakeholderContexto as associacao,
  usuario,
} from "@/lib/banco/esquema";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { calcularAlertas } from "./alertas";
import { calcularResultado, type LigacaoMetodologia, metodologiasComparaveis } from "./calculo";
import type { DadosEvidencia, DadosRascunho } from "./esquemas";
import type { FichaParaMatriz } from "./matriz";
import type { DimensaoRubrica, EscalaPoderInteresse, EscalaPosicionamento } from "./rotulos";

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
      escalaPoderInteresse: metodologia.escalaPoderInteresse,
      // Consulta de uma só tabela: o Drizzle não qualifica as colunas, por isso
      // as subconsultas usam nomes escritos por extenso (ver listarComites).
      criterios: sql<number>`(
        select count(*)::int from criterio_avaliacao c
        where c.metodologia_versao_id = metodologia_versao.id and c.arquivado_em is null
      )`,
      rubricas: sql<number>`(
        select count(*)::int from rubrica_nivel r
        where r.metodologia_versao_id = metodologia_versao.id and r.arquivado_em is null
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

/** Rubricas dos níveis da metodologia V2.2 (texto de ajuda, Q-66 1.0). */
export async function rubricasDaMetodologia(banco: Executor, metodologiaId: string) {
  return banco
    .select({
      id: rubrica.id,
      dimensao: rubrica.dimensao,
      nivel: rubrica.nivel,
      criterioOrientador: rubrica.criterioOrientador,
      basesTipicas: rubrica.basesTipicas,
      ordem: rubrica.ordem,
    })
    .from(rubrica)
    .where(and(eq(rubrica.metodologiaVersaoId, metodologiaId), isNull(rubrica.arquivadoEm)))
    .orderBy(asc(rubrica.dimensao), asc(rubrica.ordem));
}

export type RubricaDaMetodologia = Awaited<ReturnType<typeof rubricasDaMetodologia>>[number];

export async function obterMetodologia(banco: Executor, id: string) {
  const [encontrada] = await banco.select().from(metodologia).where(eq(metodologia.id, id));
  if (!encontrada) return null;
  const idsRelacionados = [encontrada.metodologiaAnteriorId, encontrada.equivalentePosicionamentoA].filter(
    (valor): valor is string => valor !== null,
  );
  const [criterios, rubricas, relacionadas, aprovador] = await Promise.all([
    criteriosDaMetodologia(banco, id),
    rubricasDaMetodologia(banco, id),
    idsRelacionados.length === 0
      ? []
      : banco.select({ id: metodologia.id, nome: metodologia.nome }).from(metodologia).where(inArray(metodologia.id, idsRelacionados)),
    encontrada.naturezaAprovadaPor
      ? banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, encontrada.naturezaAprovadaPor))
      : [],
  ]);
  const nomePorId = new Map(relacionadas.map((m) => [m.id, m.nome]));
  return {
    ...encontrada,
    criterios,
    rubricas,
    anteriorNome: encontrada.metodologiaAnteriorId ? (nomePorId.get(encontrada.metodologiaAnteriorId) ?? null) : null,
    equivalenteNome: encontrada.equivalentePosicionamentoA
      ? (nomePorId.get(encontrada.equivalentePosicionamentoA) ?? null)
      : null,
    aprovadorNome: aprovador[0]?.nome ?? null,
  };
}

export async function metodologiaVigente(banco: Executor) {
  const [vigente] = await banco
    .select({
      id: metodologia.id,
      nome: metodologia.nome,
      homologada: metodologia.homologada,
      escalaPoderInteresse: metodologia.escalaPoderInteresse,
      escalaPosicionamento: metodologia.escalaPosicionamento,
    })
    .from(metodologia)
    .where(eq(metodologia.situacao, "vigente"));
  return vigente ?? null;
}

/** Ligações de cada metodologia com a anterior, para a tendência e a cópia na nova versão (T-4, T-6). */
export async function ligacoesDasMetodologias(banco: Executor): Promise<Map<string, LigacaoMetodologia>> {
  const linhas = await banco
    .select({
      id: metodologia.id,
      anteriorId: metodologia.metodologiaAnteriorId,
      naturezaAlteracao: metodologia.naturezaAlteracao,
      equivalentePosicionamentoA: metodologia.equivalentePosicionamentoA,
    })
    .from(metodologia);
  return new Map(linhas.map(({ id, ...ligacao }) => [id, ligacao]));
}

export type NovaMetodologia = {
  nome: string;
  descricao?: string;
  /** Padrão: demonstração (cinco categorias) quando há critérios; senão, V2.2. */
  escalaPoderInteresse?: EscalaPoderInteresse;
  escalaPosicionamento?: EscalaPosicionamento;
  homologada?: boolean;
  criterios: {
    dimensao: "poder" | "interesse";
    nome: string;
    descricao?: string;
    escalaMinima: number;
    escalaMaxima: number;
    peso?: number;
  }[];
  rubricas?: { dimensao: DimensaoRubrica; nivel: string; criterioOrientador: string; basesTipicas?: string }[];
  /** Versão substituída; exige a natureza da alteração para entrar em vigor (D-064). */
  metodologiaAnteriorId?: string;
  naturezaAlteracao?: "substantiva" | "editorial";
  justificativaNatureza?: string;
  equivalentePosicionamentoA?: string;
  justificativaEquivalencia?: string;
};

/**
 * Cria uma metodologia em rascunho com seus critérios ou rubricas. Não há tela
 * para isso: só a carga de demonstração e os testes a usam (D-034).
 */
export async function criarMetodologia(tx: Executor, dados: NovaMetodologia): Promise<string> {
  const demonstracao = dados.criterios.length > 0;
  const escalaPoderInteresse = dados.escalaPoderInteresse ?? (demonstracao ? "demonstracao_numerica" : "ordinal_tres_niveis");
  const [nova] = await tx
    .insert(metodologia)
    .values({
      nome: dados.nome,
      descricao: dados.descricao ?? null,
      homologada: dados.homologada ?? false,
      escalaPoderInteresse,
      escalaPosicionamento:
        dados.escalaPosicionamento ?? (escalaPoderInteresse === "demonstracao_numerica" ? "cinco_categorias" : "tres_categorias"),
      metodologiaAnteriorId: dados.metodologiaAnteriorId ?? null,
      naturezaAlteracao: dados.naturezaAlteracao ?? null,
      justificativaNatureza: dados.justificativaNatureza ?? null,
      equivalentePosicionamentoA: dados.equivalentePosicionamentoA ?? null,
      justificativaEquivalencia: dados.justificativaEquivalencia ?? null,
    })
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
  if (dados.rubricas && dados.rubricas.length > 0) {
    await tx.insert(rubrica).values(
      dados.rubricas.map((r, ordem) => ({
        metodologiaVersaoId: nova.id,
        dimensao: r.dimensao,
        nivel: r.nivel,
        criterioOrientador: r.criterioOrientador,
        basesTipicas: r.basesTipicas ?? null,
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
            nivelPoder: versao.nivelPoder,
            nivelInteresse: versao.nivelInteresse,
            posicionamento: versao.posicionamento,
            naturezaPosicionamento: versao.naturezaPosicionamento,
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
              nivelPoder: v.nivelPoder,
              nivelInteresse: v.nivelInteresse,
              posicionamento: v.posicionamento,
              naturezaPosicionamento: v.naturezaPosicionamento,
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
      escalaPoderInteresse: metodologia.escalaPoderInteresse,
      escalaPosicionamento: metodologia.escalaPosicionamento,
      poder: versao.poder,
      interesse: versao.interesse,
      nivelPoder: versao.nivelPoder,
      nivelInteresse: versao.nivelInteresse,
      posicionamento: versao.posicionamento,
      naturezaPosicionamento: versao.naturezaPosicionamento,
      grauConfianca: versao.grauConfianca,
      justificativaConfianca: versao.justificativaConfianca,
      justificativa: versao.justificativa,
      justificativaPoder: versao.justificativaPoder,
      justificativaInteresse: versao.justificativaInteresse,
      justificativaPosicionamento: versao.justificativaPosicionamento,
      situacaoRessalvas: versao.situacaoRessalvas,
      descricaoRessalvas: versao.descricaoRessalvas,
      validacaoInstitucional: versao.validacaoInstitucional,
      alertasReconhecidos: versao.alertasReconhecidos,
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
        origemId: evidencia.evidenciaOrigemId,
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

/** Contexto de uma versão, para conferir permissões e a escala antes de gravar. */
export async function contextoDaVersao(banco: Executor, versaoId: string) {
  const [encontrada] = await banco
    .select({
      avaliacaoId: versao.avaliacaoId,
      situacao: versao.situacao,
      arquivadoEm: versao.arquivadoEm,
      metodologiaId: versao.metodologiaVersaoId,
      escalaPoderInteresse: metodologia.escalaPoderInteresse,
      escalaPosicionamento: metodologia.escalaPosicionamento,
      projetoTemaId: avaliacao.projetoTemaId,
      stakeholderId: avaliacao.stakeholderId,
    })
    .from(versao)
    .innerJoin(avaliacao, eq(avaliacao.id, versao.avaliacaoId))
    .leftJoin(metodologia, eq(metodologia.id, versao.metodologiaVersaoId))
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
 * Regra da T-4 (D-064, D-068): se a versão vigente é de metodologia comparável
 * (a mesma, ou ligada só por alterações editoriais aprovadas), as classificações
 * vêm como ponto de partida para revisão; numa mudança metodológica substantiva,
 * nada de classificação é herdado. Em ambos os casos, as evidências vêm como
 * referência, com a origem registrada, e as justificativas começam em branco.
 * As notas só são copiadas se a metodologia for a mesma.
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
  const comparavel =
    atual !== undefined &&
    metodologiasComparaveis(vigenteMetodologia?.id ?? null, atual.metodologiaVersaoId, await ligacoesDasMetodologias(tx));
  const herdado = comparavel && atual ? atual : null;

  const [nova] = await tx
    .insert(versao)
    .values({
      avaliacaoId: ficha.id,
      numeroVersao: (ultima?.numero ?? 0) + 1,
      metodologiaVersaoId: vigenteMetodologia?.id ?? null,
      posicionamento: herdado?.posicionamento ?? null,
      grauConfianca: herdado?.grauConfianca ?? null,
      validacaoInstitucional: herdado?.validacaoInstitucional ?? null,
      nivelPoder: herdado?.nivelPoder ?? null,
      nivelInteresse: herdado?.nivelInteresse ?? null,
      naturezaPosicionamento: herdado?.naturezaPosicionamento ?? null,
      situacaoRessalvas: herdado?.situacaoRessalvas ?? null,
      descricaoRessalvas: herdado?.descricaoRessalvas ?? null,
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
          evidenciaOrigemId: e.id,
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
      nivelPoder: dados.nivelPoder ?? null,
      nivelInteresse: dados.nivelInteresse ?? null,
      justificativaPoder: dados.justificativaPoder ?? null,
      justificativaInteresse: dados.justificativaInteresse ?? null,
      justificativaPosicionamento: dados.justificativaPosicionamento ?? null,
      naturezaPosicionamento: dados.naturezaPosicionamento ?? null,
      situacaoRessalvas: dados.situacaoRessalvas ?? null,
      descricaoRessalvas: dados.descricaoRessalvas ?? null,
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
 * Publica o rascunho: na demonstração, calcula poder e interesse; na V2.2, não
 * há cálculo. Grava os alertas orientativos ativos, que o consultor decidiu
 * manter (D-067), marca a vigente anterior como substituída e torna o rascunho
 * a nova vigente. As regras técnicas de publicação são conferidas pelo banco.
 */
export async function publicarRascunho(tx: Executor, versaoId: string) {
  const [rascunho] = await tx
    .select({
      avaliacaoId: versao.avaliacaoId,
      metodologiaId: versao.metodologiaVersaoId,
      escalaPoderInteresse: metodologia.escalaPoderInteresse,
      posicionamento: versao.posicionamento,
      naturezaPosicionamento: versao.naturezaPosicionamento,
      validacaoInstitucional: versao.validacaoInstitucional,
      situacaoRessalvas: versao.situacaoRessalvas,
      descricaoRessalvas: versao.descricaoRessalvas,
      justificativaPosicionamento: versao.justificativaPosicionamento,
      grauConfianca: versao.grauConfianca,
    })
    .from(versao)
    .leftJoin(metodologia, eq(metodologia.id, versao.metodologiaVersaoId))
    .where(and(eq(versao.id, versaoId), eq(versao.situacao, "rascunho"), isNull(versao.arquivadoEm)));
  if (!rascunho) throw new Error("Rascunho não encontrado ou já publicado.");

  let resultado: { poder: number | null; interesse: number | null } = { poder: null, interesse: null };
  if (rascunho.metodologiaId && rascunho.escalaPoderInteresse === "demonstracao_numerica") {
    const [criterios, notas] = await Promise.all([
      criteriosDaMetodologia(tx, rascunho.metodologiaId),
      tx
        .select({ criterioId: nota.criterioAvaliacaoId, nota: nota.nota })
        .from(nota)
        .where(and(eq(nota.avaliacaoVersaoId, versaoId), isNull(nota.arquivadoEm))),
    ]);
    resultado = calcularResultado(criterios, new Map(notas.map((n) => [n.criterioId, n.nota])));
  }
  const alertas = calcularAlertas({
    posicionamento: rascunho.posicionamento,
    naturezaPosicionamento: rascunho.naturezaPosicionamento,
    origemPosicionamento: rascunho.validacaoInstitucional,
    situacaoRessalvas: rascunho.situacaoRessalvas,
    descricaoRessalvas: rascunho.descricaoRessalvas,
    justificativaPosicionamento: rascunho.justificativaPosicionamento,
    grauConfianca: rascunho.grauConfianca,
  }).map((a) => a.mensagem);

  await tx
    .update(versao)
    .set({ situacao: "substituida" })
    .where(and(eq(versao.avaliacaoId, rascunho.avaliacaoId), eq(versao.situacao, "vigente")));
  await tx
    .update(versao)
    .set({
      situacao: "vigente",
      poder: resultado.poder,
      interesse: resultado.interesse,
      alertasReconhecidos: alertas.length > 0 ? alertas : null,
    })
    .where(eq(versao.id, versaoId));
  return { ...resultado, alertas };
}

/** Descarta o rascunho (arquivamento; fica registrado no histórico). */
export async function descartarRascunho(tx: Executor, versaoId: string) {
  await tx
    .update(versao)
    .set({ arquivadoEm: sql`now()` })
    .where(and(eq(versao.id, versaoId), eq(versao.situacao, "rascunho"), isNull(versao.arquivadoEm)));
}
