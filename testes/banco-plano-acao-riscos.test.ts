// @vitest-environment node
/**
 * Regras da Etapa 4 — Plano de Ação e Matriz de Riscos — verificadas em um
 * banco PGlite real, criado na memória com os mesmos scripts usados pela
 * aplicação: versionamento e aprovação do plano, marcos e acompanhamento,
 * classificação da matriz 5 × 5, distinção entre risco inerente e residual,
 * gatilhos, respostas, integrações e histórico. Somente dados fictícios.
 */
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, type Transacao } from "@/lib/banco/conexao";
import {
  acao,
  acaoAcompanhamento,
  comite,
  compromisso,
  planoAcaoVersao,
  risco,
  riscoAvaliacao,
  usuario,
} from "@/lib/banco/esquema";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import * as iniciativas from "@/modulos/iniciativas/consultas";
import * as interacoes from "@/modulos/interacoes/consultas";
import * as planos from "@/modulos/plano-acao/consultas";
import { diferencasEntreVersoes } from "@/modulos/plano-acao/diferencas";
import type { DadosAcaoPlanejada } from "@/modulos/plano-acao/esquemas";
import * as projetos from "@/modulos/projetos-temas/consultas";
import { compararInerenteResidual } from "@/modulos/riscos/analise";
import * as riscos from "@/modulos/riscos/consultas";
import type { DadosNovoRisco } from "@/modulos/riscos/esquemas";
import { classificar, criticidade, NIVEIS_5 } from "@/modulos/riscos/rotulos";
import * as stakeholders from "@/modulos/stakeholders/consultas";

let banco: Banco;
let usuarioId: string;
let comiteInfra: string;
let projetoA: string;
let projetoB: string;
let pessoaX: string;
let instituicaoY: string;
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
    pessoaX = await stakeholders.criarPessoa(tx, { nomeCompleto: "Pessoa Fictícia X" });
    instituicaoY = await stakeholders.criarInstituicao(tx, { nome: "Instituição Fictícia Y", natureza: "empresa" });
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
    return erro instanceof planos.ErroDoPlano ? erro.message : mensagemDeErro(erro);
  }
  throw new Error("A operação deveria ter falhado.");
}

function novaAcao(versaoId: string, titulo: string, extra: Partial<DadosAcaoPlanejada> = {}): DadosAcaoPlanejada {
  return { versaoId, titulo, responsavelUsuarioId: equipe1, ...extra };
}

function novoRisco(projetoTemaId: string, titulo: string, p: number, i: number, extra: Partial<DadosNovoRisco> = {}): DadosNovoRisco {
  return {
    projetoTemaId,
    titulo,
    situacao: "aberto",
    dataAvaliacao: dia(-20),
    probabilidade: p,
    impacto: i,
    justificativa: "Avaliação fictícia para teste.",
    avaliadoPor: equipe1,
    ...extra,
  };
}

/** Cria um plano do projeto informado com uma versão aprovada contendo as ações indicadas. */
async function planoAprovado(projetoTemaId: string, titulos: string[]) {
  const planoId = await gravar((tx) => planos.criarPlano(tx, { projetoTemaId, titulo: "Plano fictício", usarPilaresReferencia: false }));
  const v1 = (await planos.versaoEmElaboracao(banco, planoId))!.id;
  const acoes: string[] = [];
  await gravar(async (tx) => {
    for (const t of titulos) acoes.push(await planos.incluirAcaoNaVersao(tx, novaAcao(v1, t, { fimPrevisto: dia(30) })));
    await planos.enviarParaAprovacao(tx, v1, undefined);
    await planos.decidirVersao(tx, v1, "aprovada", undefined);
  });
  return { planoId, v1, acoes };
}

