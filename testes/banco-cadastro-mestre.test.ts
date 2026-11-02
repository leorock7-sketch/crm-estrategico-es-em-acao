// @vitest-environment node
/**
 * Regras do banco de dados do Cadastro Mestre, verificadas em um banco PGlite
 * real, criado na memória com os mesmos scripts usados pela aplicação.
 */
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, type Transacao } from "@/lib/banco/conexao";
import { comite, pessoa, registroAuditoria, stakeholder } from "@/lib/banco/esquema";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import * as consultas from "@/modulos/stakeholders/consultas";
import { mensagemDeErro } from "@/lib/banco/mensagens-erro";

let banco: Banco;
let usuarioId: string;

beforeAll(async () => {
  banco = await abrirBanco();
  usuarioId = (await obterUsuarioAtual(banco)).id;
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

async function auditoriaDe(registroId: string) {
  return banco
    .select()
    .from(registroAuditoria)
    .where(eq(registroAuditoria.registroId, registroId))
    .orderBy(registroAuditoria.id);
}

const instituicaoBase = { natureza: "empresa" as const };

describe("Estrutura institucional", () => {
  test("cria os quatro comitês, com os temáticos subordinados ao de desenvolvimento", async () => {
    const comites = await banco.select().from(comite);
    expect(comites).toHaveLength(4);
    const desenvolvimento = comites.find((c) => c.tipo === "desenvolvimento");
    expect(desenvolvimento?.nome).toBe("Comitê de Desenvolvimento");
    const tematicos = comites.filter((c) => c.tipo === "tematico");
    expect(tematicos.map((c) => c.nome).sort()).toEqual([
      "Comitê Temático de Atração de Investimentos",
      "Comitê Temático de Infraestrutura",
      "Comitê Temático de Inovação",
    ]);
    expect(tematicos.every((c) => c.comiteSuperiorId === desenvolvimento?.id)).toBe(true);
  });

  test("recusa comitê temático subordinado a outro comitê temático", async () => {
    const [tematico] = await banco.select().from(comite).where(eq(comite.tipo, "tematico"));
    const mensagem = await mensagemDaFalha(
      gravar((tx) =>
        tx.insert(comite).values({
          nome: "Comitê Temático Fictício",
          tipo: "tematico",
          comiteSuperiorId: tematico.id,
        }),
      ),
    );
    expect(mensagem).toContain("subordinado a um comitê de desenvolvimento");
  });
});

describe("Pessoas", () => {
  test("cria o stakeholder do tipo pessoa e registra a inclusão com o usuário responsável", async () => {
    const id = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Laura Exemplo Pinto" }));

    const [mae] = await banco.select().from(stakeholder).where(eq(stakeholder.id, id));
    expect(mae.tipo).toBe("pessoa");

    const criada = await consultas.obterPessoa(banco, id);
    expect(criada?.nomeNormalizado).toBe("laura exemplo pinto");
    expect(criada?.criadoPor).toBe(usuarioId);

    const auditoria = await auditoriaDe(id);
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].operacao).toBe("inclusao");
    expect(auditoria[0].usuarioId).toBe(usuarioId);
  });

  test("registra alteração apenas quando algum dado de fato muda", async () => {
    const dados = { nomeCompleto: "Nina Modelo Freitas", observacoes: "Primeira versão" };
    const id = await gravar((tx) => consultas.criarPessoa(tx, dados));

    await gravar((tx) => consultas.atualizarPessoa(tx, id, dados));
    expect(await auditoriaDe(id)).toHaveLength(1);

    await gravar((tx) => consultas.atualizarPessoa(tx, id, { ...dados, observacoes: "Segunda versão" }));
    const auditoria = await auditoriaDe(id);
    expect(auditoria.map((a) => a.operacao)).toEqual(["inclusao", "alteracao"]);
    expect(auditoria[1].dadosAnteriores).toMatchObject({ observacoes: "Primeira versão" });
    expect(auditoria[1].dadosNovos).toMatchObject({ observacoes: "Segunda versão" });
  });

  test("arquivamento e reativação ficam registrados na auditoria", async () => {
    const id = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Otávio Exemplo" }));
    await gravar((tx) => consultas.definirArquivamentoPessoa(tx, id, true));
    expect((await consultas.obterPessoa(banco, id))?.arquivadoEm).not.toBeNull();
    await gravar((tx) => consultas.definirArquivamentoPessoa(tx, id, false));
    expect((await consultas.obterPessoa(banco, id))?.arquivadoEm).toBeNull();

    const operacoes = (await auditoriaDe(id)).map((a) => a.operacao);
    expect(operacoes).toEqual(["inclusao", "arquivamento", "reativacao"]);
  });

  test("não permite excluir registros nem alterar a trilha de auditoria", async () => {
    const id = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Paula Teste" }));

    const exclusao = await mensagemDaFalha(banco.delete(pessoa).where(eq(pessoa.id, id)));
    expect(exclusao).toContain("não são excluídos");

    const alteracaoAuditoria = await mensagemDaFalha(
      banco.update(registroAuditoria).set({ tabela: "adulterada" }).where(eq(registroAuditoria.registroId, id)),
    );
    expect(alteracaoAuditoria).toContain("não pode ser alterado");
  });

  test("o tipo do stakeholder não pode ser trocado", async () => {
    const id = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Rui Exemplo" }));
    await expect(
      banco.update(stakeholder).set({ tipo: "instituicao" }).where(eq(stakeholder.id, id)),
    ).rejects.toThrow();
  });

  test("a busca ignora acentos e maiúsculas e oculta arquivadas por padrão", async () => {
    const id = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Sônia Fictícia Araújo" }));
    expect((await consultas.listarPessoas(banco, { busca: "SONIA ficticia" })).map((p) => p.id)).toContain(id);

    await gravar((tx) => consultas.definirArquivamentoPessoa(tx, id, true));
    expect((await consultas.listarPessoas(banco, { busca: "sonia" })).map((p) => p.id)).not.toContain(id);
    expect(
      (await consultas.listarPessoas(banco, { busca: "sonia", incluirArquivadas: true })).map((p) => p.id),
    ).toContain(id);
  });

  test("aponta possíveis duplicidades por nome e nome semelhante", async () => {
    await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Tereza Modelo Santos" }));

    const mesmoNome = await consultas.possiveisDuplicidadesPessoa(banco, { nomeCompleto: "TEREZA modelo santos" });
    expect(mesmoNome[0]?.motivo).toBe("Mesmo nome");

    const semelhante = await consultas.possiveisDuplicidadesPessoa(banco, { nomeCompleto: "Tereza Santos" });
    expect(semelhante[0]?.motivo).toBe("Nome semelhante");

    const nenhuma = await consultas.possiveisDuplicidadesPessoa(banco, { nomeCompleto: "Ulisses Teste" });
    expect(nenhuma).toHaveLength(0);
  });
});

