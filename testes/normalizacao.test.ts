// @vitest-environment node
/**
 * Regra única de normalização (busca e duplicidade) e realinhamento dos
 * valores já gravados no banco — inclusive os preenchidos pela migração 0004,
 * que só aplicava minúsculas. Somente dados fictícios.
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { comite, contato, instituicao, pessoa, projetoTema, registroAuditoria } from "@/lib/banco/esquema";
import { alinharValoresNormalizados } from "@/lib/banco/normalizacao";
import { normalizarTexto } from "@/lib/texto";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import * as projetos from "@/modulos/projetos-temas/consultas";
import { esquemaProjetoTema } from "@/modulos/projetos-temas/esquemas";
import * as stakeholders from "@/modulos/stakeholders/consultas";

describe("Regra única de normalização", () => {
  test.each([
    ["Ampliação do Porto", "ampliacao do porto"],
    ["  AÇÃO   Estratégica  ", "acao estrategica"],
    ["ÇÃÕÉÍÓÚÂÊÔÀÜ", "caoeiouaeoau"],
    ["Über Ñandú Ågård", "uber nandu agard"],
    ["São-Mateus/ES", "sao mateus es"],
    ["Coração & Cia. Ltda.", "coracao cia ltda"],
    ["Rodovia BR-101, Km 2", "rodovia br 101 km 2"],
    ["Linha\tnova\nquebra", "linha nova quebra"],
    ["Pau d'Alho", "pau d alho"],
    ["Pau d´Alho", "pau d alho"],
    ["Pau d’Alho", "pau d alho"],
    ["Pau d`Alho", "pau d alho"],
    ["!!!", ""],
  ])("%j → %j", (entrada, esperado) => {
    expect(normalizarTexto(entrada)).toBe(esperado);
  });

  test("letra acentuada pronta ou composta (letra + acento) dá o mesmo resultado", () => {
    expect(normalizarTexto("Ação")).toBe(normalizarTexto("Ação"));
  });

  test("nome de projeto sem letras ou números é recusado", () => {
    const resultado = esquemaProjetoTema.safeParse({
      tipo: "projeto",
      nome: "!!! ---",
      comiteId: "0c000000-0000-4000-8000-000000000002",
      situacao: "ativo",
    });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toBe("O nome deve conter letras ou números.");
  });
});

let banco: Banco;
let usuarioId: string;
let comiteId: string;

beforeAll(async () => {
  banco = await abrirBanco();
  usuarioId = (await obterUsuarioAtual(banco)).id;
  [{ id: comiteId }] = await banco.select({ id: comite.id }).from(comite).limit(1);
}, 60_000);

function gravar<T>(operacao: Parameters<typeof comoUsuario<T>>[2]) {
  return comoUsuario(banco, usuarioId, operacao);
}

describe("Projetos e temas: busca e duplicidade", () => {
  test("a busca encontra o nome com ou sem acentos, em maiúsculas e com pontuação", async () => {
    const id = await gravar((tx) =>
      projetos.criarProjetoTema(tx, { tipo: "projeto", nome: "Ampliação do Cais Fictício", comiteId, situacao: "ativo" }),
    );
    for (const busca of ["ampliacao", "AMPLIAÇÃO", "Ampliação-do cais", "cais ficticio"]) {
      const encontrados = await projetos.listarProjetosTemas(banco, { busca });
      expect(encontrados.map((p) => p.id), busca).toContain(id);
    }
  });

  test("o mesmo nome com outra acentuação ou pontuação é apontado como “mesmo nome”", async () => {
    await gravar((tx) =>
      projetos.criarProjetoTema(tx, { tipo: "tema", nome: "Logística d'Água Fictícia", comiteId, situacao: "ativo" }),
    );
    for (const variante of ["Logistica d´Agua Ficticia", "LOGÍSTICA D’ÁGUA  FICTÍCIA", "logística-d-água ficticia"]) {
      const alertas = await projetos.possiveisDuplicidadesProjetoTema(banco, { nome: variante });
      expect(alertas.map((a) => a.motivo), variante).toContain("Mesmo nome");
    }
  });
});

describe("Bancos que já têm registros", () => {
  test("valores gravados pela regra antiga são realinhados; busca e duplicidade passam a funcionar", async () => {
    const ids = await gravar(async (tx) => {
      const projetoId = await projetos.criarProjetoTema(tx, {
        tipo: "projeto",
        nome: "Ferrovia Ñandú-Açaí Fictícia",
        comiteId,
        situacao: "proposto",
      });
      const pessoaId = await stakeholders.criarPessoa(tx, { nomeCompleto: "Joana D´Ávila Fictícia" });
      const instituicaoId = await stakeholders.criarInstituicao(tx, { nome: "Associação São-Tomé Fictícia", natureza: "terceiro_setor" });
      const contatoId = await stakeholders.criarContato(tx, {
        stakeholderId: instituicaoId,
        tipo: "site",
        valor: "https://associacao-ficticia.example.org/",
        natureza: "institucional",
        principal: false,
      });
      return { projetoId, pessoaId, instituicaoId, contatoId };
    });

    // Simula registros gravados pelas regras antigas dos scripts SQL (0004 e 0003).
    await banco.execute(sql`update projeto_tema set nome_normalizado = lower(trim(nome)) where id = ${ids.projetoId}`);
    await banco.execute(sql`update pessoa set nome_normalizado = lower(trim(nome_completo)) where id = ${ids.pessoaId}`);
    await banco.execute(sql`update instituicao set nome_normalizado = lower(trim(nome)) where id = ${ids.instituicaoId}`);
    await banco.execute(sql`update contato set valor_normalizado = lower(trim(valor)) where id = ${ids.contatoId}`);

    expect((await projetos.listarProjetosTemas(banco, { busca: "nandu acai" })).map((p) => p.id)).not.toContain(ids.projetoId);
    const antes = await projetos.possiveisDuplicidadesProjetoTema(banco, { nome: "Ferrovia Nandu Acai Ficticia" });
    expect(antes.map((a) => a.id)).not.toContain(ids.projetoId);

    expect(await alinharValoresNormalizados(banco)).toEqual({ projetosTemas: 1, pessoas: 1, instituicoes: 1, contatos: 1 });

    const [p] = await banco.select().from(projetoTema).where(eq(projetoTema.id, ids.projetoId));
    expect(p.nomeNormalizado).toBe("ferrovia nandu acai ficticia");
    const [pe] = await banco.select().from(pessoa).where(eq(pessoa.id, ids.pessoaId));
    expect(pe.nomeNormalizado).toBe("joana d avila ficticia");
    const [i] = await banco.select().from(instituicao).where(eq(instituicao.id, ids.instituicaoId));
    expect(i.nomeNormalizado).toBe("associacao sao tome ficticia");
    const [c] = await banco.select().from(contato).where(eq(contato.id, ids.contatoId));
    expect(c.valorNormalizado).toBe("https://associacao-ficticia.example.org");

    expect((await projetos.listarProjetosTemas(banco, { busca: "nandu acai" })).map((x) => x.id)).toContain(ids.projetoId);
    const depois = await projetos.possiveisDuplicidadesProjetoTema(banco, { nome: "Ferrovia Nandu Acai Ficticia" });
    expect(depois.find((a) => a.id === ids.projetoId)?.motivo).toBe("Mesmo nome");
    const pessoas = await stakeholders.listarPessoas(banco, { busca: "d avila" });
    expect(pessoas.map((x) => x.id)).toContain(ids.pessoaId);

    // A correção fica na trilha de auditoria, sem usuário (como as cargas iniciais).
    const [correcao] = await banco
      .select()
      .from(registroAuditoria)
      .where(
        and(eq(registroAuditoria.tabela, "projeto_tema"), eq(registroAuditoria.registroId, ids.projetoId), eq(registroAuditoria.operacao, "alteracao")),
      );
    expect(correcao.usuarioId).toBeNull();
  });

  test("o realinhamento é idempotente: uma segunda execução não altera nada", async () => {
    await alinharValoresNormalizados(banco);
    expect(await alinharValoresNormalizados(banco)).toEqual({ projetosTemas: 0, pessoas: 0, instituicoes: 0, contatos: 0 });
  });
});

describe("Ao abrir um banco já existente", () => {
  const pasta = mkdtempSync(path.join(os.tmpdir(), "crm-normalizacao-"));
  afterAll(() => rmSync(pasta, { recursive: true, force: true }));

  test("os valores da regra antiga são corrigidos automaticamente", async () => {
    const diretorio = path.join(pasta, "pglite");
    const primeiro = await abrirBanco(diretorio);
    const usuario = await obterUsuarioAtual(primeiro);
    const [{ id: comitePrimeiro }] = await primeiro.select({ id: comite.id }).from(comite).limit(1);
    const projetoId = await comoUsuario(primeiro, usuario.id, (tx) =>
      projetos.criarProjetoTema(tx, { tipo: "tema", nome: "Transição Energética Fictícia", comiteId: comitePrimeiro, situacao: "ativo" }),
    );
    await primeiro.execute(sql`update projeto_tema set nome_normalizado = lower(trim(nome)) where id = ${projetoId}`);
    await fecharBanco(primeiro);

    const reaberto = await abrirBanco(diretorio);
    const [registro] = await reaberto.select().from(projetoTema).where(eq(projetoTema.id, projetoId));
    expect(registro.nomeNormalizado).toBe("transicao energetica ficticia");
    await fecharBanco(reaberto);
  }, 60_000);
});
