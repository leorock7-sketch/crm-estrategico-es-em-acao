// @vitest-environment node
/**
 * Regras da Etapa 3 — iniciativas, interações e compromissos — verificadas em
 * um banco PGlite real, criado na memória com os mesmos scripts usados pela
 * aplicação: ligações múltiplas, registro único de reuniões, compromissos com
 * prazos vencidos, acompanhamento, integridade, histórico e visibilidade.
 * Somente dados fictícios.
 */
import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, type Transacao } from "@/lib/banco/conexao";
import {
  comite,
  compromisso,
  compromissoAcompanhamento,
  iniciativa,
  iniciativaProjetoTema,
  interacao,
  interacaoParticipante,
  permissaoContexto,
  registroAuditoria,
  usuario,
} from "@/lib/banco/esquema";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { podeEditarEmAlgum, projetosVisiveis } from "@/modulos/acesso/visibilidade";
import * as iniciativas from "@/modulos/iniciativas/consultas";
import type { DadosNovaIniciativa } from "@/modulos/iniciativas/esquemas";
import * as interacoes from "@/modulos/interacoes/consultas";
import type { DadosNovaInteracao } from "@/modulos/interacoes/esquemas";
import { situacaoDoPrazo } from "@/modulos/interacoes/rotulos";
import * as projetos from "@/modulos/projetos-temas/consultas";
import * as stakeholders from "@/modulos/stakeholders/consultas";

let banco: Banco;
let usuarioId: string;
let comiteInfra: string;
let comiteInovacao: string;
let projetoA: string;
let projetoB: string;
let projetoC: string;
let pessoaX: string;
let instituicaoY: string;
let instituicaoZ: string;
let equipe1: string;
let equipe2: string;
const hoje = hojeEmBrasilia();

