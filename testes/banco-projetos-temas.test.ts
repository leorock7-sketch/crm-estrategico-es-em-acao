// @vitest-environment node
/**
 * Regras do banco de dados de projetos, temas e contextos (Etapa 1.1),
 * verificadas em um banco PGlite real, criado na memória com os mesmos
 * scripts usados pela aplicação.
 */
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, type Transacao } from "@/lib/banco/conexao";
import { comite, projetoTema, registroAuditoria } from "@/lib/banco/esquema";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import * as projetos from "@/modulos/projetos-temas/consultas";
import type { DadosProjetoTema } from "@/modulos/projetos-temas/esquemas";
import * as stakeholders from "@/modulos/stakeholders/consultas";

let banco: Banco;
let usuarioId: string;
const comites: Record<"desenvolvimento" | "infraestrutura" | "investimentos" | "inovacao", string> = {
  desenvolvimento: "",
  infraestrutura: "",
  investimentos: "",
  inovacao: "",
};

beforeAll(async () => {
  banco = await abrirBanco();
  usuarioId = (await obterUsuarioAtual(banco)).id;
  for (const c of await banco.select().from(comite)) {
    if (c.tipo === "desenvolvimento") comites.desenvolvimento = c.id;
    else if (c.nome.includes("Infraestrutura")) comites.infraestrutura = c.id;
    else if (c.nome.includes("Investimentos")) comites.investimentos = c.id;
    else comites.inovacao = c.id;
  }
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

function dadosProjeto(nome: string, comiteId = comites.infraestrutura): DadosProjetoTema {
  return { tipo: "projeto", nome, comiteId, situacao: "ativo" };
}

describe("Projetos e temas", () => {
  test("cria com nome normalizado e registra a inclusão na auditoria", async () => {
    const id = await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Ponte Exemplo Ágil")));

    const [registro] = await banco.select().from(projetoTema).where(eq(projetoTema.id, id));
    expect(registro.nomeNormalizado).toBe("ponte exemplo agil");
    expect(registro.criadoPor).toBe(usuarioId);

    const auditoria = await banco.select().from(registroAuditoria).where(eq(registroAuditoria.registroId, id));
    expect(auditoria.map((a) => a.operacao)).toEqual(["inclusao"]);
  });

  test("a migração preenche o nome normalizado dos registros já existentes", async () => {
    const resultado = await banco.execute(
      sql`select count(*)::int as vazios from projeto_tema where nome_normalizado = ''`,
    );
    expect(resultado.rows[0]).toEqual({ vazios: 0 });
  });

  test("o mesmo nome no mesmo comitê e tipo é recusado; em outro comitê, gera alerta", async () => {
    await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Rodovia Exemplo Norte")));
    const mensagem = await mensagemDaFalha(
      gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Rodovia Exemplo Norte"))),
    );
    expect(mensagem).toMatch(/Já existe/);

    const alertas = await projetos.possiveisDuplicidadesProjetoTema(banco, { nome: "rodovia exemplo norte" });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].motivo).toBe("Mesmo nome");
    const semelhantes = await projetos.possiveisDuplicidadesProjetoTema(banco, { nome: "Rodovia Exemplo" });
    expect(semelhantes[0]?.motivo).toBe("Nome semelhante");
  });

  test("o término não pode ser anterior ao início", async () => {
    const mensagem = await mensagemDaFalha(
      gravar((tx) =>
        projetos.criarProjetoTema(tx, {
          ...dadosProjeto("Projeto Datas Exemplo"),
          dataInicio: "2026-05-01",
          dataFim: "2026-04-01",
        }),
      ),
    );
    expect(mensagem).toMatch(/término/i);
  });

  test("não permite excluir; arquivar oculta da lista por padrão", async () => {
    const id = await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Projeto Arquivável Exemplo")));
    const exclusao = await mensagemDaFalha(gravar((tx) => tx.delete(projetoTema).where(eq(projetoTema.id, id))));
    expect(exclusao).toMatch(/não são excluídos; utilize o arquivamento/);

    await gravar((tx) => projetos.definirArquivamentoProjetoTema(tx, id, true));
    expect(await projetos.listarProjetosTemas(banco, { busca: "Arquivável" })).toHaveLength(0);
    expect(await projetos.listarProjetosTemas(banco, { busca: "arquivavel", incluirArquivados: true })).toHaveLength(1);
  });
});

