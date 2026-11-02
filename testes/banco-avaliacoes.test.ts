// @vitest-environment node
/**
 * Regras do banco de dados da avaliação estratégica (Etapa 2A), verificadas em
 * um banco PGlite real, criado na memória. Somente dados e metodologias
 * fictícios: nada aqui representa a metodologia institucional.
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
} from "@/lib/banco/esquema";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import * as avaliacoes from "@/modulos/avaliacoes/consultas";
import { classificarParaMatriz } from "@/modulos/avaliacoes/matriz";
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
    expect(resultado).toEqual({ poder: 75, interesse: 50 });
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

  test("com nova metodologia: rascunho antigo não publica, avaliação antiga vira histórica e notas não são copiadas", async () => {
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
    expect(rascunho).toMatchObject({ metodologiaId: nova, posicionamento: "favoravel" });
    expect(rascunho?.notas).toHaveLength(0);
    expect(rascunho?.evidencias).toHaveLength(1);
  });
});
