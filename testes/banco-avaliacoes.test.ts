// @vitest-environment node
/**
 * Regras do banco de dados da avaliação estratégica (Etapas 2A e 2B),
 * verificadas em um banco PGlite real, criado na memória. Somente dados
 * fictícios. As metodologias de demonstração não representam a metodologia
 * institucional; a V2.2 usa as rubricas homologadas (Q-66 1.0).
 */
import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, type Transacao } from "@/lib/banco/conexao";
import {
  avaliacaoNotaCriterio,
  avaliacaoVersao,
  comite,
  criterioAvaliacao,
  evidencia,
  metodologiaVersao,
  registroAuditoria,
  rubricaNivel,
} from "@/lib/banco/esquema";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import * as avaliacoes from "@/modulos/avaliacoes/consultas";
import { classificarParaMatriz } from "@/modulos/avaliacoes/matriz";
import { MENSAGENS_ALERTA } from "@/modulos/avaliacoes/alertas";
import { METODOLOGIA_V22, RUBRICAS_V22 } from "@/modulos/avaliacoes/rubricas-v22";
import * as projetos from "@/modulos/projetos-temas/consultas";
import * as stakeholders from "@/modulos/stakeholders/consultas";

let banco: Banco;
let usuarioId: string;
let comiteId: string;
let metodologiaId: string;
let criterios: Awaited<ReturnType<typeof avaliacoes.criteriosDaMetodologia>>;

beforeAll(async () => {
  banco = await abrirBanco();
  usuarioId = (await obterUsuarioAtual(banco)).id;
  [{ id: comiteId }] = await banco.select({ id: comite.id }).from(comite).limit(1);
  metodologiaId = await gravar(async (tx) => {
    const id = await avaliacoes.criarMetodologia(tx, {
      nome: "Teste fictício 1",
      criterios: [
        { dimensao: "poder", nome: "Fictício P1", escalaMinima: 1, escalaMaxima: 5, peso: 3 },
        { dimensao: "poder", nome: "Fictício P2", escalaMinima: 1, escalaMaxima: 5, peso: 1 },
        { dimensao: "interesse", nome: "Fictício I1", escalaMinima: 0, escalaMaxima: 10 },
      ],
    });
    await avaliacoes.alterarSituacaoMetodologia(tx, id, "vigente");
    return id;
  });
  criterios = await avaliacoes.criteriosDaMetodologia(banco, metodologiaId);
}, 60_000);

function gravar<T>(operacao: (tx: Transacao) => Promise<T>) {
  return comoUsuario(banco, usuarioId, operacao);
}

async function mensagemDaFalha(operacao: Promise<unknown>): Promise<string> {
  try {
    await operacao;
  } catch (erro) {
    return mensagemDeErro(erro);
  }
  throw new Error("A operação deveria ter falhado.");
}

let contador = 0;
/** Cria um projeto fictício e associa a ele uma pessoa (ou instituição) fictícia nova. */
async function cenario(tipo: "pessoa" | "instituicao" = "pessoa") {
  contador++;
  return gravar(async (tx) => {
    const projetoTemaId = await projetos.criarProjetoTema(tx, {
      tipo: "projeto",
      nome: `Projeto Avaliação Fictício ${contador}`,
      comiteId,
      situacao: "ativo",
    });
    const stakeholderId =
      tipo === "pessoa"
        ? await stakeholders.criarPessoa(tx, { nomeCompleto: `Pessoa Avaliada Fictícia ${contador}` })
        : await stakeholders.criarInstituicao(tx, { nome: `Instituição Avaliada Fictícia ${contador}`, natureza: "empresa" });
    await projetos.criarAssociacao(tx, { projetoTemaId, stakeholderId, tipoRelacao: "parceiro" });
    return { projetoTemaId, stakeholderId };
  });
}

/** Rascunho completo (justificativa, data, todas as notas e uma evidência), pronto para publicar. */
async function rascunhoCompleto(projetoTemaId: string, stakeholderId: string, notas = [5, 1, 10]) {
  return gravar(async (tx) => {
    const versaoId = await avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId);
    await avaliacoes.salvarRascunho(
      tx,
      { versaoId, posicionamento: "favoravel", justificativa: "Justificativa fictícia.", dataReferencia: "2026-10-01" },
      new Map(notas.map((n, i) => [criterios[i].id, n])),
    );
    await avaliacoes.adicionarEvidencia(tx, { versaoId, tipo: "observacao", descricao: "Evidência fictícia." });
    return versaoId;
  });
}