describe("Plano de Ação: estrutura e versões", () => {
  let planoId: string;
  let v1: string;
  let v2: string;
  let acaoA01: string;
  let acaoA02: string;

  test("um plano por projeto ou tema, com os pilares de referência opcionais e a versão 1 em rascunho (D-072, D2 e 2.1)", async () => {
    planoId = await gravar((tx) =>
      planos.criarPlano(tx, { projetoTemaId: projetoA, titulo: "Plano Fictício do Projeto A", usarPilaresReferencia: true }),
    );
    const eixos = await planos.eixosDoPlano(banco, planoId);
    expect(eixos.map((e) => e.codigo)).toEqual(["P1", "P2", "P3", "P4", "P5"]);
    expect(eixos[4].nome).toBe("Comunicação / Transparência / Licença Social");
    const versoes = await planos.listarVersoes(banco, planoId);
    expect(versoes).toHaveLength(1);
    expect(versoes[0]).toMatchObject({ numeroVersao: 1, situacao: "rascunho" });
    v1 = versoes[0].id;

    // Eixo próprio do projeto, além dos de referência.
    await gravar((tx) => planos.criarEixo(tx, { planoAcaoId: planoId, nome: "Eixo Fictício Próprio" }));
    expect((await planos.eixosDoPlano(banco, planoId)).at(-1)?.codigo).toBe("P6");

    expect(
      await mensagemDaFalha(gravar((tx) => planos.criarPlano(tx, { projetoTemaId: projetoA, titulo: "Outro", usarPilaresReferencia: false }))),
    ).toBe("Este projeto ou tema já tem um plano de ação.");

    // Plano sem pilares de referência: os eixos são do próprio projeto.
    const outro = await gravar((tx) => planos.criarPlano(tx, { projetoTemaId: projetoB, titulo: "Plano B", usarPilaresReferencia: false }));
    expect(await planos.eixosDoPlano(banco, outro)).toHaveLength(0);
  });

  test("fluxo de aprovação: envio, devolução para ajustes, aprovação com parecer, quem decidiu e quando (D-072, 2.3 e D3)", async () => {
    expect(await mensagemDaFalha(gravar((tx) => planos.enviarParaAprovacao(tx, v1, undefined)))).toBe(
      "Inclua pelo menos uma ação antes de enviar a versão para aprovação.",
    );
    const [p1] = await planos.eixosDoPlano(banco, planoId);
    await gravar(async (tx) => {
      acaoA01 = await planos.incluirAcaoNaVersao(tx, novaAcao(v1, "Ação fictícia de articulação", { eixoId: p1.id, fimPrevisto: dia(-5) }));
      await planos.incluirMarco(tx, { versaoId: v1, acaoId: acaoA01, descricao: "Reunião fictícia realizada", prazoPrevisto: dia(-10) });
      await planos.incluirMarco(tx, { versaoId: v1, acaoId: acaoA01, descricao: "Relatório fictício entregue", prazoPrevisto: dia(-5) });
    });
    const planejadas = await planos.planejamentoDaVersao(banco, v1);
    expect(planejadas.map((a) => a.codigo)).toEqual(["A-01"]);
    expect(planejadas[0].marcos.map((m) => m.codigo)).toEqual(["M1", "M2"]);

    // Envio da versão 1 não exige motivo.
    await gravar((tx) => planos.enviarParaAprovacao(tx, v1, undefined));
    expect((await planos.obterVersao(banco, v1))?.situacao).toBe("em_aprovacao");
    expect(
      await mensagemDaFalha(gravar((tx) => planos.incluirAcaoNaVersao(tx, novaAcao(v1, "Ação durante a aprovação")))),
    ).toBe("Só a versão em rascunho pode ser alterada; para mudar o planejamento, crie uma nova versão.");

    // Devolvida para ajustes: volta a rascunho e pode ser alterada.
    await gravar((tx) => planos.decidirVersao(tx, v1, "devolvida", "Detalhar o marco final."));
    expect((await planos.obterVersao(banco, v1))?.situacao).toBe("rascunho");
    const m2 = (await planos.planejamentoDaVersao(banco, v1))[0].marcos[1];
    await gravar((tx) => planos.atualizarMarcoPlanejado(tx, m2.id, { descricao: "Relatório fictício entregue e validado", prazoPrevisto: dia(-5) }));

    await gravar(async (tx) => {
      await planos.enviarParaAprovacao(tx, v1, undefined);
      await planos.decidirVersao(tx, v1, "aprovada", "Parecer fictício favorável.");
    });
    const aprovada = await planos.obterVersao(banco, v1);
    expect(aprovada).toMatchObject({ situacao: "aprovada", decididaPor: usuarioId, parecer: "Parecer fictício favorável." });
    expect(aprovada?.decididaEm).toBeTruthy();
    expect(aprovada?.propostaPor).toBe(usuarioId);

    const decisoes = (await planos.decisoesDoPlano(banco, planoId)).map((d) => d.decisao).reverse();
    expect(decisoes).toEqual(["enviada", "devolvida", "enviada", "aprovada"]);
  });

  test("versão aprovada não muda: alterar o planejamento exige nova versão", async () => {
    const [planejada] = await planos.planejamentoDaVersao(banco, v1);
    expect(
      await mensagemDaFalha(gravar((tx) => planos.atualizarAcaoPlanejada(tx, planejada.id, { titulo: "Outro título", responsavelUsuarioId: equipe1 }))),
    ).toBe("Só a versão em rascunho pode ser alterada; para mudar o planejamento, crie uma nova versão.");
    expect(
      await mensagemDaFalha(gravar((tx) => tx.update(planoAcaoVersao).set({ parecer: "Mudança indevida" }).where(eq(planoAcaoVersao.id, v1)))),
    ).toBe("Versões decididas não podem ser alteradas; para mudar o plano, crie uma nova versão.");
    expect(await mensagemDaFalha(gravar((tx) => tx.update(acao).set({ codigo: "A-99" }).where(eq(acao.id, acaoA01))))).toMatch(
      /não pode mudar de codigo/,
    );
    expect(await mensagemDaFalha(gravar((tx) => tx.delete(acao).where(eq(acao.id, acaoA01))))).toMatch(/não podem ser excluídos|arquiv/i);
  });

  test("nova versão copia a vigente, mantém os códigos e, aprovada, substitui a anterior, que fica preservada", async () => {
    v2 = await gravar((tx) => planos.criarNovaVersao(tx, planoId));
    expect(await mensagemDaFalha(gravar((tx) => planos.criarNovaVersao(tx, planoId)))).toBe(
      "Já existe uma versão em elaboração ou em aprovação deste plano.",
    );
    const copia = await planos.planejamentoDaVersao(banco, v2);
    expect(copia.map((a) => [a.codigo, a.marcos.map((m) => m.codigo)])).toEqual([["A-01", ["M1", "M2"]]]);

    // Mudanças estruturais: novo prazo da A-01, retirada do M2 e inclusão da A-02 com responsável externo.
    await gravar(async (tx) => {
      const a01 = copia[0];
      await planos.atualizarAcaoPlanejada(tx, a01.id, {
        titulo: a01.titulo,
        eixoId: a01.eixoId ?? undefined,
        responsavelUsuarioId: equipe2,
        fimPrevisto: dia(20),
      });
      await planos.retirarMarcoDaVersao(tx, a01.marcos[1].id);
      acaoA02 = await planos.incluirAcaoNaVersao(tx, novaAcao(v2, "Ação fictícia de comunicação", { responsavelUsuarioId: undefined, responsavelStakeholderId: instituicaoY, fimPrevisto: dia(60) }));
    });

    expect(await mensagemDaFalha(gravar((tx) => planos.enviarParaAprovacao(tx, v2, undefined)))).toBe(
      "Informe o motivo da alteração antes de enviar a nova versão para aprovação.",
    );
    await gravar((tx) => planos.enviarParaAprovacao(tx, v2, "Repactuação fictícia de prazos."));

    // A comparação mostra o que muda em relação à vigente.
    const diferencas = diferencasEntreVersoes(await planos.planejamentoDaVersao(banco, v1), await planos.planejamentoDaVersao(banco, v2));
    expect(diferencas.map((d) => [d.tipo, d.codigo])).toEqual([
      ["alterada", "A-01"],
      ["incluida", "A-02"],
    ]);
    const alteracoes = diferencas[0].tipo === "alterada" ? diferencas[0].alteracoes.map((a) => a.campo) : [];
    expect(alteracoes).toEqual(["Responsável", "Fim previsto", "Marco M2 retirado"]);

    await gravar((tx) => planos.decidirVersao(tx, v2, "aprovada", undefined));
    const versoes = await planos.listarVersoes(banco, planoId);
    expect(versoes.map((v) => [v.numeroVersao, v.situacao])).toEqual([
      [2, "aprovada"],
      [1, "substituida"],
    ]);
    // A versão anterior continua com o planejamento original.
    const original = await planos.planejamentoDaVersao(banco, v1);
    expect(original[0].fimPrevisto).toBe(dia(-5));
    expect(original[0].marcos).toHaveLength(2);
    expect((await planos.versaoVigente(banco, planoId))?.id).toBe(v2);
  });

  test("versão rejeitada fica registrada e a vigente continua valendo", async () => {
    const v3 = await gravar((tx) => planos.criarNovaVersao(tx, planoId));
    await gravar(async (tx) => {
      await planos.incluirAcaoNaVersao(tx, novaAcao(v3, "Ação fictícia não aprovada"));
      await planos.enviarParaAprovacao(tx, v3, "Inclusão fictícia.");
      await planos.decidirVersao(tx, v3, "rejeitada", "Fora do escopo fictício.");
    });
    expect((await planos.obterVersao(banco, v3))?.situacao).toBe("rejeitada");
    expect((await planos.versaoVigente(banco, planoId))?.id).toBe(v2);
    // Um rascunho pode ser descartado; o histórico é preservado.
    const v4 = await gravar((tx) => planos.criarNovaVersao(tx, planoId));
    await gravar((tx) => planos.descartarRascunho(tx, v4));
    expect(await planos.versaoEmElaboracao(banco, planoId)).toBeNull();
    expect((await planos.listarVersoes(banco, planoId)).map((v) => v.numeroVersao)).toEqual([4, 3, 2, 1]);
  });

  test("acompanhamento sem aprovação: situação, percentual opcional, marcos alcançados e atraso (D-072, 2.2)", async () => {
    const vigente = await planos.acoesVigentes(banco, planoId, hoje);
    const a01 = vigente.acoes.find((a) => a.codigo === "A-01")!;
    const a02 = vigente.acoes.find((a) => a.codigo === "A-02")!;
    expect(a01.atrasada).toBe(false); // prazo repactuado para daqui a 20 dias
    expect(a02.andamento.situacao).toBeNull();

    await gravar(async (tx) => {
      await planos.registrarAcompanhamento(tx, { acaoId: acaoA01, data: dia(-3), situacao: "em_andamento", percentual: 40 });
      await planos.registrarAcompanhamento(tx, { acaoId: acaoA01, data: dia(-2), marcoId: a01.marcos[0].marcoId, marcoAlcancado: true });
      // O percentual é complementar: só a observação também é um acompanhamento válido.
      await planos.registrarAcompanhamento(tx, { acaoId: acaoA02, data: dia(-1), observacao: "Contato fictício iniciado." });
    });
    const depois = await planos.acoesVigentes(banco, planoId, hoje);
    const novo = depois.acoes.find((a) => a.codigo === "A-01")!;
    expect(novo.andamento).toMatchObject({ situacao: "em_andamento", percentual: 40 });
    expect(novo.marcos[0].alcancadoEm).toBe(dia(-2));

    // Registros de acompanhamento não são alterados.
    const [registro] = await banco.select().from(acaoAcompanhamento).where(eq(acaoAcompanhamento.acaoId, acaoA01)).limit(1);
    expect(
      await mensagemDaFalha(gravar((tx) => tx.update(acaoAcompanhamento).set({ percentual: 90 }).where(eq(acaoAcompanhamento.id, registro.id)))),
    ).toBe("Os registros de histórico não são alterados; registre um novo.");

    // Ação fora da versão vigente não recebe acompanhamento.
    const rejeitada = (await banco.select({ id: acao.id }).from(acao).where(eq(acao.codigo, "A-03")))[0].id;
    expect(await mensagemDaFalha(gravar((tx) => planos.registrarAcompanhamento(tx, { acaoId: rejeitada, data: hoje, observacao: "x" })))).toBe(
      "O acompanhamento é registrado nas ações da versão vigente (aprovada) do plano.",
    );
    // Marco de outra ação também não.
    expect(
      await mensagemDaFalha(gravar((tx) => planos.registrarAcompanhamento(tx, { acaoId: acaoA02, data: hoje, marcoId: a01.marcos[0].marcoId, marcoAlcancado: true }))),
    ).toBe("O marco deve ser da mesma ação.");

    // Atraso: prazo vencido e não concluída; ao concluir, deixa de estar atrasada.
    const temaAtraso = await gravar((tx) =>
      projetos.criarProjetoTema(tx, { tipo: "tema", nome: "Tema Fictício de Atraso", comiteId: comiteInfra, situacao: "ativo" }),
    );
    const { planoId: outroPlano, acoes } = await planoAprovado(temaAtraso, ["Ação fictícia vencida"]);
    const versaoNova = await gravar((tx) => planos.criarNovaVersao(tx, outroPlano));
    const [planejada] = await planos.planejamentoDaVersao(banco, versaoNova);
    await gravar(async (tx) => {
      await planos.atualizarAcaoPlanejada(tx, planejada.id, { titulo: planejada.titulo, responsavelUsuarioId: equipe1, fimPrevisto: dia(-1) });
      await planos.enviarParaAprovacao(tx, versaoNova, "Prazo fictício antecipado.");
      await planos.decidirVersao(tx, versaoNova, "aprovada", undefined);
    });
    expect((await planos.acoesVigentes(banco, outroPlano, hoje)).acoes[0].atrasada).toBe(true);
    await gravar((tx) => planos.registrarAcompanhamento(tx, { acaoId: acoes[0], data: hoje, situacao: "concluida" }));
    expect((await planos.acoesVigentes(banco, outroPlano, hoje)).acoes[0].atrasada).toBe(false);
  });

  test("histórico da ação e do plano, e visibilidade por projeto ou tema", async () => {
    const historico = await planos.historicoDaAcao(banco, acaoA01);
    const tabelas = new Set(historico.map((h) => h.tabela));
    for (const t of ["acao", "acao_planejamento", "acao_marco", "marco_planejamento", "acao_acompanhamento"]) expect(tabelas).toContain(t);
    expect((await planos.historicoDoPlano(banco, planoId)).some((h) => h.tabela === "plano_acao_versao")).toBe(true);

    expect(await planos.listarPlanos(banco, hoje, [])).toHaveLength(0);
    const doA = await planos.listarPlanos(banco, hoje, [projetoA]);
    expect(doA.map((p) => p.id)).toEqual([planoId]);
    expect(doA[0]).toMatchObject({ versaoVigente: 2, acoes: 2, marcosPrevistos: 1, marcosAlcancados: 1 });
  });
});