describe("Contatos (D-025)", () => {
  test("o mesmo e-mail institucional pode ser registrado para duas pessoas, com alerta", async () => {
    const titular = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Titular Antigo Exemplo" }));
    const sucessor = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Titular Novo Exemplo" }));
    const contato = { tipo: "email" as const, valor: "Gabinete@Exemplo.org", natureza: "funcional" as const, principal: false };
    await gravar((tx) => consultas.criarContato(tx, { ...contato, stakeholderId: titular }));

    const alerta = await consultas.contatosRepetidos(banco, { tipo: "email", valor: "gabinete@exemplo.org " });
    expect(alerta.map((a) => [a.nome, a.motivo, a.caminho])).toEqual([
      ["Titular Antigo Exemplo", "Mesmo contato (funcional)", "/pessoas"],
    ]);

    await gravar((tx) => consultas.criarContato(tx, { ...contato, stakeholderId: sucessor }));
    expect(await consultas.listarContatos(banco, sucessor)).toHaveLength(1);
  });

  test("ao encerrar o vínculo, o contato ligado a ele é encerrado na mesma data", async () => {
    const pessoaId = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Secretária Exemplo Antiga" }));
    const instituicaoId = await gravar((tx) =>
      consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Secretaria Exemplo de Contatos" }),
    );
    const vinculoId = await gravar((tx) =>
      consultas.criarVinculo(tx, { pessoaId, instituicaoId, principal: true, cargo: "Secretária" }),
    );
    await gravar((tx) =>
      consultas.criarContato(tx, {
        stakeholderId: pessoaId,
        vinculoId,
        tipo: "email",
        valor: "secretaria@exemplo.org",
        natureza: "funcional",
        principal: false,
      }),
    );

    await gravar((tx) => consultas.encerrarVinculo(tx, vinculoId, "2026-10-31"));
    const [contato] = await consultas.listarContatos(banco, pessoaId);
    expect(contato).toMatchObject({ dataFim: "2026-10-31", vinculoCargo: "Secretária" });
    expect(await consultas.contatosRepetidos(banco, { tipo: "email", valor: "secretaria@exemplo.org" })).toHaveLength(0);
  });

  test("o vínculo ligado ao contato deve ser da própria pessoa", async () => {
    const dona = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Dona do Vínculo Exemplo" }));
    const outra = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Outra Pessoa Exemplo" }));
    const instituicaoId = await gravar((tx) =>
      consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Empresa Vínculo Exemplo" }),
    );
    const vinculoId = await gravar((tx) => consultas.criarVinculo(tx, { pessoaId: dona, instituicaoId, principal: false }));
    const mensagem = await mensagemDaFalha(
      gravar((tx) =>
        consultas.criarContato(tx, {
          stakeholderId: outra,
          vinculoId,
          tipo: "telefone",
          valor: "(27) 90000-0000",
          natureza: "funcional",
          principal: false,
        }),
      ),
    );
    expect(mensagem).toBe("O vínculo informado não pertence a esta pessoa.");
  });

  test("no máximo um contato principal vigente por tipo", async () => {
    const id = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Principal Exemplo Teste" }));
    const email = { stakeholderId: id, tipo: "email" as const, natureza: "pessoal" as const };
    await gravar((tx) => consultas.criarContato(tx, { ...email, valor: "um@exemplo.org", principal: true }));
    const mensagem = await mensagemDaFalha(
      gravar((tx) => consultas.criarContato(tx, { ...email, valor: "dois@exemplo.org", principal: true })),
    );
    expect(mensagem).toContain("Já existe um contato principal vigente deste tipo");
    await gravar((tx) => consultas.criarContato(tx, { ...email, valor: "dois@exemplo.org", principal: false }));
  });

  test("a lista mostra o e-mail principal, a busca encontra pelo contato e o histórico o registra", async () => {
    const id = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Zélia Contato Exemplo" }));
    await gravar((tx) =>
      consultas.criarContato(tx, { stakeholderId: id, tipo: "email", valor: "zelia@exemplo.org", natureza: "pessoal", principal: true }),
    );

    const [linha] = await consultas.listarPessoas(banco, { busca: "zelia@exemplo" });
    expect(linha).toMatchObject({ id, email: "zelia@exemplo.org" });

    const historico = await consultas.historicoDoStakeholder(banco, id);
    expect(historico.map((r) => r.tabela).sort()).toEqual(["contato", "pessoa"]);
  });
});