async function lerVersao(id: string) {
  const [v] = await banco.select().from(avaliacaoVersao).where(eq(avaliacaoVersao.id, id));
  return v;
}

describe("Ficha e publicação", () => {
  test("a ficha exige que o stakeholder esteja associado ao contexto", async () => {
    const { projetoTemaId } = await cenario();
    const naoAssociada = await gravar((tx) => stakeholders.criarPessoa(tx, { nomeCompleto: "Pessoa Sem Associação Fictícia" }));
    const mensagem = await mensagemDaFalha(gravar((tx) => avaliacoes.iniciarRascunho(tx, projetoTemaId, naoAssociada)));
    expect(mensagem).toBe("Associe a pessoa ou instituição ao projeto ou tema antes de avaliá-la.");
  });

  test("publicar exige justificativa, data de referência e pelo menos uma evidência", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await gravar((tx) => avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId));

    await gravar((tx) => avaliacoes.salvarRascunho(tx, { versaoId, dataReferencia: "2026-10-01" }, new Map()));
    expect(await mensagemDaFalha(gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId)))).toBe(
      "Informe a justificativa antes de publicar.",
    );

    await gravar((tx) => avaliacoes.salvarRascunho(tx, { versaoId, justificativa: "Texto fictício." }, new Map()));
    expect(await mensagemDaFalha(gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId)))).toBe(
      "Informe a data de referência antes de publicar.",
    );

    await gravar((tx) =>
      avaliacoes.salvarRascunho(tx, { versaoId, justificativa: "Texto fictício.", dataReferencia: "2026-10-01" }, new Map()),
    );
    expect(await mensagemDaFalha(gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId)))).toBe(
      "Registre pelo menos uma evidência antes de publicar.",
    );

    await gravar((tx) => avaliacoes.adicionarEvidencia(tx, { versaoId, tipo: "documento", descricao: "Documento fictício." }));
    await gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId));
    const publicada = await lerVersao(versaoId);
    expect(publicada).toMatchObject({ situacao: "vigente", proximaRevisao: "2027-10-01", avaliadorId: usuarioId });
    expect(publicada.publicadaEm).not.toBeNull();
  });

  test("o cálculo de demonstração é gravado na versão: média ponderada na escala de 0 a 100", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await rascunhoCompleto(projetoTemaId, stakeholderId, [5, 1, 5]);
    const resultado = await gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId));
    // Poder: (100 × 3 + 0 × 1) / 4 = 75. Interesse: 5 na escala de 0 a 10 = 50.
    expect(resultado).toMatchObject({ poder: 75, interesse: 50 });
    expect(await lerVersao(versaoId)).toMatchObject({ poder: 75, interesse: 50 });
  });

  test("“não avaliado” e nota ausente nunca viram zero (T06)", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await gravar(async (tx) => {
      const id = await avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId);
      await avaliacoes.salvarRascunho(
        tx,
        { versaoId: id, justificativa: "Fictício.", dataReferencia: "2026-10-01" },
        new Map([[criterios[0].id, 1]]),
      );
      await avaliacoes.adicionarEvidencia(tx, { versaoId: id, tipo: "observacao", descricao: "Fictícia." });
      await avaliacoes.publicarRascunho(tx, id);
      return id;
    });
    const publicada = await lerVersao(versaoId);
    expect(publicada).toMatchObject({ posicionamento: null, poder: null, interesse: null });

    const [ficha] = (await avaliacoes.fichasDoContexto(banco, projetoTemaId)).filter((f) => f.stakeholderId === stakeholderId);
    const matriz = classificarParaMatriz([ficha], metodologiaId, "2026-11-01");
    expect(matriz.noGrafico).toHaveLength(0);
    expect(matriz.semPontuacao.map((f) => f.stakeholderId)).toEqual([stakeholderId]);
  });

  test("grau de confiança informado exige justificativa", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await rascunhoCompleto(projetoTemaId, stakeholderId);
    await gravar((tx) =>
      avaliacoes.salvarRascunho(
        tx,
        { versaoId, justificativa: "Fictícia.", dataReferencia: "2026-10-01", grauConfianca: "alto" },
        new Map(),
      ),
    );
    expect(await mensagemDaFalha(gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId)))).toBe(
      "Justifique o grau de confiança escolhido.",
    );
  });

  test("instituição só recebe posicionamento com validação institucional (T04)", async () => {
    const { projetoTemaId, stakeholderId } = await cenario("instituicao");
    const versaoId = await rascunhoCompleto(projetoTemaId, stakeholderId);
    expect(await mensagemDaFalha(gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId)))).toMatch(
      /informe a validação institucional/,
    );
    await gravar((tx) =>
      avaliacoes.salvarRascunho(
        tx,
        {
          versaoId,
          posicionamento: "favoravel",
          justificativa: "Fictícia.",
          dataReferencia: "2026-10-01",
          validacaoInstitucional: "Manifestação formal fictícia da instituição.",
        },
        new Map(criterios.map((c) => [c.id, c.escalaMinima])),
      ),
    );
    await gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId));
    expect((await lerVersao(versaoId)).situacao).toBe("vigente");
  });
});