describe("Matriz de Riscos 5 × 5", () => {
  test("criticidade = probabilidade × impacto e classificação pelas faixas da matriz original, iguais no banco e na tela", async () => {
    const id = await gravar((tx) => riscos.criarRisco(tx, novoRisco(projetoB, "Risco fictício de calibração", 1, 1)));
    await gravar(async (tx) => {
      for (const p of NIVEIS_5)
        for (const i of NIVEIS_5)
          await riscos.registrarAvaliacao(tx, { riscoId: id, tipo: "residual", dataAvaliacao: hoje, probabilidade: p, impacto: i, justificativa: "Calibração fictícia.", avaliadoPor: equipe1 });
    });
    const linhas = await banco.select().from(riscoAvaliacao).where(eq(riscoAvaliacao.riscoId, id));
    expect(linhas).toHaveLength(26);
    for (const l of linhas) {
      expect(l.criticidade).toBe(criticidade(l.probabilidade, l.impacto));
      expect(l.classificacao).toBe(classificar(l.criticidade));
    }
    // Pontos das faixas: 4 baixo, 5 moderado, 9 moderado, 10 alto, 16 alto, 20 crítico.
    expect([4, 5, 9, 10, 16, 20, 25].map(classificar)).toEqual(["baixo", "moderado", "moderado", "alto", "alto", "critico", "critico"]);
    expect(
      await mensagemDaFalha(gravar((tx) => riscos.registrarAvaliacao(tx, { riscoId: id, tipo: "inerente", dataAvaliacao: hoje, probabilidade: 6, impacto: 1, justificativa: "x", avaliadoPor: equipe1 }))),
    ).toBe("A probabilidade vai de 1 a 5.");
  });

  test("todo risco nasce com a avaliação inerente; códigos R-01, R-02… por projeto ou tema", async () => {
    expect(
      await mensagemDaFalha(gravar((tx) => tx.insert(risco).values({ projetoTemaId: projetoA, codigo: "R-90", titulo: "Sem avaliação" }))),
    ).toBe("Registre a avaliação do risco inerente (probabilidade, impacto e justificativa).");
    const r1 = await gravar((tx) => riscos.criarRisco(tx, novoRisco(projetoA, "Risco fictício um", 2, 2)));
    const r2 = await gravar((tx) => riscos.criarRisco(tx, novoRisco(projetoA, "Risco fictício dois", 3, 3)));
    expect([(await riscos.obterRisco(banco, r1))?.codigo, (await riscos.obterRisco(banco, r2))?.codigo]).toEqual(["R-01", "R-02"]);
  });

  test("inerente × residual: registrar medida ou gatilho não reduz o risco; só a avaliação residual fundamentada (D-072, 3.1)", async () => {
    const { acoes } = await planoAprovado(
      await gravar((tx) => projetos.criarProjetoTema(tx, { tipo: "projeto", nome: "Projeto Fictício de Riscos", comiteId: comiteInfra, situacao: "ativo" })),
      ["Ação fictícia de mitigação"],
    );
    const projetoRiscos = (await planos.obterAcao(banco, acoes[0]))!.projetoTemaId;
    const id = await gravar((tx) =>
      riscos.criarRisco(tx, novoRisco(projetoRiscos, "Risco fictício de atraso regulatório", 4, 5, { responsavelId: equipe2, proximaRevisao: dia(30) })),
    );
    const situacaoAtual = async () => (await riscos.listarRiscos(banco, { projetoTemaId: projetoRiscos }, hoje)).find((r) => r.id === id)!;

    let atual = await situacaoAtual();
    expect(atual.inerente).toMatchObject({ probabilidade: 4, impacto: 5, criticidade: 20, classificacao: "critico" });
    expect(atual.residual).toBeNull();
    expect(atual.vigente?.criticidade).toBe(20);

    // Medida de resposta planejada, ligada a uma ação existente do plano: nada muda na avaliação.
    await gravar((tx) =>
      riscos.criarResposta(tx, { riscoId: id, estrategia: "mitigar", descricao: "Antecipar reunião técnica fictícia.", situacao: "planejada", responsavelUsuarioId: equipe1, acaoId: acoes[0] }),
    );
    atual = await situacaoAtual();
    expect(atual.residual).toBeNull();
    expect(atual.vigente).toMatchObject({ tipo: "inerente", criticidade: 20, classificacao: "critico" });
    expect((await riscos.riscosDaAcao(banco, acoes[0])).map((r) => r.id)).toEqual([id]);
    expect(await banco.select().from(acao).where(eq(acao.id, acoes[0]))).toHaveLength(1);

    // Gatilho ocorrido: sinaliza reavaliação, sem alterar probabilidade, impacto nem criticidade.
    await gravar(async (tx) => {
      await riscos.criarGatilho(tx, id, "Pedido fictício de complementação de estudos.");
    });
    const [gatilho] = await riscos.gatilhosDoRisco(banco, id);
    await gravar((tx) => riscos.registrarOcorrenciaGatilho(tx, { gatilhoId: gatilho.id, data: dia(-1), ocorrido: true, observacao: "Ocorrência fictícia." }));
    atual = await situacaoAtual();
    expect(atual.gatilhoOcorrido).toBe(true);
    expect(atual.reavaliacao).toContain("Gatilho ocorrido depois da última avaliação.");
    expect(atual.vigente?.criticidade).toBe(20);

    // Avaliação residual fundamentada nos controles efetivamente implementados.
    await gravar((tx) =>
      riscos.registrarAvaliacao(tx, { riscoId: id, tipo: "residual", dataAvaliacao: hoje, probabilidade: 2, impacto: 4, justificativa: "Controle fictício implementado e verificado.", avaliadoPor: equipe2 }),
    );
    atual = await situacaoAtual();
    expect(atual.inerente?.criticidade).toBe(20);
    expect(atual.residual).toMatchObject({ criticidade: 8, classificacao: "moderado" });
    expect(atual.vigente?.tipo).toBe("residual");
    expect(atual.reavaliacao).toEqual([]);
    expect(compararInerenteResidual(atual.inerente, atual.residual)).toEqual({ variacaoIndice: -12, mudouClassificacao: true });

    // Reavaliação do inerente: novo registro; o histórico completo é preservado.
    await gravar((tx) =>
      riscos.registrarAvaliacao(tx, { riscoId: id, tipo: "inerente", dataAvaliacao: hoje, probabilidade: 5, impacto: 5, justificativa: "Cenário fictício agravado.", avaliadoPor: equipe1 }),
    );
    const historico = await riscos.avaliacoesDoRisco(banco, id);
    expect(historico.map((a) => [a.tipo, a.criticidade])).toEqual([
      ["inerente", 25],
      ["residual", 8],
      ["inerente", 20],
    ]);
    expect(historico.at(-1)?.avaliadoPorNome).toBe("Equipe Fictícia Um");

    // Avaliações não são alteradas, e o risco não fica sem avaliação inerente.
    const [avaliacao] = await banco.select().from(riscoAvaliacao).where(eq(riscoAvaliacao.riscoId, id)).limit(1);
    expect(await mensagemDaFalha(gravar((tx) => tx.update(riscoAvaliacao).set({ probabilidade: 1 }).where(eq(riscoAvaliacao.id, avaliacao.id))))).toBe(
      "Os registros de histórico não são alterados; registre um novo.",
    );
    expect(
      await mensagemDaFalha(
        gravar((tx) => tx.update(riscoAvaliacao).set({ arquivadoEm: sql`now()` }).where(sql`${riscoAvaliacao.riscoId} = ${id} and ${riscoAvaliacao.tipo} = 'inerente'`)),
      ),
    ).toBe("Registre a avaliação do risco inerente (probabilidade, impacto e justificativa).");
  });

  test("filtros por projeto, classificação vigente, situação, responsável e gatilho; pilar do mesmo projeto", async () => {
    const id = await gravar((tx) => riscos.criarRisco(tx, novoRisco(projetoB, "Risco fictício escalonado", 5, 4, { situacao: "escalonado", responsavelId: equipe1, proximaRevisao: dia(-1) })));
    const ids = async (filtro: riscos.FiltroRiscos) => (await riscos.listarRiscos(banco, filtro, hoje)).map((r) => r.id);
    expect(await ids({ projetoTemaId: projetoB, classificacao: "critico" })).toContain(id);
    expect(await ids({ projetoTemaId: projetoB, classificacao: "baixo" })).not.toContain(id);
    expect(await ids({ situacao: "escalonado" })).toEqual([id]);
    expect(await ids({ responsavelId: equipe1, projetoTemaId: projetoB })).toEqual([id]);
    expect(await ids({ gatilhoOcorrido: true, projetoTemaId: projetoB })).toEqual([]);
    expect((await riscos.listarRiscos(banco, { projetoTemaId: projetoB }, hoje)).find((r) => r.id === id)?.reavaliacao).toContain(
      "Data de revisão vencida.",
    );
    expect(await ids({ projetoTemaId: projetoA })).not.toContain(id);
    expect(await riscos.listarRiscos(banco, {}, hoje, [])).toHaveLength(0);

    // O pilar ou eixo do risco deve ser do plano do mesmo projeto ou tema.
    const planoA = (await planos.planoDoProjetoTema(banco, projetoA))!;
    const [eixoA] = await planos.eixosDoPlano(banco, planoA);
    expect(await mensagemDaFalha(gravar((tx) => riscos.criarRisco(tx, novoRisco(projetoB, "Risco com pilar alheio", 1, 2, { eixoId: eixoA.id }))))).toBe(
      "O pilar ou eixo deve ser do plano do mesmo projeto ou tema.",
    );
    const comPilar = await gravar((tx) => riscos.criarRisco(tx, novoRisco(projetoA, "Risco com pilar próprio", 1, 2, { eixoId: eixoA.id })));
    expect((await riscos.obterRisco(banco, comPilar))?.eixoCodigo).toBe("P1");

    // Resumo por classificação vigente para a página do projeto.
    const resumo = await riscos.resumoRiscosDoProjetoTema(banco, projetoB, hoje);
    expect(resumo.escalonados).toBe(1);
    expect(resumo.porClassificacao.critico).toBeGreaterThanOrEqual(1);
  });

  test("stakeholders e histórico do risco", async () => {
    const id = await gravar((tx) => riscos.criarRisco(tx, novoRisco(projetoA, "Risco fictício de relacionamento", 3, 4)));
    await gravar(async (tx) => {
      await riscos.incluirStakeholderNoRisco(tx, { riscoId: id, stakeholderId: pessoaX, observacao: "Interlocutor fictício." });
      await riscos.criarResposta(tx, { riscoId: id, estrategia: "transferir", descricao: "Medida fictícia externa.", situacao: "em_execucao", responsavelStakeholderId: instituicaoY });
    });
    expect((await riscos.stakeholdersDoRisco(banco, id)).map((s) => s.nome)).toEqual(["Pessoa Fictícia X"]);
    expect((await riscos.riscosDoStakeholder(banco, instituicaoY)).map((r) => r.id)).toContain(id);
    expect(
      await mensagemDaFalha(gravar((tx) => riscos.incluirStakeholderNoRisco(tx, { riscoId: id, stakeholderId: pessoaX }))),
    ).toBe("Esta pessoa ou instituição já está relacionada ao risco.");
    const tabelas = new Set((await riscos.historicoDoRisco(banco, id)).map((h) => h.tabela));
    for (const t of ["risco", "risco_avaliacao", "risco_resposta", "risco_stakeholder"]) expect(tabelas).toContain(t);
  });
});