describe("Comitês participantes (D-023)", () => {
  test("o comitê principal não pode ser também participante", async () => {
    const projetoTemaId = await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Projeto Principal Exemplo")));
    const mensagem = await mensagemDaFalha(
      gravar((tx) => projetos.criarParticipacao(tx, { projetoTemaId, comiteId: comites.infraestrutura })),
    );
    expect(mensagem).toBe("O comitê principal não pode ser também comitê participante.");
  });

  test("um comitê participante não pode virar principal sem antes encerrar a participação", async () => {
    const projetoTemaId = await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Projeto Troca Exemplo")));
    const participacaoId = await gravar((tx) =>
      projetos.criarParticipacao(tx, { projetoTemaId, comiteId: comites.inovacao }),
    );
    const mensagem = await mensagemDaFalha(
      gravar((tx) =>
        projetos.atualizarProjetoTema(tx, projetoTemaId, dadosProjeto("Projeto Troca Exemplo", comites.inovacao)),
      ),
    );
    expect(mensagem).toMatch(/já é participante/);

    await gravar((tx) => projetos.encerrarParticipacao(tx, participacaoId, "2026-10-01"));
    await gravar((tx) =>
      projetos.atualizarProjetoTema(tx, projetoTemaId, dadosProjeto("Projeto Troca Exemplo", comites.inovacao)),
    );
    const atualizado = await projetos.obterProjetoTema(banco, projetoTemaId);
    expect(atualizado?.comiteId).toBe(comites.inovacao);
  });

  test("participação vigente é única por comitê; encerrada, pode ser registrada de novo", async () => {
    const projetoTemaId = await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Projeto Participação Exemplo")));
    const primeira = await gravar((tx) =>
      projetos.criarParticipacao(tx, { projetoTemaId, comiteId: comites.investimentos, dataInicio: "2026-01-10" }),
    );
    const repetida = await mensagemDaFalha(
      gravar((tx) => projetos.criarParticipacao(tx, { projetoTemaId, comiteId: comites.investimentos })),
    );
    expect(repetida).toMatch(/já é participante vigente/);

    const terminoInvalido = await mensagemDaFalha(
      gravar((tx) => projetos.encerrarParticipacao(tx, primeira, "2026-01-01")),
    );
    expect(terminoInvalido).toMatch(/término/i);

    expect(await gravar((tx) => projetos.encerrarParticipacao(tx, primeira, "2026-06-30"))).toBe(projetoTemaId);
    expect(await gravar((tx) => projetos.encerrarParticipacao(tx, primeira, "2026-07-30"))).toBeNull();
    await gravar((tx) => projetos.criarParticipacao(tx, { projetoTemaId, comiteId: comites.investimentos }));

    const participantes = await projetos.listarParticipantes(banco, projetoTemaId);
    expect(participantes.map((p) => p.dataFim)).toEqual([null, "2026-06-30"]);
  });

  test("o filtro por comitê encontra projetos em que ele é principal ou participante vigente", async () => {
    const principal = await gravar((tx) =>
      projetos.criarProjetoTema(tx, dadosProjeto("Filtro Exemplo Um", comites.desenvolvimento)),
    );
    const comoParticipante = await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Filtro Exemplo Dois")));
    await gravar((tx) =>
      projetos.criarParticipacao(tx, { projetoTemaId: comoParticipante, comiteId: comites.desenvolvimento }),
    );

    const encontrados = await projetos.listarProjetosTemas(banco, {
      busca: "Filtro Exemplo",
      comiteId: comites.desenvolvimento,
    });
    expect(encontrados.map((p) => p.id).sort()).toEqual([principal, comoParticipante].sort());
    expect(encontrados.find((p) => p.id === comoParticipante)?.participantes).toBe("Comitê de Desenvolvimento");

    const doComite = await projetos.projetosTemasDoComite(banco, comites.desenvolvimento);
    expect(doComite.principais.map((p) => p.id)).toContain(principal);
    expect(doComite.participacoes.map((p) => p.id)).toContain(comoParticipante);
  });

  test("a lista de comitês conta projetos como principal e participações vigentes, sem os arquivados", async () => {
    const totais = async () =>
      (await projetos.listarComites(banco)).find((c) => c.id === comites.investimentos)!;
    const antes = await totais();

    const principal = await gravar((tx) =>
      projetos.criarProjetoTema(tx, dadosProjeto("Contagem Exemplo Um", comites.investimentos)),
    );
    const participado = await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Contagem Exemplo Dois")));
    await gravar((tx) => projetos.criarParticipacao(tx, { projetoTemaId: participado, comiteId: comites.investimentos }));
    const encerrado = await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Contagem Exemplo Três")));
    const participacaoEncerrada = await gravar((tx) =>
      projetos.criarParticipacao(tx, { projetoTemaId: encerrado, comiteId: comites.investimentos }),
    );
    await gravar((tx) => projetos.encerrarParticipacao(tx, participacaoEncerrada, "2026-10-01"));

    const depois = await totais();
    expect(depois.comoPrincipal - antes.comoPrincipal).toBe(1);
    expect(depois.comoParticipante - antes.comoParticipante).toBe(1);

    await gravar((tx) => projetos.definirArquivamentoProjetoTema(tx, principal, true));
    await gravar((tx) => projetos.definirArquivamentoProjetoTema(tx, participado, true));
    const semArquivados = await totais();
    expect([semArquivados.comoPrincipal, semArquivados.comoParticipante]).toEqual([
      antes.comoPrincipal,
      antes.comoParticipante,
    ]);

    const lista = await projetos.listarComites(banco);
    expect(lista[0].tipo).toBe("desenvolvimento");
    expect(lista).toHaveLength(4);
  });
});