describe("Versões e histórico", () => {
  test("versão publicada não pode ser alterada, nem diretamente no banco", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await rascunhoCompleto(projetoTemaId, stakeholderId);
    await gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId));
    const bloqueio = "Versões publicadas não podem ser alteradas; registre uma nova versão.";

    expect(
      await mensagemDaFalha(
        gravar((tx) => tx.update(avaliacaoVersao).set({ justificativa: "Outra" }).where(eq(avaliacaoVersao.id, versaoId))),
      ),
    ).toBe(bloqueio);
    expect(
      await mensagemDaFalha(
        gravar((tx) =>
          tx.update(avaliacaoVersao).set({ arquivadoEm: sql`now()` }).where(eq(avaliacaoVersao.id, versaoId)),
        ),
      ),
    ).toBe(bloqueio);
    expect(
      await mensagemDaFalha(
        gravar((tx) => tx.insert(evidencia).values({ avaliacaoVersaoId: versaoId, tipo: "link", descricao: "Nova" })),
      ),
    ).toBe(bloqueio);
    expect(
      await mensagemDaFalha(
        gravar((tx) =>
          tx.update(avaliacaoNotaCriterio).set({ nota: 2 }).where(eq(avaliacaoNotaCriterio.avaliacaoVersaoId, versaoId)),
        ),
      ),
    ).toBe(bloqueio);
    expect(
      await mensagemDaFalha(gravar((tx) => tx.delete(avaliacaoVersao).where(eq(avaliacaoVersao.id, versaoId)))),
    ).toMatch(/não são excluídos/);
  });

  test("nova versão substitui a anterior, que fica recuperável; outro contexto não muda (T02, T03)", async () => {
    const a = await cenario();
    const projetoB = await gravar((tx) =>
      projetos.criarProjetoTema(tx, { tipo: "tema", nome: "Tema Avaliação Fictício B", comiteId, situacao: "ativo" }),
    );
    await gravar((tx) =>
      projetos.criarAssociacao(tx, { projetoTemaId: projetoB, stakeholderId: a.stakeholderId, tipoRelacao: "executor" }),
    );
    const v1 = await rascunhoCompleto(a.projetoTemaId, a.stakeholderId, [5, 5, 10]);
    await gravar((tx) => avaliacoes.publicarRascunho(tx, v1));
    const vB = await rascunhoCompleto(projetoB, a.stakeholderId, [1, 1, 0]);
    await gravar((tx) => avaliacoes.publicarRascunho(tx, vB));

    const v2 = await rascunhoCompleto(a.projetoTemaId, a.stakeholderId, [3, 3, 5]);
    await gravar((tx) => avaliacoes.publicarRascunho(tx, v2));

    const fichaA = await avaliacoes.obterFicha(banco, a.projetoTemaId, a.stakeholderId);
    expect(fichaA?.versoes.map((v) => [v.numeroVersao, v.situacao, v.poder])).toEqual([
      [2, "vigente", 50],
      [1, "substituida", 100],
    ]);
    // A versão anterior mantém notas e evidências.
    expect(fichaA?.versoes[1].notas).toHaveLength(3);
    expect(fichaA?.versoes[1].evidencias).toHaveLength(1);

    const fichaB = await avaliacoes.obterFicha(banco, projetoB, a.stakeholderId);
    expect(fichaB?.versoes.map((v) => [v.numeroVersao, v.situacao, v.poder, v.interesse])).toEqual([[1, "vigente", 0, 0]]);
  });

  test("um rascunho por ficha; o descartado fica registrado e libera um novo", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const primeiro = await gravar((tx) => avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId));
    expect(await mensagemDaFalha(gravar((tx) => avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId)))).toBe(
      "Já existe um rascunho em andamento para esta avaliação.",
    );
    await gravar((tx) => avaliacoes.descartarRascunho(tx, primeiro));
    const segundo = await gravar((tx) => avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId));
    const ficha = await avaliacoes.obterFicha(banco, projetoTemaId, stakeholderId);
    expect(ficha?.versoes.map((v) => [v.id, v.arquivadoEm !== null])).toEqual([
      [segundo, false],
      [primeiro, true],
    ]);
  });

  test("a publicação fica na trilha de auditoria", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await rascunhoCompleto(projetoTemaId, stakeholderId);
    await gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId));
    const registros = await banco
      .select()
      .from(registroAuditoria)
      .where(and(eq(registroAuditoria.tabela, "avaliacao_versao"), eq(registroAuditoria.registroId, versaoId)));
    const publicacao = registros.find((r) => (r.dadosNovos as { situacao?: string })?.situacao === "vigente");
    expect(publicacao?.usuarioId).toBe(usuarioId);
  });
});