describe("Integrações", () => {
  test("compromisso convertido em ação do plano, preservando a origem e sem conversão em duplicidade", async () => {
    const projetoC = await gravar((tx) => projetos.criarProjetoTema(tx, { tipo: "projeto", nome: "Projeto Fictício C", comiteId: comiteInfra, situacao: "ativo" }));
    const { planoId } = await planoAprovado(projetoC, ["Ação fictícia inicial"]);
    const iniciativaId = await gravar((tx) =>
      iniciativas.criarIniciativa(tx, { tipo: "demanda", titulo: "Demanda fictícia", situacao: "registrada", dataAbertura: dia(-10), projetos: [projetoC] }),
    );
    const compromissoId = await gravar((tx) =>
      interacoes.criarCompromisso(tx, { descricao: "Enviar nota técnica fictícia.", iniciativaId, responsavelStakeholderId: pessoaX, prazo: dia(15) }),
    );

    const { acaoId, versaoId } = await gravar((tx) => planos.converterCompromissoEmAcao(tx, compromissoId, planoId, undefined));
    // A conversão cria a versão em rascunho (cópia da vigente) e inclui a ação nela.
    expect((await planos.obterVersao(banco, versaoId))).toMatchObject({ numeroVersao: 2, situacao: "rascunho" });
    const nova = (await planos.planejamentoDaVersao(banco, versaoId)).find((a) => a.acaoId === acaoId)!;
    expect(nova).toMatchObject({
      codigo: "A-02",
      titulo: "Enviar nota técnica fictícia.",
      responsavelStakeholderId: pessoaX,
      fimPrevisto: dia(15),
      iniciativaId,
    });
    const [origem] = await banco.select().from(compromisso).where(eq(compromisso.id, compromissoId));
    expect(origem.acaoId).toBe(acaoId);
    expect((await planos.compromissosDaAcao(banco, acaoId)).map((c) => c.id)).toEqual([compromissoId]);
    expect((await planos.acoesDaIniciativa(banco, iniciativaId)).map((a) => a.id)).toEqual([acaoId]);

    expect(await mensagemDaFalha(gravar((tx) => planos.converterCompromissoEmAcao(tx, compromissoId, planoId, undefined)))).toBe(
      "Este compromisso já foi convertido em ação do plano.",
    );

    // Com versão em aprovação, a conversão espera a decisão.
    await gravar((tx) => planos.enviarParaAprovacao(tx, versaoId, "Inclusão de compromisso fictício."));
    const outro = await gravar((tx) =>
      interacoes.criarCompromisso(tx, { descricao: "Outro compromisso fictício.", iniciativaId, responsavelUsuarioId: equipe1 }),
    );
    expect(await mensagemDaFalha(gravar((tx) => planos.converterCompromissoEmAcao(tx, outro, planoId, undefined)))).toBe(
      "Há uma versão do plano em aprovação: decida sobre ela antes de incluir novas ações.",
    );
    await gravar((tx) => planos.decidirVersao(tx, versaoId, "aprovada", undefined));
    // A pessoa responsável vê a ação vigente na sua ficha.
    expect((await planos.acoesDoStakeholder(banco, pessoaX)).map((a) => a.id)).toContain(acaoId);
  });
});