describe("Stakeholders dos contextos (D-030)", () => {
  test("associa pessoa e instituição com tipo de relação e descrição, e aparece nos dois lados", async () => {
    const projetoTemaId = await gravar((tx) =>
      projetos.criarProjetoTema(tx, { ...dadosProjeto("Tema Associação Exemplo"), tipo: "tema" }),
    );
    const pessoaId = await gravar((tx) => stakeholders.criarPessoa(tx, { nomeCompleto: "Otávio Exemplo Reis" }));
    const instituicaoId = await gravar((tx) =>
      stakeholders.criarInstituicao(tx, { nome: "Cooperativa Associação Exemplo", natureza: "terceiro_setor" }),
    );
    await gravar((tx) =>
      projetos.criarAssociacao(tx, {
        projetoTemaId,
        stakeholderId: pessoaId,
        tipoRelacao: "parceiro",
        descricao: "Articula os produtores locais.",
      }),
    );
    await gravar((tx) =>
      projetos.criarAssociacao(tx, { projetoTemaId, stakeholderId: instituicaoId, tipoRelacao: "beneficiario" }),
    );

    const doContexto = await projetos.listarStakeholdersDoContexto(banco, projetoTemaId);
    expect(doContexto.map((s) => [s.nome, s.tipoStakeholder, s.tipoRelacao])).toEqual([
      ["Otávio Exemplo Reis", "pessoa", "parceiro"],
      ["Cooperativa Associação Exemplo", "instituicao", "beneficiario"],
    ]);

    const [contexto] = await projetos.contextosDoStakeholder(banco, pessoaId);
    expect(contexto).toMatchObject({
      projetoTemaNome: "Tema Associação Exemplo",
      tipo: "tema",
      descricao: "Articula os produtores locais.",
      dataFim: null,
    });

    const [linha] = await projetos.listarProjetosTemas(banco, { busca: "Tema Associação Exemplo" });
    expect(linha.stakeholders).toBe(2);
  });

  test("a mesma relação vigente não se repete; outro tipo de relação é permitido", async () => {
    const projetoTemaId = await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Projeto Relação Exemplo")));
    const stakeholderId = await gravar((tx) => stakeholders.criarPessoa(tx, { nomeCompleto: "Paula Exemplo Dias" }));
    const associacaoId = await gravar((tx) =>
      projetos.criarAssociacao(tx, { projetoTemaId, stakeholderId, tipoRelacao: "executor" }),
    );
    const repetida = await mensagemDaFalha(
      gravar((tx) => projetos.criarAssociacao(tx, { projetoTemaId, stakeholderId, tipoRelacao: "executor" })),
    );
    expect(repetida).toMatch(/já está associad/);

    await gravar((tx) => projetos.criarAssociacao(tx, { projetoTemaId, stakeholderId, tipoRelacao: "financiador" }));
    const encerrada = await gravar((tx) => projetos.encerrarAssociacao(tx, associacaoId, "2026-09-30"));
    expect(encerrada).toEqual({ projetoTemaId, stakeholderId });
    await gravar((tx) => projetos.criarAssociacao(tx, { projetoTemaId, stakeholderId, tipoRelacao: "executor" }));

    const contextos = await projetos.contextosDoStakeholder(banco, stakeholderId);
    expect(contextos.filter((c) => c.dataFim === null)).toHaveLength(2);
    expect(contextos.filter((c) => c.dataFim !== null)).toHaveLength(1);
  });

  test("a associação não guarda poder, interesse nem posicionamento", async () => {
    const resultado = await banco.execute(sql`
      select column_name from information_schema.columns
      where table_name = 'stakeholder_contexto' order by column_name
    `);
    const colunas = resultado.rows.map((linha) => (linha as { column_name: string }).column_name);
    expect(colunas.some((c) => /poder|interesse|posicion|influencia|peso/.test(c))).toBe(false);
  });

  test("o histórico do projeto e o da pessoa registram participações e associações", async () => {
    const projetoTemaId = await gravar((tx) => projetos.criarProjetoTema(tx, dadosProjeto("Projeto Histórico Exemplo")));
    const stakeholderId = await gravar((tx) => stakeholders.criarPessoa(tx, { nomeCompleto: "Renato Exemplo Luz" }));
    await gravar((tx) => projetos.criarParticipacao(tx, { projetoTemaId, comiteId: comites.inovacao }));
    const associacaoId = await gravar((tx) =>
      projetos.criarAssociacao(tx, { projetoTemaId, stakeholderId, tipoRelacao: "outro" }),
    );
    await gravar((tx) => projetos.encerrarAssociacao(tx, associacaoId, "2026-10-15"));

    const historicoProjeto = await projetos.historicoDoProjetoTema(banco, projetoTemaId);
    expect(historicoProjeto.map((r) => `${r.tabela}:${r.operacao}`).sort()).toEqual([
      "projeto_tema:inclusao",
      "projeto_tema_comite:inclusao",
      "stakeholder_contexto:alteracao",
      "stakeholder_contexto:inclusao",
    ]);

    const historicoPessoa = await stakeholders.historicoDoStakeholder(banco, stakeholderId);
    expect(historicoPessoa.filter((r) => r.tabela === "stakeholder_contexto")).toHaveLength(2);

    const nomes = await stakeholders.nomesDosRegistros(banco, stakeholders.idsCitadosNoHistorico(historicoProjeto));
    expect(nomes.get(stakeholderId)).toBe("Renato Exemplo Luz");
    expect(nomes.get(comites.inovacao)).toBe("Comitê Temático de Inovação");
    expect(nomes.get(projetoTemaId)).toBe("Projeto Histórico Exemplo");
  });
});