describe("Metodologias", () => {
  test("critérios de metodologia vigente não mudam; só uma vigente por vez", async () => {
    expect(
      await mensagemDaFalha(
        gravar((tx) => tx.update(criterioAvaliacao).set({ peso: 9 }).where(eq(criterioAvaliacao.id, criterios[0].id))),
      ),
    ).toMatch(/não podem ser alterados/);
    expect(
      await mensagemDaFalha(
        gravar((tx) => tx.update(metodologiaVersao).set({ nome: "Outro nome" }).where(eq(metodologiaVersao.id, metodologiaId))),
      ),
    ).toMatch(/não pode ser alterada/);

    const outra = await gravar((tx) =>
      avaliacoes.criarMetodologia(tx, {
        nome: "Teste fictício concorrente",
        criterios: [
          { dimensao: "poder", nome: "X", escalaMinima: 1, escalaMaxima: 3 },
          { dimensao: "interesse", nome: "Y", escalaMinima: 1, escalaMaxima: 3 },
        ],
      }),
    );
    expect(await mensagemDaFalha(gravar((tx) => avaliacoes.alterarSituacaoMetodologia(tx, outra, "vigente")))).toBe(
      "Já existe uma metodologia vigente. Encerre-a antes de colocar outra em vigor.",
    );
  });

  test("metodologia sem critérios das duas dimensões não entra em vigor", async () => {
    const incompleta = await gravar((tx) =>
      avaliacoes.criarMetodologia(tx, {
        nome: "Teste fictício incompleto",
        criterios: [{ dimensao: "poder", nome: "Só poder", escalaMinima: 1, escalaMaxima: 5 }],
      }),
    );
    expect(
      await mensagemDaFalha(
        gravar(async (tx) => {
          await tx.update(metodologiaVersao).set({ situacao: "encerrada" }).where(eq(metodologiaVersao.situacao, "vigente"));
          await avaliacoes.alterarSituacaoMetodologia(tx, incompleta, "vigente");
        }),
      ),
    ).toMatch(/pelo menos um critério de poder e um de interesse/);
  });

  test("nota fora da escala ou de critério de outra metodologia é recusada", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await gravar((tx) => avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId));
    expect(
      await mensagemDaFalha(gravar((tx) => avaliacoes.salvarRascunho(tx, { versaoId }, new Map([[criterios[0].id, 6]])))),
    ).toBe("A nota deve estar entre 1 e 5.");

    const outra = await gravar((tx) =>
      avaliacoes.criarMetodologia(tx, {
        nome: "Teste fictício rascunho",
        criterios: [{ dimensao: "poder", nome: "Z", escalaMinima: 1, escalaMaxima: 5 }],
      }),
    );
    const [criterioOutra] = await avaliacoes.criteriosDaMetodologia(banco, outra);
    expect(
      await mensagemDaFalha(
        gravar((tx) =>
          tx.insert(avaliacaoNotaCriterio).values({ avaliacaoVersaoId: versaoId, criterioAvaliacaoId: criterioOutra.id, nota: 3 }),
        ),
      ),
    ).toBe("O critério não pertence à metodologia desta avaliação.");
  });

  test("com nova metodologia (mudança substantiva): rascunho antigo não publica, avaliação antiga vira histórica e nada de classificação é herdado (T-4)", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const publicada = await rascunhoCompleto(projetoTemaId, stakeholderId);
    await gravar((tx) => avaliacoes.publicarRascunho(tx, publicada));
    const pendente = await gravar((tx) => avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId));
    await gravar((tx) => avaliacoes.salvarRascunho(tx, { versaoId: pendente, justificativa: "x", dataReferencia: "2026-10-02" }, new Map()));

    const nova = await gravar(async (tx) => {
      await tx.update(metodologiaVersao).set({ situacao: "encerrada" }).where(eq(metodologiaVersao.situacao, "vigente"));
      const id = await avaliacoes.criarMetodologia(tx, {
        nome: "Teste fictício 2",
        criterios: [
          { dimensao: "poder", nome: "Novo P", escalaMinima: 1, escalaMaxima: 5 },
          { dimensao: "interesse", nome: "Novo I", escalaMinima: 1, escalaMaxima: 5 },
        ],
      });
      await avaliacoes.alterarSituacaoMetodologia(tx, id, "vigente");
      return id;
    });

    expect(await mensagemDaFalha(gravar((tx) => avaliacoes.publicarRascunho(tx, pendente)))).toMatch(
      /não está mais vigente/,
    );
    const fichas = await avaliacoes.fichasDoContexto(banco, projetoTemaId);
    const matriz = classificarParaMatriz(fichas, nova, "2026-11-01");
    expect(matriz.metodologiaAnterior.map((f) => f.stakeholderId)).toEqual([stakeholderId]);
    expect(matriz.exigemReavaliacao).toEqual([expect.objectContaining({ motivo: "metodologia_anterior" })]);

    await gravar((tx) => avaliacoes.descartarRascunho(tx, pendente));
    const novoRascunho = await gravar((tx) => avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId));
    const ficha = await avaliacoes.obterFicha(banco, projetoTemaId, stakeholderId);
    const rascunho = ficha?.versoes.find((v) => v.id === novoRascunho);
    // Sem natureza da alteração registrada, a nova metodologia não é comparável: nada é herdado como válido.
    expect(rascunho).toMatchObject({ metodologiaId: nova, posicionamento: null, grauConfianca: null });
    expect(rascunho?.notas).toHaveLength(0);
    // A evidência anterior chega como referência, com a origem registrada.
    expect(rascunho?.evidencias).toHaveLength(1);
    expect(rascunho?.evidencias[0].origemId).not.toBeNull();
  });
});