/** Data relativa a hoje, no formato AAAA-MM-DD. */
function dia(deslocamento: number): string {
  const data = new Date(`${hoje}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + deslocamento);
  return data.toISOString().slice(0, 10);
}

beforeAll(async () => {
  banco = await abrirBanco();
  usuarioId = (await obterUsuarioAtual(banco)).id;
  for (const c of await banco.select().from(comite)) {
    if (c.nome.includes("Infraestrutura")) comiteInfra = c.id;
    if (c.nome.includes("Inovação")) comiteInovacao = c.id;
  }
  [equipe1, equipe2] = (
    await banco
      .insert(usuario)
      .values([
        { nome: "Equipe Fictícia Um", email: "equipe1@exemplo.invalid" },
        { nome: "Equipe Fictícia Dois", email: "equipe2@exemplo.invalid" },
      ])
      .returning({ id: usuario.id })
  ).map((u) => u.id);
  await gravar(async (tx) => {
    projetoA = await projetos.criarProjetoTema(tx, { tipo: "projeto", nome: "Projeto Fictício A", comiteId: comiteInfra, situacao: "ativo" });
    projetoB = await projetos.criarProjetoTema(tx, { tipo: "projeto", nome: "Projeto Fictício B", comiteId: comiteInfra, situacao: "ativo" });
    projetoC = await projetos.criarProjetoTema(tx, { tipo: "tema", nome: "Tema Fictício C", comiteId: comiteInovacao, situacao: "ativo" });
    pessoaX = await stakeholders.criarPessoa(tx, { nomeCompleto: "Pessoa Fictícia X" });
    instituicaoY = await stakeholders.criarInstituicao(tx, { nome: "Instituição Fictícia Y", natureza: "empresa" });
    instituicaoZ = await stakeholders.criarInstituicao(tx, { nome: "Instituição Fictícia Z", natureza: "orgao_publico" });
  });
}, 60_000);

function gravar<T>(operacao: (tx: Transacao) => Promise<T>) {
  return comoUsuario(banco, usuarioId, operacao);
}

/** Executa uma operação que deve falhar e devolve a mensagem exibida ao usuário. */
async function mensagemDaFalha(operacao: Promise<unknown>): Promise<string> {
  try {
    await operacao;
  } catch (erro) {
    return mensagemDeErro(erro);
  }
  throw new Error("A operação deveria ter falhado.");
}

function novaIniciativa(titulo: string, projetosIds: string[], extra: Partial<DadosNovaIniciativa> = {}): DadosNovaIniciativa {
  return { tipo: "demanda", titulo, situacao: "registrada", dataAbertura: dia(-30), projetos: projetosIds, ...extra };
}

function novaInteracao(assunto: string, extra: Partial<DadosNovaInteracao> = {}): DadosNovaInteracao {
  return {
    tipo: "reuniao_presencial",
    assunto,
    inicio: `${dia(-2)}T10:00`,
    situacao: "realizada",
    projetos: [],
    iniciativas: [],
    participantesExternos: [],
    participantesInternos: [],
    ...extra,
  };
}

describe("Iniciativas", () => {
  test("uma iniciativa envolve vários projetos e vários stakeholders, inclusive com dois papéis (RF-32, RF-33)", async () => {
    const id = await gravar(async (tx) => {
      const nova = await iniciativas.criarIniciativa(
        tx,
        novaIniciativa("Frente Fictícia de Integração", [projetoA, projetoC], { tipo: "frente_atuacao", responsavelId: equipe1 }),
      );
      await iniciativas.incluirStakeholderNaIniciativa(tx, { iniciativaId: nova, stakeholderId: instituicaoY, papel: "demandante" });
      await iniciativas.incluirStakeholderNaIniciativa(tx, { iniciativaId: nova, stakeholderId: instituicaoY, papel: "apoiador" });
      await iniciativas.incluirStakeholderNaIniciativa(tx, { iniciativaId: nova, stakeholderId: pessoaX, papel: "decisor" });
      return nova;
    });

    expect((await iniciativas.projetosDaIniciativa(banco, id)).map((p) => p.projetoTemaId).sort()).toEqual([projetoA, projetoC].sort());
    expect(await iniciativas.stakeholdersDaIniciativa(banco, id)).toHaveLength(3);

    const [linha] = (await iniciativas.listarIniciativas(banco, { busca: "integracao" })).filter((i) => i.id === id);
    expect(linha.stakeholders).toBe(2);
    expect(linha.responsavelNome).toBe("Equipe Fictícia Um");
    expect(linha.projetos).toContain("Projeto Fictício A");

    // Filtros: comitê (principal de algum projeto), projeto, stakeholder, situação em curso e responsável.
    const ids = async (filtro: iniciativas.FiltroIniciativas) => (await iniciativas.listarIniciativas(banco, filtro)).map((i) => i.id);
    expect(await ids({ comiteId: comiteInovacao })).toContain(id);
    expect(await ids({ projetoTemaId: projetoB })).not.toContain(id);
    expect(await ids({ stakeholderId: pessoaX })).toContain(id);
    expect(await ids({ situacao: "em_curso" })).toContain(id);
    expect(await ids({ responsavelId: equipe2 })).not.toContain(id);
    // Papéis na ordem da lista (demandante antes de apoiador).
    expect((await iniciativas.iniciativasDoStakeholder(banco, instituicaoY)).find((i) => i.id === id)?.papeis).toEqual([
      "demandante",
      "apoiador",
    ]);
  });

  test("sem projeto ou tema, a iniciativa é recusada pelo banco (Q-24, provisória)", async () => {
    const mensagem = await mensagemDaFalha(
      gravar((tx) =>
        tx.insert(iniciativa).values({ tipo: "demanda", titulo: "Sem contexto", tituloNormalizado: "sem contexto", dataAbertura: hoje }),
      ),
    );
    expect(mensagem).toBe("A iniciativa precisa estar ligada a pelo menos um projeto ou tema.");
  });

  test("retirar um projeto fica no histórico; retirar o último é recusado", async () => {
    const id = await gravar((tx) => iniciativas.criarIniciativa(tx, novaIniciativa("Demanda Fictícia Retirada", [projetoA, projetoB])));
    const [ligacaoA, ligacaoB] = await iniciativas.projetosDaIniciativa(banco, id);

    await gravar((tx) => iniciativas.retirarProjetoDaIniciativa(tx, ligacaoA.id, id));
    expect(await iniciativas.projetosDaIniciativa(banco, id)).toHaveLength(1);
    // A ligação de outra iniciativa não é retirada por engano.
    expect(await gravar((tx) => iniciativas.retirarProjetoDaIniciativa(tx, ligacaoB.id, projetoA))).toBeNull();

    const mensagem = await mensagemDaFalha(gravar((tx) => iniciativas.retirarProjetoDaIniciativa(tx, ligacaoB.id, id)));
    expect(mensagem).toBe("A iniciativa precisa estar ligada a pelo menos um projeto ou tema.");

    const historico = await iniciativas.historicoDaIniciativa(banco, id);
    expect(historico.some((h) => h.tabela === "iniciativa_projeto_tema" && h.operacao === "arquivamento")).toBe(true);
    expect(historico.filter((h) => h.tabela === "iniciativa_projeto_tema" && h.operacao === "inclusao")).toHaveLength(2);
  });

  test("integridade: datas, conclusão datada, ligação repetida, ligação imutável e proibição de excluir", async () => {
    const id = await gravar((tx) => iniciativas.criarIniciativa(tx, novaIniciativa("Demanda Fictícia Regras", [projetoA])));
    const base = novaIniciativa("Demanda Fictícia Regras", [projetoA]);

    expect(await mensagemDaFalha(gravar((tx) => iniciativas.atualizarIniciativa(tx, id, { ...base, situacao: "concluida" })))).toBe(
      "Informe a data de conclusão da iniciativa.",
    );
    expect(await mensagemDaFalha(gravar((tx) => iniciativas.atualizarIniciativa(tx, id, { ...base, dataConclusao: dia(-60) })))).toBe(
      "As datas de previsão e de conclusão não podem ser anteriores à abertura.",
    );
    expect(await mensagemDaFalha(gravar((tx) => iniciativas.incluirProjetoNaIniciativa(tx, id, projetoA)))).toBe(
      "Este projeto ou tema já está ligado à iniciativa.",
    );
    await gravar((tx) => iniciativas.incluirStakeholderNaIniciativa(tx, { iniciativaId: id, stakeholderId: pessoaX, papel: "afetado" }));
    expect(
      await mensagemDaFalha(
        gravar((tx) => iniciativas.incluirStakeholderNaIniciativa(tx, { iniciativaId: id, stakeholderId: pessoaX, papel: "afetado" })),
      ),
    ).toBe("Este stakeholder já está na iniciativa com este papel.");

    const [ligacao] = await iniciativas.projetosDaIniciativa(banco, id);
    expect(
      await mensagemDaFalha(
        gravar((tx) => tx.update(iniciativaProjetoTema).set({ projetoTemaId: projetoB }).where(eq(iniciativaProjetoTema.id, ligacao.id))),
      ),
    ).toBe("Esta ligação não pode ser alterada; retire-a e inclua uma nova.");
    expect(await mensagemDaFalha(gravar((tx) => tx.delete(iniciativa).where(eq(iniciativa.id, id))))).toMatch(/arquiv/i);

    await gravar((tx) => iniciativas.atualizarIniciativa(tx, id, { ...base, situacao: "concluida", dataConclusao: hoje }));
    const historico = await iniciativas.historicoDaIniciativa(banco, id);
    expect(historico.filter((h) => h.tabela === "iniciativa").map((h) => h.operacao)).toEqual(["alteracao", "inclusao"]);
    expect(historico.every((h) => h.usuarioNome === "Administrador (desenvolvimento)")).toBe(true);
  });
});

describe("Interações", () => {
  test("uma reunião é registrada uma única vez e contribui para várias iniciativas (RF-42, RF-43)", async () => {
    const [i1, i2] = await gravar(async (tx) => [
      await iniciativas.criarIniciativa(tx, novaIniciativa("Reunião Relevante Fictícia", [projetoA], { tipo: "reuniao_relevante" })),
      await iniciativas.criarIniciativa(tx, novaIniciativa("Demanda Fictícia Paralela", [projetoB])),
    ]);
    const antes = (await banco.select({ total: sql<number>`count(*)::int` }).from(interacao))[0].total;
    const id = await gravar((tx) =>
      interacoes.criarInteracao(
        tx,
        novaInteracao("Reunião fictícia com investidores", {
          projetos: [projetoC],
          iniciativas: [i1, i2],
          participantesExternos: [instituicaoY, pessoaX],
          participantesInternos: [equipe1],
        }),
      ),
    );

    expect((await banco.select({ total: sql<number>`count(*)::int` }).from(interacao))[0].total).toBe(antes + 1);
    expect((await interacoes.interacoesDaIniciativa(banco, i1)).map((r) => r.id)).toEqual([id]);
    expect((await interacoes.interacoesDaIniciativa(banco, i2)).map((r) => r.id)).toEqual([id]);
    const participantes = await interacoes.participantesDaInteracao(banco, id);
    expect(participantes).toHaveLength(3);
    expect(participantes.every((p) => p.presenca === "presente")).toBe(true);
    // Projetos: o direto (C) e os das iniciativas (A e B).
    expect((await interacoes.projetosDeUmaInteracao(banco, id)).sort()).toEqual([projetoA, projetoB, projetoC].sort());
    expect((await interacoes.listarInteracoes(banco, { projetoTemaId: projetoB })).map((r) => r.id)).toContain(id);
    expect((await interacoes.listarInteracoes(banco, { stakeholderId: pessoaX })).map((r) => r.id)).toContain(id);
    expect((await interacoes.interacoesDoStakeholder(banco, instituicaoY)).map((r) => r.id)).toContain(id);
  });

  test("sem projeto, tema ou iniciativa, a interação é recusada; a última ligação não pode ser retirada", async () => {
    expect(await mensagemDaFalha(gravar((tx) => interacoes.criarInteracao(tx, novaInteracao("Reunião fictícia sem contexto"))))).toBe(
      "A interação precisa estar ligada a pelo menos um projeto, tema ou iniciativa.",
    );
    const id = await gravar((tx) => interacoes.criarInteracao(tx, novaInteracao("Ligação fictícia", { tipo: "ligacao", projetos: [projetoA] })));
    const [ligacao] = await interacoes.projetosDaInteracao(banco, id);
    expect(await mensagemDaFalha(gravar((tx) => interacoes.retirarProjetoDaInteracao(tx, ligacao.id, id)))).toBe(
      "A interação precisa estar ligada a pelo menos um projeto, tema ou iniciativa.",
    );
    const inic = await gravar((tx) => iniciativas.criarIniciativa(tx, novaIniciativa("Demanda Fictícia Vinculada", [projetoB])));
    await gravar((tx) => interacoes.incluirIniciativaNaInteracao(tx, { interacaoId: id, iniciativaId: inic, contribuicao: "Exemplo." }));
    await gravar((tx) => interacoes.retirarProjetoDaInteracao(tx, ligacao.id, id));
    expect(await interacoes.projetosDaInteracao(banco, id)).toHaveLength(0);
  });

  test("alerta de possível reunião repetida: mesmo assunto em data próxima; origem externa nunca entra duas vezes", async () => {
    await gravar((tx) => interacoes.criarInteracao(tx, novaInteracao("Rodada Fictícia de Investimentos", { projetos: [projetoA] })));
    const repetidas = await interacoes.possiveisDuplicidadesInteracao(banco, { assunto: "rodada ficticia de investimentos", inicio: `${dia(-1)}T09:00` });
    expect(repetidas.map((r) => r.motivo)).toContain("Mesmo assunto, em data próxima");
    expect(await interacoes.possiveisDuplicidadesInteracao(banco, { assunto: "Rodada Fictícia de Investimentos", inicio: `${dia(10)}T09:00` })).toHaveLength(0);
    expect(await interacoes.possiveisDuplicidadesInteracao(banco, { assunto: "Outro assunto qualquer", inicio: `${dia(-2)}T10:00` })).toHaveLength(0);

    const deCalendario = (tx: Transacao) =>
      tx.insert(interacao).values({
        tipo: "reuniao_virtual",
        assunto: "Evento importado (exemplo)",
        assuntoNormalizado: "evento importado exemplo",
        inicio: new Date(),
        origemSistema: "calendario-exemplo",
        origemId: "evento-123",
      });
    await gravar(async (tx) => {
      const [nova] = await deCalendario(tx).returning({ id: interacao.id });
      await interacoes.incluirProjetoNaInteracao(tx, nova.id, projetoA);
    });
    expect(await mensagemDaFalha(gravar((tx) => deCalendario(tx)))).toBe("Esta reunião já foi registrada a partir do calendário de origem.");
  });

  test("participantes: externo ou interno (nunca os dois), sem repetição; presença ajustável; período coerente", async () => {
    const id = await gravar((tx) =>
      interacoes.criarInteracao(tx, novaInteracao("Visita fictícia", { tipo: "visita", situacao: "agendada", inicio: `${dia(5)}T15:00`, projetos: [projetoA], participantesExternos: [instituicaoZ] })),
    );
    const [convidado] = await interacoes.participantesDaInteracao(banco, id);
    expect(convidado.presenca).toBe("convidado");
    await gravar((tx) => interacoes.alterarPresenca(tx, convidado.id, id, "ausente"));
    expect((await interacoes.participantesDaInteracao(banco, id))[0].presenca).toBe("ausente");

    expect(
      await mensagemDaFalha(
        gravar((tx) => interacoes.incluirParticipante(tx, { interacaoId: id, participante: { tipo: "stakeholder", id: instituicaoZ }, presenca: "presente" })),
      ),
    ).toBe("Este participante já está na interação.");
    expect(
      await mensagemDaFalha(
        gravar((tx) => tx.insert(interacaoParticipante).values({ interacaoId: id, stakeholderId: pessoaX, usuarioId: equipe1 })),
      ),
    ).toBe("Indique um participante externo ou da equipe, não os dois.");
    expect(
      await mensagemDaFalha(
        gravar((tx) =>
          interacoes.atualizarInteracao(tx, id, { tipo: "visita", assunto: "Visita fictícia", inicio: `${dia(5)}T15:00`, fim: `${dia(5)}T14:00`, situacao: "agendada" }),
        ),
      ),
    ).toBe("O término não pode ser anterior ao início.");

    // Agenda: interações a partir de hoje, em ordem cronológica.
    const agenda = await interacoes.listarInteracoes(banco, { periodo: "futuras" }, "todos", hoje);
    expect(agenda.map((r) => r.id)).toContain(id);
    expect((await interacoes.listarInteracoes(banco, { periodo: "passadas" }, "todos", hoje)).map((r) => r.id)).not.toContain(id);
  });
});

describe("Compromissos", () => {
  test("encaminhamentos de uma reunião, com responsáveis, prazos vencidos e acompanhamento preservado (RF-41, RF-44)", async () => {
    const inic = await gravar((tx) => iniciativas.criarIniciativa(tx, novaIniciativa("Frente Fictícia de Compromissos", [projetoB])));
    const reuniao = await gravar((tx) =>
      interacoes.criarInteracao(tx, novaInteracao("Reunião fictícia de encaminhamentos", { iniciativas: [inic] })),
    );
    const [vencido, futuro, externo] = await gravar(async (tx) => [
      await interacoes.criarCompromisso(tx, { descricao: "Enviar nota técnica fictícia", interacaoId: reuniao, responsavelUsuarioId: equipe1, prazo: dia(-3) }),
      await interacoes.criarCompromisso(tx, { descricao: "Agendar visita fictícia", interacaoId: reuniao, responsavelUsuarioId: equipe2, prazo: dia(7) }),
      await interacoes.criarCompromisso(tx, { descricao: "Retorno da instituição fictícia", iniciativaId: inic, responsavelStakeholderId: instituicaoY, prazo: dia(-1) }),
    ]);

    const ids = async (filtro: interacoes.FiltroCompromissos) => (await interacoes.listarCompromissos(banco, filtro, hoje)).map((c) => c.id);
    expect(await ids({ prazo: "vencidos" })).toEqual(expect.arrayContaining([vencido, externo]));
    expect(await ids({ prazo: "vencidos" })).not.toContain(futuro);
    expect(await ids({ responsavel: `u:${equipe2}` })).toEqual([futuro]);
    expect(await ids({ responsavel: `s:${instituicaoY}` })).toEqual([externo]);
    // Projeto do compromisso: o da iniciativa à qual a reunião contribuiu.
    expect((await ids({ projetoTemaId: projetoB })).sort()).toEqual([vencido, futuro, externo].sort());
    expect(await ids({ projetoTemaId: projetoA })).toEqual([]);
    // Os compromissos da iniciativa incluem os gerados pelas suas reuniões.
    expect((await interacoes.compromissosDaIniciativa(banco, inic)).map((c) => c.id).sort()).toEqual([vencido, futuro, externo].sort());

    const obtido = await interacoes.obterCompromisso(banco, externo);
    expect(obtido?.responsavelStakeholderNome).toBe("Instituição Fictícia Y");
    expect(situacaoDoPrazo({ situacao: "aberto", prazo: dia(-1) }, hoje)).toBe("vencido");

    // Acompanhamento: conclui (com a data) e o compromisso deixa de estar vencido.
    await gravar((tx) => interacoes.registrarAcompanhamento(tx, { compromissoId: vencido, data: hoje, registro: "Nota enviada (exemplo).", situacao: "concluido" }));
    const [concluido] = await banco.select().from(compromisso).where(eq(compromisso.id, vencido));
    expect(concluido).toMatchObject({ situacao: "concluido", concluidoEm: hoje });
    expect(await ids({ prazo: "vencidos" })).not.toContain(vencido);
    expect(await ids({ prazo: "concluidos" })).toContain(vencido);
    expect(situacaoDoPrazo({ situacao: "concluido", prazo: dia(-3) }, hoje)).toBe("encerrado");

    // Reaberto: perde a data de conclusão; o histórico de acompanhamento é preservado.
    await gravar((tx) => interacoes.registrarAcompanhamento(tx, { compromissoId: vencido, data: hoje, registro: "Reaberto (exemplo).", situacao: "em_andamento" }));
    const [reaberto] = await banco.select().from(compromisso).where(eq(compromisso.id, vencido));
    expect(reaberto).toMatchObject({ situacao: "em_andamento", concluidoEm: null });
    const acompanhamentos = await interacoes.acompanhamentosDoCompromisso(banco, vencido);
    expect(acompanhamentos).toHaveLength(2);

    const [primeiro] = await banco.select().from(compromissoAcompanhamento).where(eq(compromissoAcompanhamento.compromissoId, vencido)).limit(1);
    expect(
      await mensagemDaFalha(
        gravar((tx) => tx.update(compromissoAcompanhamento).set({ registro: "Alterado" }).where(eq(compromissoAcompanhamento.id, primeiro.id))),
      ),
    ).toBe("Os registros de acompanhamento não são alterados; registre um novo acompanhamento.");

    const historico = await interacoes.historicoDoCompromisso(banco, vencido);
    expect(historico.filter((h) => h.tabela === "compromisso_acompanhamento")).toHaveLength(2);
    expect(historico.filter((h) => h.tabela === "compromisso" && h.operacao === "alteracao")).toHaveLength(2);
  });

  test("compromisso com iniciativa indicada pertence só a ela; sem iniciativa, vale para todas as da reunião", async () => {
    const [a, b] = await gravar(async (tx) => [
      await iniciativas.criarIniciativa(tx, novaIniciativa("Demanda Fictícia Primeira", [projetoA])),
      await iniciativas.criarIniciativa(tx, novaIniciativa("Demanda Fictícia Segunda", [projetoA])),
    ]);
    const reuniao = await gravar((tx) => interacoes.criarInteracao(tx, novaInteracao("Reunião fictícia de duas demandas", { iniciativas: [a, b] })));
    const [deB, geral] = await gravar(async (tx) => [
      await interacoes.criarCompromisso(tx, { descricao: "Só da segunda", interacaoId: reuniao, iniciativaId: b, responsavelUsuarioId: equipe1 }),
      await interacoes.criarCompromisso(tx, { descricao: "Da reunião", interacaoId: reuniao, responsavelUsuarioId: equipe2 }),
    ]);
    expect((await interacoes.compromissosDaIniciativa(banco, a)).map((c) => c.id)).toEqual([geral]);
    expect((await interacoes.compromissosDaIniciativa(banco, b)).map((c) => c.id).sort()).toEqual([deB, geral].sort());
    const pendentes = Object.fromEntries((await iniciativas.listarIniciativas(banco, { busca: "demanda ficticia" })).map((i) => [i.id, i.compromissosPendentes]));
    expect(pendentes[a]).toBe(1);
    expect(pendentes[b]).toBe(2);
    expect((await interacoes.listarCompromissos(banco, { iniciativaId: a }, hoje)).map((c) => c.id)).toEqual([geral]);
  });

  test("integridade: origem, responsável e conclusão datada são exigidos pelo banco", async () => {
    const reuniao = await gravar((tx) => interacoes.criarInteracao(tx, novaInteracao("Reunião fictícia de regras", { projetos: [projetoA] })));
    expect(await mensagemDaFalha(gravar((tx) => interacoes.criarCompromisso(tx, { descricao: "Sem origem", responsavelUsuarioId: equipe1 })))).toBe(
      "Ligue o compromisso a uma interação ou a uma iniciativa.",
    );
    expect(await mensagemDaFalha(gravar((tx) => interacoes.criarCompromisso(tx, { descricao: "Sem responsável", interacaoId: reuniao })))).toBe(
      "Indique o responsável pelo compromisso.",
    );
    const id = await gravar((tx) => interacoes.criarCompromisso(tx, { descricao: "Com regras", interacaoId: reuniao, responsavelUsuarioId: equipe1 }));
    expect(await mensagemDaFalha(gravar((tx) => tx.update(compromisso).set({ situacao: "concluido" }).where(eq(compromisso.id, id))))).toBe(
      "Informe a data de conclusão do compromisso.",
    );
  });
});

describe("Visibilidade por projeto ou tema", () => {
  test("usuário com permissão só no projeto A vê apenas o que está ligado a A; leitor não altera", async () => {
    const [colaborador, leitor] = (
      await banco
        .insert(usuario)
        .values([
          { nome: "Colaborador Fictício", email: "colaborador-e3@exemplo.invalid" },
          { nome: "Leitor Fictício", email: "leitor-e3@exemplo.invalid" },
        ])
        .returning({ id: usuario.id })
    ).map((u) => u.id);
    await gravar((tx) =>
      tx.insert(permissaoContexto).values([
        { usuarioId: colaborador, projetoTemaId: projetoA, perfil: "colaborador" },
        { usuarioId: leitor, projetoTemaId: projetoA, perfil: "leitor" },
      ]),
    );
    const deA = await gravar((tx) => iniciativas.criarIniciativa(tx, novaIniciativa("Demanda Fictícia Visível", [projetoA])));
    const deC = await gravar((tx) => iniciativas.criarIniciativa(tx, novaIniciativa("Demanda Fictícia Oculta", [projetoC])));
    const reuniaoC = await gravar((tx) => interacoes.criarInteracao(tx, novaInteracao("Reunião fictícia oculta", { iniciativas: [deC] })));
    const compromissoC = await gravar((tx) => interacoes.criarCompromisso(tx, { descricao: "Oculto", interacaoId: reuniaoC, responsavelUsuarioId: equipe1 }));

    const visiveis = await projetosVisiveis(banco, colaborador);
    expect(visiveis).toEqual([projetoA]);
    const listadas = (await iniciativas.listarIniciativas(banco, {}, visiveis)).map((i) => i.id);
    expect(listadas).toContain(deA);
    expect(listadas).not.toContain(deC);
    expect((await interacoes.listarInteracoes(banco, {}, visiveis)).map((i) => i.id)).not.toContain(reuniaoC);
    expect((await interacoes.listarCompromissos(banco, { prazo: "todos" }, hoje, visiveis)).map((c) => c.id)).not.toContain(compromissoC);
    expect(await interacoes.compromissoEhVisivel(banco, compromissoC, visiveis)).toBe(false);
    expect(await iniciativas.iniciativaEhVisivel(banco, deA, visiveis)).toBe(true);

    expect(await podeEditarEmAlgum(banco, colaborador, [projetoA])).toBe(true);
    expect(await podeEditarEmAlgum(banco, leitor, [projetoA])).toBe(false);
    expect(await podeEditarEmAlgum(banco, colaborador, [projetoC])).toBe(false);
    expect(await projetosVisiveis(banco, usuarioId)).toBe("todos");
  });
});

describe("Auditoria das novas tabelas", () => {
  test("toda inclusão registra o responsável na trilha de auditoria", async () => {
    const id = await gravar((tx) => iniciativas.criarIniciativa(tx, novaIniciativa("Demanda Fictícia Auditada", [projetoA])));
    const registros = await banco
      .select()
      .from(registroAuditoria)
      .where(and(eq(registroAuditoria.tabela, "iniciativa"), eq(registroAuditoria.registroId, id)));
    expect(registros).toHaveLength(1);
    expect(registros[0].usuarioId).toBe(usuarioId);
  });
});
