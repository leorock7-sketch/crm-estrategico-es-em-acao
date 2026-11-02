// @vitest-environment node
/**
 * Atualização de um banco da Etapa 2A para a escala V2.2 (migração 0006, T-1):
 * a pasta de dados é copiada antes de aplicar a atualização; se a cópia falhar,
 * nada é aplicado; depois da atualização, todas as linhas anteriores continuam
 * idênticas, campo a campo (T20, T24). Somente dados fictícios.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { comite } from "@/lib/banco/esquema";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import * as projetos from "@/modulos/projetos-temas/consultas";
import * as stakeholders from "@/modulos/stakeholders/consultas";

const PASTA_MIGRACOES = path.join(process.cwd(), "src", "lib", "banco", "migracoes");
let temporaria: string;
let migracoesDa2A: string;

/** Pasta só com as atualizações 0000 a 0005, para criar um banco no estado da Etapa 2A. */
function prepararMigracoesDa2A(destino: string) {
  mkdirSync(path.join(destino, "meta"), { recursive: true });
  const diario = JSON.parse(readFileSync(path.join(PASTA_MIGRACOES, "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  const entradas = diario.entries.filter((e) => e.idx <= 5);
  for (const e of entradas) cpSync(path.join(PASTA_MIGRACOES, `${e.tag}.sql`), path.join(destino, `${e.tag}.sql`));
  writeFileSync(path.join(destino, "meta", "_journal.json"), JSON.stringify({ ...diario, entries: entradas }));
}

beforeAll(() => {
  temporaria = mkdtempSync(path.join(os.tmpdir(), "crm-migracao-"));
  migracoesDa2A = path.join(temporaria, "migracoes-2a");
  prepararMigracoesDa2A(migracoesDa2A);
});

afterAll(() => {
  rmSync(temporaria, { recursive: true, force: true });
});

async function linhas(banco: Banco, tabela: string): Promise<Record<string, unknown>[]> {
  const resultado = await banco.execute(sql.raw(`select to_jsonb(t) as linha from ${tabela} t order by id`));
  return (resultado.rows as { linha: Record<string, unknown> }[]).map((r) => r.linha);
}

async function migracoesAplicadas(banco: Banco): Promise<number> {
  const resultado = await banco.execute(sql`select count(*)::int as total from drizzle.__drizzle_migrations`);
  return (resultado.rows[0] as { total: number }).total;
}

/** Carrega dados fictícios no estado da Etapa 2A, com SQL direto (as tabelas ainda não têm as colunas novas). */
async function carregarDadosDa2A(banco: Banco) {
  const usuarioId = (await obterUsuarioAtual(banco)).id;
  const [{ id: comiteId }] = await banco.select({ id: comite.id }).from(comite).limit(1);
  await comoUsuario(banco, usuarioId, async (tx) => {
    const projetoTemaId = await projetos.criarProjetoTema(tx, {
      tipo: "projeto",
      nome: "Projeto Migração Fictício",
      comiteId,
      situacao: "ativo",
    });
    const pessoaId = await stakeholders.criarPessoa(tx, { nomeCompleto: "Pessoa Migração Fictícia" });
    const instituicaoId = await stakeholders.criarInstituicao(tx, { nome: "Instituição Migração Fictícia", natureza: "empresa" });
    for (const stakeholderId of [pessoaId, instituicaoId]) {
      await projetos.criarAssociacao(tx, { projetoTemaId, stakeholderId, tipoRelacao: "parceiro" });
    }

    const metodologia = await tx.execute(
      sql`insert into metodologia_versao (nome, descricao) values ('Demonstração fictícia 2A', 'Para o teste de atualização.') returning id`,
    );
    const metodologiaId = (metodologia.rows[0] as { id: string }).id;
    const criterios = await tx.execute(sql`
      insert into criterio_avaliacao (metodologia_versao_id, dimensao, nome, escala_minima, escala_maxima, peso, ordem)
      values (${metodologiaId}, 'poder', 'P fictício', 1, 5, 2, 0), (${metodologiaId}, 'interesse', 'I fictício', 1, 5, null, 1)
      returning id`);
    const [criterioP, criterioI] = (criterios.rows as { id: string }[]).map((c) => c.id);
    await tx.execute(sql`update metodologia_versao set situacao = 'vigente' where id = ${metodologiaId}`);

    for (const [stakeholderId, posicoes] of [
      [pessoaId, ["favoravel", "parcialmente_favoravel"]],
      [instituicaoId, ["parcialmente_contrario", null]],
    ] as const) {
      const ficha = await tx.execute(
        sql`insert into avaliacao (stakeholder_id, projeto_tema_id) values (${stakeholderId}, ${projetoTemaId}) returning id`,
      );
      const avaliacaoId = (ficha.rows[0] as { id: string }).id;
      for (const [indice, posicao] of posicoes.entries()) {
        const versao = await tx.execute(sql`
          insert into avaliacao_versao (avaliacao_id, numero_versao, metodologia_versao_id, posicionamento, grau_confianca,
            justificativa_confianca, justificativa, validacao_institucional, data_referencia)
          values (${avaliacaoId}, ${indice + 1}, ${metodologiaId}, ${posicao}, 'medio', 'Confiança fictícia.',
            ${`Versão fictícia ${indice + 1}.`}, 'Validação fictícia.', ${`2026-0${indice + 3}-15`})
          returning id`);
        const versaoId = (versao.rows[0] as { id: string }).id;
        await tx.execute(sql`
          insert into avaliacao_nota_criterio (avaliacao_versao_id, criterio_avaliacao_id, nota)
          values (${versaoId}, ${criterioP}, 4), (${versaoId}, ${criterioI}, 3)`);
        await tx.execute(sql`
          insert into evidencia (avaliacao_versao_id, tipo, descricao, fonte, data_evidencia)
          values (${versaoId}, 'observacao', 'Evidência fictícia.', 'Teste', '2026-03-01')`);
        await tx.execute(sql`update avaliacao_versao set situacao = 'substituida' where avaliacao_id = ${avaliacaoId} and situacao = 'vigente'`);
        await tx.execute(sql`update avaliacao_versao set situacao = 'vigente', poder = 87.5, interesse = 50 where id = ${versaoId}`);
      }
      // Rascunho em andamento e rascunho descartado também precisam ser preservados.
      const rascunho = await tx.execute(sql`
        insert into avaliacao_versao (avaliacao_id, numero_versao, metodologia_versao_id, posicionamento, justificativa)
        values (${avaliacaoId}, ${posicoes.length + 1}, ${metodologiaId}, 'neutro', 'Rascunho fictício.') returning id`);
      if (stakeholderId === instituicaoId) {
        await tx.execute(
          sql`update avaliacao_versao set arquivado_em = now() where id = ${(rascunho.rows[0] as { id: string }).id}`,
        );
      }
    }
  });
}

const TABELAS = ["metodologia_versao", "criterio_avaliacao", "avaliacao", "avaliacao_versao", "avaliacao_nota_criterio", "evidencia"];

/** Colunas acrescentadas pela 0006, com o valor esperado nas linhas antigas. */
const COLUNAS_NOVAS: Record<string, Record<string, unknown>> = {
  metodologia_versao: {
    escala_poder_interesse: "demonstracao_numerica",
    escala_posicionamento: "cinco_categorias",
    metodologia_anterior_id: null,
    natureza_alteracao: null,
    justificativa_natureza: null,
    natureza_aprovada_por: null,
    natureza_aprovada_em: null,
    equivalente_posicionamento_a: null,
    justificativa_equivalencia: null,
  },
  avaliacao_versao: {
    nivel_poder: null,
    nivel_interesse: null,
    justificativa_poder: null,
    justificativa_interesse: null,
    justificativa_posicionamento: null,
    natureza_posicionamento: null,
    situacao_ressalvas: null,
    descricao_ressalvas: null,
    alertas_reconhecidos: null,
  },
  evidencia: { evidencia_origem_id: null },
};

describe("Atualização de um banco da Etapa 2A (migração 0006)", () => {
  test("copia a pasta antes de atualizar e preserva todas as linhas anteriores, campo a campo (T-1, T20, T24)", async () => {
    const pasta = path.join(temporaria, "dados", "pglite");
    const antigo = await abrirBanco(pasta, { pastaMigracoes: migracoesDa2A });
    await carregarDadosDa2A(antigo);
    expect(await migracoesAplicadas(antigo)).toBe(6);
    const antes = Object.fromEntries(await Promise.all(TABELAS.map(async (t) => [t, await linhas(antigo, t)] as const)));
    expect(antes.avaliacao_versao.map((v) => v.posicionamento)).toContain("parcialmente_favoravel");
    await fecharBanco(antigo);

    const atualizado = await abrirBanco(pasta);
    try {
      expect(await migracoesAplicadas(atualizado)).toBe(7);
      const copias = readdirSync(path.join(temporaria, "dados", "copias"));
      expect(copias).toHaveLength(1);
      expect(copias[0]).toMatch(/^antes-migracao-/);
      expect(existsSync(path.join(temporaria, "dados", "copias", copias[0], "PG_VERSION"))).toBe(true);

      for (const tabela of TABELAS) {
        const depois = await linhas(atualizado, tabela);
        expect(depois).toHaveLength(antes[tabela].length);
        depois.forEach((linha, i) => {
          const anterior = antes[tabela][i];
          const preservada = Object.fromEntries(Object.keys(anterior).map((campo) => [campo, linha[campo]]));
          expect(preservada, `${tabela}, linha ${i + 1}`).toEqual(anterior);
          const acrescentadas = Object.fromEntries(Object.keys(linha).filter((campo) => !(campo in anterior)).map((c) => [c, linha[c]]));
          expect(acrescentadas, `${tabela}, colunas novas`).toEqual(COLUNAS_NOVAS[tabela] ?? {});
        });
      }
    } finally {
      await fecharBanco(atualizado);
    }
  }, 180_000);

  test("se a cópia de segurança falhar, nenhuma atualização é aplicada (T-1)", async () => {
    const pasta = path.join(temporaria, "falha", "pglite");
    await fecharBanco(await abrirBanco(pasta, { pastaMigracoes: migracoesDa2A }));

    await expect(
      abrirBanco(pasta, {
        copiar: () => {
          throw new Error("Disco cheio (simulado).");
        },
      }),
    ).rejects.toThrow(/cópia de segurança .* falhou\. Nenhuma atualização foi aplicada/);

    const intacto = await abrirBanco(pasta, { pastaMigracoes: migracoesDa2A });
    try {
      expect(await migracoesAplicadas(intacto)).toBe(6);
    } finally {
      await fecharBanco(intacto);
    }
  }, 180_000);

  test("banco novo não gera cópia: não há dados a preservar", async () => {
    const pasta = path.join(temporaria, "novo", "pglite");
    const banco = await abrirBanco(pasta);
    try {
      expect(await migracoesAplicadas(banco)).toBe(7);
      expect(existsSync(path.join(temporaria, "novo", "copias"))).toBe(false);
    } finally {
      await fecharBanco(banco);
    }
  }, 180_000);
});