describe("Escala V2.2 (Etapa 2B)", () => {
  let v22Id: string;

  beforeAll(async () => {
    v22Id = await gravar(async (tx) => {
      await tx.update(metodologiaVersao).set({ situacao: "encerrada" }).where(eq(metodologiaVersao.situacao, "vigente"));
      const id = await avaliacoes.criarMetodologia(tx, { ...METODOLOGIA_V22, nome: "V2.2 fictícia de teste" });
      await avaliacoes.alterarSituacaoMetodologia(tx, id, "vigente");
      return id;
    });
  });

  /** Rascunho na V2.2 com os dados informados (sem evidência, que é opcional). */
  async function rascunhoV22(projetoTemaId: string, stakeholderId: string, dados: Omit<Parameters<typeof avaliacoes.salvarRascunho>[1], "versaoId">) {
    return gravar(async (tx) => {
      const versaoId = await avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId);
      await avaliacoes.salvarRascunho(tx, { versaoId, dataReferencia: "2026-10-20", justificativa: "Síntese fictícia.", ...dados }, new Map());
      return versaoId;
    });
  }

  const COMPLETO = {
    nivelPoder: "alto",
    justificativaPoder: "Competência fictícia.",
    nivelInteresse: "medio",
    justificativaInteresse: "Relevância parcial fictícia.",
    posicionamento: "favoravel",
    naturezaPosicionamento: "manifestacao_formal",
    validacaoInstitucional: "Ofício fictício.",
    situacaoRessalvas: "nao_identificadas",
    justificativaPosicionamento: "Apoio fictício.",
  } as const;

  test("a metodologia V2.2 entra em vigor com rubricas; sem elas, não; rubricas da vigente não mudam", async () => {
    const semRubricas = await gravar((tx) =>
      avaliacoes.criarMetodologia(tx, { nome: "V2.2 sem rubricas (fictícia)", criterios: [] }),
    );
    expect(
      await mensagemDaFalha(
        gravar(async (tx) => {
          await tx.update(metodologiaVersao).set({ situacao: "encerrada" }).where(eq(metodologiaVersao.situacao, "vigente"));
          await avaliacoes.alterarSituacaoMetodologia(tx, semRubricas, "vigente");
        }),
      ),
    ).toBe("A metodologia V2.2 precisa das rubricas de poder, interesse e posicionamento para entrar em vigor.");
    expect(
      await mensagemDaFalha(
        gravar((tx) =>
          tx.update(rubricaNivel).set({ criterioOrientador: "Outro texto" }).where(eq(rubricaNivel.metodologiaVersaoId, v22Id)),
        ),
      ),
    ).toMatch(/rubricas de uma metodologia vigente ou encerrada não podem ser alteradas/);
    expect(
      await mensagemDaFalha(
        gravar((tx) =>
          tx.insert(criterioAvaliacao).values({ metodologiaVersaoId: semRubricas, dimensao: "poder", nome: "X", escalaMinima: 1, escalaMaxima: 5 }),
        ),
      ),
    ).toBe("Metodologias da escala V2.2 usam rubricas de níveis, sem critérios com notas.");
    expect((await avaliacoes.rubricasDaMetodologia(banco, v22Id)).length).toBe(RUBRICAS_V22.length);
  });

  test("níveis são gravados sem cálculo; pontuação de 0 a 100 e valor fora da escala são recusados (T17, T21)", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await rascunhoV22(projetoTemaId, stakeholderId, COMPLETO);
    expect(
      await mensagemDaFalha(gravar((tx) => tx.update(avaliacaoVersao).set({ poder: 50 }).where(eq(avaliacaoVersao.id, versaoId)))),
    ).toBe("Na escala V2.2, poder e interesse são níveis (Baixo, Médio ou Alto), sem pontuação de 0 a 100.");
    await expect(
      gravar((tx) => tx.execute(sql`update avaliacao_versao set nivel_poder = 'altissimo' where id = ${versaoId}`)),
    ).rejects.toThrow();

    const resultado = await gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId));
    expect(resultado).toMatchObject({ poder: null, interesse: null, alertas: [] });
    expect(await lerVersao(versaoId)).toMatchObject({ situacao: "vigente", nivelPoder: "alto", nivelInteresse: "medio", poder: null });
  });

  test("categorias parciais são recusadas no banco para novas avaliações (T22)", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    expect(
      await mensagemDaFalha(rascunhoV22(projetoTemaId, stakeholderId, { posicionamento: "parcialmente_favoravel" })),
    ).toBe('As categorias parciais existem só no histórico; use Favorável, Neutro, Contrário ou "Não avaliado".');
  });

  test("“não avaliado” nos níveis e no posicionamento é aceito e nunca vira Baixo nem Neutro", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await rascunhoV22(projetoTemaId, stakeholderId, {});
    await gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId));
    expect(await lerVersao(versaoId)).toMatchObject({ nivelPoder: null, nivelInteresse: null, posicionamento: null });
  });

  test("evidência e validação institucional não são exigidas; instituição publica com informação informal (D-067)", async () => {
    const { projetoTemaId, stakeholderId } = await cenario("instituicao");
    const versaoId = await rascunhoV22(projetoTemaId, stakeholderId, {
      ...COMPLETO,
      naturezaPosicionamento: "informacao_informal",
      validacaoInstitucional: undefined,
      grauConfianca: "medio",
      justificativaConfianca: "Fonte direta fictícia.",
    });
    const resultado = await gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId));
    expect((await lerVersao(versaoId)).situacao).toBe("vigente");
    // A origem vazia gera alerta, que fica registrado, mas não impede publicar.
    expect(resultado.alertas).toEqual([MENSAGENS_ALERTA.origem_nao_informada]);
  });

  test("rastreabilidade mínima: justificativa de cada dimensão classificada e natureza do posicionamento (T23 adaptado)", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await rascunhoV22(projetoTemaId, stakeholderId, { nivelPoder: "baixo" });
    const publicar = () => mensagemDaFalha(gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId)));
    const salvar = (dados: Omit<Parameters<typeof avaliacoes.salvarRascunho>[1], "versaoId">) =>
      gravar((tx) =>
        avaliacoes.salvarRascunho(tx, { versaoId, dataReferencia: "2026-10-20", justificativa: "Síntese.", ...dados }, new Map()),
      );

    expect(await publicar()).toBe("Justifique o nível de poder antes de publicar.");
    await salvar({ nivelPoder: "baixo", justificativaPoder: "Nada relevante identificado.", nivelInteresse: "alto" });
    expect(await publicar()).toBe("Justifique o nível de interesse antes de publicar.");
    const base = { nivelPoder: "baixo", justificativaPoder: "x", nivelInteresse: "alto", justificativaInteresse: "y" } as const;
    await salvar({ ...base, posicionamento: "neutro" });
    expect(await publicar()).toBe("Justifique o posicionamento antes de publicar.");
    await salvar({ ...base, posicionamento: "neutro", justificativaPosicionamento: "Declarou que não toma posição." });
    expect(await publicar()).toBe(
      "Indique a natureza da informação do posicionamento (manifestação formal, informação informal ou percepção do consultor).",
    );
    await salvar({
      ...base,
      posicionamento: "neutro",
      justificativaPosicionamento: "Declarou que não toma posição.",
      naturezaPosicionamento: "manifestacao_formal",
      validacaoInstitucional: "Nota fictícia.",
      situacaoRessalvas: "nao_identificadas",
    });
    await gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId));
    expect((await lerVersao(versaoId)).posicionamento).toBe("neutro");
  });

  test("alertas não bloqueiam: o consultor publica e os alertas mantidos ficam gravados (D-067)", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await rascunhoV22(projetoTemaId, stakeholderId, {
      ...COMPLETO,
      posicionamento: "neutro",
      naturezaPosicionamento: "percepcao_consultor",
      situacaoRessalvas: "ha_ressalvas",
      descricaoRessalvas: undefined,
      grauConfianca: "alto",
      justificativaConfianca: "Mantido apesar do alerta (fictício).",
    });
    await gravar((tx) => avaliacoes.publicarRascunho(tx, versaoId));
    expect((await lerVersao(versaoId)).alertasReconhecidos).toEqual([
      MENSAGENS_ALERTA.neutro_por_percepcao,
      MENSAGENS_ALERTA.ressalvas_sem_descricao,
      MENSAGENS_ALERTA.confianca_alta_nao_confirmada,
    ]);
  });

  test("toda nova versão exige metodologia vigente (T-2, T-3)", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    expect(
      await mensagemDaFalha(
        gravar(async (tx) => {
          await tx.update(metodologiaVersao).set({ situacao: "encerrada" }).where(eq(metodologiaVersao.situacao, "vigente"));
          await avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId);
        }),
      ),
    ).toBe("Não há metodologia vigente: coloque uma metodologia em vigor antes de iniciar a avaliação.");
  });

  test("a escala binária histórica não entra em vigor e não aceita o nível Médio (T20)", async () => {
    const binaria = await gravar((tx) =>
      avaliacoes.criarMetodologia(tx, {
        nome: "Binária histórica fictícia",
        escalaPoderInteresse: "binaria_historica",
        criterios: [],
        rubricas: RUBRICAS_V22,
      }),
    );
    expect(
      await mensagemDaFalha(
        gravar(async (tx) => {
          await tx.update(metodologiaVersao).set({ situacao: "encerrada" }).where(eq(metodologiaVersao.situacao, "vigente"));
          await avaliacoes.alterarSituacaoMetodologia(tx, binaria, "vigente");
        }),
      ),
    ).toMatch(/binária histórica serve só para registros históricos/);
    const { projetoTemaId, stakeholderId } = await cenario();
    const versaoId = await rascunhoV22(projetoTemaId, stakeholderId, {});
    const [{ avaliacaoId }] = await banco
      .select({ avaliacaoId: avaliacaoVersao.avaliacaoId })
      .from(avaliacaoVersao)
      .where(eq(avaliacaoVersao.id, versaoId));
    expect(
      await mensagemDaFalha(
        gravar((tx) =>
          tx.insert(avaliacaoVersao).values({ avaliacaoId, numeroVersao: 99, metodologiaVersaoId: binaria, nivelPoder: "medio" }),
        ),
      ),
    ).toBe("A escala binária histórica não tem o nível Médio.");
  });

  test("nova versão na mesma metodologia: classificações como ponto de partida, justificativas em branco, evidências com origem (T-4)", async () => {
    const { projetoTemaId, stakeholderId } = await cenario();
    const v1 = await rascunhoV22(projetoTemaId, stakeholderId, COMPLETO);
    await gravar((tx) => avaliacoes.adicionarEvidencia(tx, { versaoId: v1, tipo: "observacao", descricao: "Evidência fictícia." }));
    await gravar((tx) => avaliacoes.publicarRascunho(tx, v1));
    const v2 = await gravar((tx) => avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId));
    const ficha = await avaliacoes.obterFicha(banco, projetoTemaId, stakeholderId);
    const rascunho = ficha?.versoes.find((v) => v.id === v2);
    expect(rascunho).toMatchObject({
      nivelPoder: "alto",
      nivelInteresse: "medio",
      posicionamento: "favoravel",
      naturezaPosicionamento: "manifestacao_formal",
      situacaoRessalvas: "nao_identificadas",
      justificativaPoder: null,
      justificativaPosicionamento: null,
    });
    expect(rascunho?.evidencias.map((e) => e.origemId !== null)).toEqual([true]);
  });

  test("natureza da alteração (D-064): exigida para a nova versão; editorial com mudança estrutural recusada; editorial aprovada mantém a comparabilidade", async () => {
    const nova = (dados: Partial<Parameters<typeof avaliacoes.criarMetodologia>[1]>) =>
      gravar((tx) =>
        avaliacoes.criarMetodologia(tx, {
          ...METODOLOGIA_V22,
          nome: `V2.2 fictícia ${++contador}`,
          metodologiaAnteriorId: v22Id,
          ...dados,
        }),
      );
    const colocarEmVigor = (id: string) =>
      gravar(async (tx) => {
        await tx.update(metodologiaVersao).set({ situacao: "encerrada" }).where(eq(metodologiaVersao.situacao, "vigente"));
        await avaliacoes.alterarSituacaoMetodologia(tx, id, "vigente");
      });

    expect(await mensagemDaFalha(colocarEmVigor(await nova({})))).toMatch(/Registre a natureza da alteração/);
    expect(
      await mensagemDaFalha(
        colocarEmVigor(
          await nova({ naturezaAlteracao: "editorial", justificativaNatureza: "Só texto.", rubricas: RUBRICAS_V22.slice(1) }),
        ),
      ),
    ).toBe("Alteração estrutural (escala, níveis ou critérios) é sempre substantiva; não pode ser classificada como editorial.");
    expect(
      await mensagemDaFalha(
        colocarEmVigor(
          await nova({ naturezaAlteracao: "substantiva", justificativaNatureza: "Novas definições.", equivalentePosicionamentoA: v22Id }),
        ),
      ),
    ).toBe("Justifique a equivalência das definições de posicionamento.");

    // Avaliação publicada na V2.2 antes da versão editorial.
    const { projetoTemaId, stakeholderId } = await cenario();
    const v1 = await rascunhoV22(projetoTemaId, stakeholderId, COMPLETO);
    await gravar((tx) => avaliacoes.publicarRascunho(tx, v1));

    const editorial = await nova({
      naturezaAlteracao: "editorial",
      justificativaNatureza: "Correção de redação, sem mudança de significado.",
      rubricas: RUBRICAS_V22.map((r) => ({ ...r, criterioOrientador: `${r.criterioOrientador} (revisão de texto)` })),
    });
    await colocarEmVigor(editorial);
    const registrada = await avaliacoes.obterMetodologia(banco, editorial);
    expect(registrada).toMatchObject({ naturezaAlteracao: "editorial", naturezaAprovadaPor: usuarioId });
    expect(registrada?.naturezaAprovadaEm).not.toBeNull();

    // Na versão editorial, a classificação vigente segue como ponto de partida (comparável).
    const v2 = await gravar((tx) => avaliacoes.iniciarRascunho(tx, projetoTemaId, stakeholderId));
    const ficha = await avaliacoes.obterFicha(banco, projetoTemaId, stakeholderId);
    expect(ficha?.versoes.find((v) => v.id === v2)).toMatchObject({ metodologiaId: editorial, nivelPoder: "alto", posicionamento: "favoravel" });
  });
});