describe("Instituições", () => {
  test("CNPJ repetido é permitido e gera alerta (D-024), inclusive no formato alfanumérico", async () => {
    const orgao = await gravar((tx) =>
      consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Empresa Alfa Exemplo", cnpj: "12ABC34501DE35" }),
    );
    const alerta = await consultas.possiveisDuplicidadesInstituicao(banco, {
      nome: "Unidade da Empresa Alfa",
      cnpj: "12ABC34501DE35",
    });
    expect(alerta.map((a) => a.motivo)).toEqual(["Mesmo CNPJ"]);
    await gravar((tx) =>
      consultas.criarInstituicao(tx, {
        ...instituicaoBase,
        nome: "Unidade da Empresa Alfa",
        cnpj: "12ABC34501DE35",
        instituicaoSuperiorId: orgao,
      }),
    );
  });

  test("país padrão é o Brasil; UF e CNPJ só para instituições brasileiras", async () => {
    const brasileira = await gravar((tx) => consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Empresa Nacional Exemplo" }));
    expect((await consultas.obterInstituicao(banco, brasileira))?.pais).toBe("BR");

    await gravar((tx) => consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Foreign Example Agency", pais: "PT" }));
    expect(
      await mensagemDaFalha(
        gravar((tx) => consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Foreign Example Two", pais: "PT", uf: "ES" })),
      ),
    ).toBe("A UF só se aplica a instituições do Brasil.");
    expect(
      await mensagemDaFalha(
        gravar((tx) =>
          consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Foreign Example Three", pais: "PT", cnpj: "11222333000181" }),
        ),
      ),
    ).toBe("O CNPJ só se aplica a instituições do Brasil.");
  });

  test("o banco recusa CNPJ fora do formato, mesmo sem passar pela tela", async () => {
    await expect(
      gravar((tx) => consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Empresa Gama", cnpj: "123" })),
    ).rejects.toThrow();
  });

  test("a hierarquia de instituições não pode formar ciclo", async () => {
    const a = await gravar((tx) => consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Holding Exemplo A" }));
    const b = await gravar((tx) =>
      consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Subsidiária Exemplo B", instituicaoSuperiorId: a }),
    );
    const mensagem = await mensagemDaFalha(
      gravar((tx) =>
        consultas.atualizarInstituicao(tx, a, { ...instituicaoBase, nome: "Holding Exemplo A", instituicaoSuperiorId: b }),
      ),
    );
    expect(mensagem).toContain("não pode formar um ciclo");
    expect((await consultas.listarSubordinadas(banco, a)).map((s) => s.id)).toEqual([b]);
  });

  test("aponta possíveis duplicidades por sigla", async () => {
    await gravar((tx) =>
      consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Instituto Delta Exemplo", sigla: "IDE" }),
    );
    const resultado = await consultas.possiveisDuplicidadesInstituicao(banco, {
      nome: "Outro Instituto",
      sigla: "ide",
    });
    expect(resultado[0]?.motivo).toBe("Mesma sigla");
  });
});

describe("Vínculos", () => {
  test("cada pessoa tem no máximo um vínculo principal vigente; encerrar libera um novo", async () => {
    const pessoaId = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Vera Exemplo Dias" }));
    const instituicaoId = await gravar((tx) =>
      consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Empresa Épsilon Exemplo" }),
    );
    const vinculo = { pessoaId, instituicaoId, principal: true };

    const primeiro = await gravar((tx) => consultas.criarVinculo(tx, { ...vinculo, cargo: "Diretora" }));
    const mensagem = await mensagemDaFalha(
      gravar((tx) => consultas.criarVinculo(tx, { ...vinculo, cargo: "Conselheira" })),
    );
    expect(mensagem).toContain("já tem um vínculo principal vigente");

    expect(await gravar((tx) => consultas.encerrarVinculo(tx, primeiro, "2026-10-01"))).toBe(true);
    expect(await gravar((tx) => consultas.encerrarVinculo(tx, primeiro, "2026-10-02"))).toBe(false);
    await gravar((tx) => consultas.criarVinculo(tx, { ...vinculo, cargo: "Presidente" }));

    const vinculos = await consultas.listarVinculosDaPessoa(banco, pessoaId);
    expect(vinculos.map((v) => [v.cargo, v.dataFim])).toEqual([
      ["Presidente", null],
      ["Diretora", "2026-10-01"],
    ]);
  });

  test("o término não pode ser anterior ao início", async () => {
    const pessoaId = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Wagner Teste" }));
    const instituicaoId = await gravar((tx) =>
      consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Empresa Zeta Exemplo" }),
    );
    const mensagem = await mensagemDaFalha(
      gravar((tx) =>
        consultas.criarVinculo(tx, {
          pessoaId,
          instituicaoId,
          principal: false,
          dataInicio: "2026-05-10",
          dataFim: "2026-05-01",
        }),
      ),
    );
    expect(mensagem).toBe("A data de término não pode ser anterior à data de início.");
  });

  test("o histórico da pessoa e o da instituição incluem os vínculos", async () => {
    const pessoaId = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Xavier Exemplo" }));
    const instituicaoId = await gravar((tx) =>
      consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Empresa Eta Exemplo" }),
    );
    await gravar((tx) => consultas.criarVinculo(tx, { pessoaId, instituicaoId, principal: false, cargo: "Analista" }));

    const historicoPessoa = await consultas.historicoDoStakeholder(banco, pessoaId);
    expect(historicoPessoa.map((r) => r.tabela).sort()).toEqual(["pessoa", "vinculo_pessoa_instituicao"]);
    expect(historicoPessoa.every((r) => r.usuarioNome === "Administrador (desenvolvimento)")).toBe(true);

    const historicoInstituicao = await consultas.historicoDoStakeholder(banco, instituicaoId);
    expect(historicoInstituicao.map((r) => r.tabela).sort()).toEqual(["instituicao", "vinculo_pessoa_instituicao"]);

    const nomes = await consultas.nomesDosRegistros(banco, consultas.idsCitadosNoHistorico(historicoPessoa));
    expect(nomes.get(instituicaoId)).toBe("Empresa Eta Exemplo");
  });

  test("a lista de pessoas mostra o vínculo principal vigente", async () => {
    const pessoaId = await gravar((tx) => consultas.criarPessoa(tx, { nomeCompleto: "Yara Modelo" }));
    const instituicaoId = await gravar((tx) =>
      consultas.criarInstituicao(tx, { ...instituicaoBase, nome: "Empresa Teta Exemplo", sigla: "ETE" }),
    );
    await gravar((tx) => consultas.criarVinculo(tx, { pessoaId, instituicaoId, principal: true, cargo: "Gerente" }));

    const [linha] = await consultas.listarPessoas(banco, { busca: "Yara Modelo" });
    expect(linha).toMatchObject({ cargo: "Gerente", instituicaoSigla: "ETE" });

    const [instituicaoListada] = await consultas.listarInstituicoes(banco, { busca: "ETE" });
    expect(instituicaoListada.pessoasVinculadas).toBe(1);
  });
});

test("o banco registra o usuário da operação somente dentro da transação", async () => {
  const resultado = await banco.execute(sql`select usuario_da_sessao() as usuario`);
  expect(resultado.rows[0]).toEqual({ usuario: null });
});
