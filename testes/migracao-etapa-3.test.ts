// @vitest-environment node
/**
 * Atualização de um banco da Etapa 2B para a Etapa 3 (migração 0007): a pasta
 * de dados é copiada antes (T-1) e todas as tabelas anteriores — cadastro,
 * projetos, avaliações V2.2, auditoria — continuam idênticas, linha a linha.
 * As tabelas novas nascem vazias. Somente dados fictícios. A atualização para
 * a Etapa 4 (0008) tem o seu próprio teste (migracao-etapa-4.test.ts).
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { comite } from "@/lib/banco/esquema";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import * as avaliacoes from "@/modulos/avaliacoes/consultas";
import { METODOLOGIA_V22 } from "@/modulos/avaliacoes/rubricas-v22";
import * as projetos from "@/modulos/projetos-temas/consultas";
import * as stakeholders from "@/modulos/stakeholders/consultas";

const PASTA_MIGRACOES = path.join(process.cwd(), "src", "lib", "banco", "migracoes");
const TABELAS_NOVAS = [
  "iniciativa",
  "iniciativa_projeto_tema",
  "iniciativa_stakeholder",
  "interacao",
  "interacao_participante",
  "interacao_projeto_tema",
  "interacao_iniciativa",
  "compromisso",
  "compromisso_acompanhamento",
];
let temporaria: string;
let migracoesDa2B: string;
let migracoesDaEtapa3: string;

/** Pasta só com as atualizações 0000 até a indicada (0006: Etapa 2B; 0007: Etapa 3). */
function prepararMigracoesAte(destino: string, ultima: number) {
  mkdirSync(path.join(destino, "meta"), { recursive: true });
  const diario = JSON.parse(readFileSync(path.join(PASTA_MIGRACOES, "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  const entradas = diario.entries.filter((e) => e.idx <= ultima);
  for (const e of entradas) cpSync(path.join(PASTA_MIGRACOES, `${e.tag}.sql`), path.join(destino, `${e.tag}.sql`));
  writeFileSync(path.join(destino, "meta", "_journal.json"), JSON.stringify({ ...diario, entries: entradas }));
}

beforeAll(() => {
  temporaria = mkdtempSync(path.join(os.tmpdir(), "crm-migracao-e3-"));
  migracoesDa2B = path.join(temporaria, "migracoes-2b");
  prepararMigracoesAte(migracoesDa2B, 6);
  migracoesDaEtapa3 = path.join(temporaria, "migracoes-e3");
  prepararMigracoesAte(migracoesDaEtapa3, 7);
});

afterAll(() => {
  rmSync(temporaria, { recursive: true, force: true });
});

async function tabelasPublicas(banco: Banco): Promise<string[]> {
  const resultado = await banco.execute(
    sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  return (resultado.rows as { table_name: string }[]).map((r) => r.table_name);
}

async function conteudo(banco: Banco, tabela: string): Promise<string[]> {
  const resultado = await banco.execute(sql.raw(`select to_jsonb(t)::text as linha from ${tabela} t`));
  return (resultado.rows as { linha: string }[]).map((r) => r.linha).sort();
}

/** Dados fictícios no estado da Etapa 2B: cadastro, projeto, associação e avaliação V2.2 publicada. */
async function carregarDadosDa2B(banco: Banco) {
  const usuarioId = (await obterUsuarioAtual(banco)).id;
  const [{ id: comiteId }] = await banco.select({ id: comite.id }).from(comite).limit(1);
  await comoUsuario(banco, usuarioId, async (tx) => {
    const projetoTemaId = await projetos.criarProjetoTema(tx, { tipo: "projeto", nome: "Projeto Preservado Fictício", comiteId, situacao: "ativo" });
    const instituicaoId = await stakeholders.criarInstituicao(tx, { nome: "Instituição Preservada Fictícia", natureza: "empresa" });
    await stakeholders.criarPessoa(tx, { nomeCompleto: "Pessoa Preservada Fictícia" });
    await projetos.criarAssociacao(tx, { projetoTemaId, stakeholderId: instituicaoId, tipoRelacao: "parceiro" });
    const metodologiaId = await avaliacoes.criarMetodologia(tx, { ...METODOLOGIA_V22, nome: "V2.2 fictícia (preservação)" });
    await avaliacoes.alterarSituacaoMetodologia(tx, metodologiaId, "vigente");
    const versaoId = await avaliacoes.iniciarRascunho(tx, projetoTemaId, instituicaoId);
    await avaliacoes.salvarRascunho(
      tx,
      {
        versaoId,
        nivelPoder: "medio",
        justificativaPoder: "Exemplo fictício.",
        nivelInteresse: "alto",
        justificativaInteresse: "Exemplo fictício.",
        posicionamento: "favoravel",
        naturezaPosicionamento: "informacao_informal",
        justificativaPosicionamento: "Exemplo fictício.",
        justificativa: "Avaliação fictícia para o teste de preservação.",
        dataReferencia: "2026-10-30",
      },
      new Map(),
    );
    await avaliacoes.publicarRascunho(tx, versaoId);
  });
}

describe("Atualização de um banco da Etapa 2B (migração 0007)", () => {
  test("copia a pasta antes de atualizar; as tabelas anteriores ficam idênticas e as novas nascem vazias", async () => {
    const pasta = path.join(temporaria, "dados", "pglite");
    const antigo = await abrirBanco(pasta, { pastaMigracoes: migracoesDa2B });
    await carregarDadosDa2B(antigo);
    const tabelasAntes = await tabelasPublicas(antigo);
    expect(tabelasAntes).not.toContain("iniciativa");
    const antes = Object.fromEntries(await Promise.all(tabelasAntes.map(async (t) => [t, await conteudo(antigo, t)] as const)));
    expect(antes.avaliacao_versao.length).toBeGreaterThan(0);
    await fecharBanco(antigo);

    const atualizado = await abrirBanco(pasta, { pastaMigracoes: migracoesDaEtapa3 });
    try {
      const copias = readdirSync(path.join(temporaria, "dados", "copias"));
      expect(copias).toHaveLength(1);
      expect(copias[0]).toMatch(/^antes-migracao-/);

      const tabelasDepois = await tabelasPublicas(atualizado);
      expect(tabelasDepois).toEqual([...tabelasAntes, ...TABELAS_NOVAS].sort());
      for (const tabela of tabelasAntes) {
        expect(await conteudo(atualizado, tabela), tabela).toEqual(antes[tabela]);
      }
      for (const tabela of TABELAS_NOVAS) {
        expect(await conteudo(atualizado, tabela), tabela).toEqual([]);
      }
    } finally {
      await fecharBanco(atualizado);
    }
  }, 180_000);
});
