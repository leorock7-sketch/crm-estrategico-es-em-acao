import { describe, expect, test } from "vitest";
import {
  situacaoProjetoTema,
  tipoComite,
  tipoProjetoTema,
  tipoRelacaoContexto,
} from "@/lib/banco/esquema";
import {
  esquemaAssociacao,
  esquemaEncerramentoAssociacao,
  esquemaParticipacao,
  esquemaProjetoTema,
} from "@/modulos/projetos-temas/esquemas";
import {
  SITUACOES_PROJETO_TEMA,
  TIPOS_COMITE,
  TIPOS_PROJETO_TEMA,
  TIPOS_RELACAO,
} from "@/modulos/projetos-temas/rotulos";
import { alteracoesEntre } from "@/modulos/stakeholders/historico";

const ID_COMITE = "0c000000-0000-4000-8000-000000000002";
const ID_PROJETO = "5e1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const ID_PESSOA = "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";

function primeiroErro(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.success ? undefined : resultado.error?.issues[0]?.message;
}

describe("Validação de projeto ou tema", () => {
  test("aceita os dados mínimos e trata campos vazios como não informados", () => {
    const resultado = esquemaProjetoTema.safeParse({
      tipo: "tema",
      nome: "  Logística Exemplo  ",
      descricao: "",
      comiteId: ID_COMITE,
      situacao: "proposto",
      dataInicio: "",
      dataFim: "",
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data).toMatchObject({ nome: "Logística Exemplo", descricao: undefined, dataInicio: undefined });
  });

  test("exige tipo, nome, comitê principal e situação válidos", () => {
    expect(primeiroErro(esquemaProjetoTema.safeParse({ nome: "X", comiteId: ID_COMITE, situacao: "ativo" }))).toBe(
      "Selecione se é projeto ou tema.",
    );
    expect(
      primeiroErro(esquemaProjetoTema.safeParse({ tipo: "projeto", nome: "X", comiteId: "", situacao: "ativo" })),
    ).toBe("Selecione o comitê principal.");
    expect(
      primeiroErro(esquemaProjetoTema.safeParse({ tipo: "projeto", nome: "X", comiteId: ID_COMITE, situacao: "x" })),
    ).toBe("Selecione a situação.");
  });

  test("recusa término anterior ao início", () => {
    const resultado = esquemaProjetoTema.safeParse({
      tipo: "projeto",
      nome: "Projeto Exemplo",
      comiteId: ID_COMITE,
      situacao: "ativo",
      dataInicio: "2026-05-10",
      dataFim: "2026-05-01",
    });
    expect(primeiroErro(resultado)).toBe("O término não pode ser anterior ao início.");
  });
});

describe("Validação de participação e associação", () => {
  test("participação exige o comitê", () => {
    expect(primeiroErro(esquemaParticipacao.safeParse({ projetoTemaId: ID_PROJETO, comiteId: "" }))).toBe(
      "Selecione o comitê.",
    );
  });

  test("associação exige pessoa ou instituição e um tipo de relação da lista neutra", () => {
    expect(
      primeiroErro(esquemaAssociacao.safeParse({ projetoTemaId: ID_PROJETO, stakeholderId: "", tipoRelacao: "parceiro" })),
    ).toBe("Selecione a pessoa ou instituição.");
    expect(
      primeiroErro(
        esquemaAssociacao.safeParse({ projetoTemaId: ID_PROJETO, stakeholderId: ID_PESSOA, tipoRelacao: "aliado" }),
      ),
    ).toBe("Selecione o tipo de relação.");
    expect(
      esquemaAssociacao.safeParse({
        projetoTemaId: ID_PROJETO,
        stakeholderId: ID_PESSOA,
        tipoRelacao: "representacao_setorial",
        descricao: "Fala pelo setor industrial.",
      }).success,
    ).toBe(true);
  });

  test("encerramento exige a data de término", () => {
    expect(primeiroErro(esquemaEncerramentoAssociacao.safeParse({ associacaoId: ID_PROJETO, dataFim: "" }))).toBe(
      "Informe a data de término.",
    );
  });
});

test("o histórico mostra situação, tipo e tipo de relação com nomes legíveis", () => {
  const nomes = new Map([
    [ID_COMITE, "Comitê Temático de Infraestrutura"],
    [ID_PESSOA, "Ana Exemplo"],
  ]);
  const projeto = alteracoesEntre(
    { tipo: "projeto", situacao: "proposto", comite_id: ID_COMITE },
    { tipo: "tema", situacao: "concluido", comite_id: ID_COMITE },
    nomes,
  );
  expect(projeto.map((a) => [a.rotulo, a.antes, a.depois])).toEqual([
    ["Tipo", "Projeto", "Tema"],
    ["Situação", "Proposto", "Concluído"],
  ]);

  const associacao = alteracoesEntre(
    null,
    { stakeholder_id: ID_PESSOA, comite_id: ID_COMITE, tipo_relacao: "orgao_competente", descricao: "Licenciamento" },
    nomes,
  );
  expect(associacao.map((a) => [a.rotulo, a.depois])).toEqual([
    ["Comitê", "Comitê Temático de Infraestrutura"],
    ["Tipo de relação", "Órgão competente ou regulador"],
    ["Descrição", "Licenciamento"],
  ]);
});

test("as listas da tela coincidem com as do banco de dados", () => {
  expect([...TIPOS_PROJETO_TEMA]).toEqual(tipoProjetoTema.enumValues);
  expect([...SITUACOES_PROJETO_TEMA]).toEqual(situacaoProjetoTema.enumValues);
  expect([...TIPOS_RELACAO]).toEqual(tipoRelacaoContexto.enumValues);
  expect([...TIPOS_COMITE]).toEqual(tipoComite.enumValues);
});
