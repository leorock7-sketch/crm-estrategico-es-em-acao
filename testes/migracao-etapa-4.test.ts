// @vitest-environment node
/**
 * Atualização de um banco da Etapa 3 para a Etapa 4 (migração 0008): a pasta
 * de dados é copiada antes e todas as tabelas anteriores — cadastro, projetos,
 * avaliações, iniciativas, interações, compromissos e auditoria — continuam
 * idênticas, linha a linha; o compromisso ganha apenas a coluna acao_id, vazia.
 * As tabelas novas nascem vazias. Somente dados fictícios.
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { comite } from "@/lib/banco/esquema";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import * as iniciativas from "@/modulos/iniciativas/consultas";
import * as interacoes from "@/modulos/interacoes/consultas";
import * as projetos from "@/modulos/projetos-temas/consultas";
import * as stakeholders from "@/modulos/stakeholders/consultas";

const PASTA_MIGRACOES = path.join(process.cwd(), "src", "lib", "banco", "migracoes");
const TABELAS_NOVAS = [
  "plano_acao",
  "plano_eixo",
  "plano_acao_versao",
  "plano_acao_decisao",
  "acao",
  "acao_planejamento",
  "acao_marco",
  "marco_planejamento",
  "acao_acompanhamento",
  "acao_stakeholder",
  "risco",
  "risco_avaliacao",
  "risco_gatilho",
  "risco_gatilho_registro",
  "risco_resposta",
  "risco_stakeholder",
];
let temporaria: string;
let migracoesDaEtapa3: string;

/** Pasta só com as atualizações 0000 a 0007, para criar um banco no estado da Etapa 3. */
function prepararMigracoesDaEtapa3(destino: string) {
  mkdirSync(path.join(destino, "meta"), { recursive: true });
  const diario = JSON.parse(readFileSync(path.join(PASTA_MIGRACOES, "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  const entradas = diario.entries.filter((e) => e.idx <= 7);
  for (const e of entradas) cpSync(path.join(PASTA_MIGRACOES, `${e.tag}.sql`), path.join(destino, `${e.tag}.sql`));
  writeFileSync(path.join(destino, "meta", "_journal.json"), JSON.stringify({ ...diario, entries: entradas }));
}

beforeAll(() => {
  temporaria = mkdtempSync(path.join(os.tmpdir(), "crm-migracao-e4-"));
  migracoesDaEtapa3 = path.join(temporaria, "migracoes-e3");
  prepararMigracoesDaEtapa3(migracoesDaEtapa3);
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

/** Linhas da tabela; no compromisso, sem a coluna acrescentada pela Etapa 4. */
async function conteudo(banco: Banco, tabela: string, semColunas: string[] = []): Promise<string[]> {
  const remover = semColunas.map((c) => ` - '${c}'`).join("");
  const resultado = await banco.execute(sql.raw(`select (to_jsonb(t)${remover})::text as linha from ${tabela} t`));
  return (resultado.rows as { linha: string }[]).map((r) => r.linha).sort();
}

/** Dados fictícios no estado da Etapa 3: cadastro, projeto, iniciativa, interação e compromisso. */
async function carregarDadosDaEtapa3(banco: Banco) {
  const usuarioId = (await obterUsuarioAtual(banco)).id;
  const [{ id: comiteId }] = await banco.select({ id: comite.id }).from(comite).limit(1);
  await comoUsuario(banco, usuarioId, async (tx) => {
    const projetoTemaId = await projetos.criarProjetoTema(tx, { tipo: "projeto", nome: "Projeto Preservado Fictício", comiteId, situacao: "ativo" });
    const instituicaoId = await stakeholders.criarInstituicao(tx, { nome: "Instituição Preservada Fictícia", natureza: "empresa" });
    const iniciativaId = await iniciativas.criarIniciativa(tx, {
      tipo: "demanda",
      titulo: "Iniciativa preservada fictícia",
      situacao: "registrada",
      dataAbertura: "2026-10-30",
      projetos: [projetoTemaId],
    });
    const interacaoId = await interacoes.criarInteracao(tx, {
      tipo: "reuniao_presencial",
      assunto: "Reunião preservada fictícia",
      inicio: "2026-10-31T10:00",
      situacao: "realizada",
      projetos: [projetoTemaId],
      iniciativas: [iniciativaId],
      participantesExternos: [instituicaoId],
      participantesInternos: [usuarioId],
    });
    // Inserção direta: o esquema atual já tem a coluna acao_id, que o banco da Etapa 3 ainda não tem.
    const inserido = await tx.execute(sql`
      insert into compromisso (descricao, interacao_id, iniciativa_id, responsavel_stakeholder_id, prazo)
      values ('Compromisso preservado fictício.', ${interacaoId}, ${iniciativaId}, ${instituicaoId}, '2026-11-15')
      returning id`);
    const compromissoId = (inserido.rows[0] as { id: string }).id;
    await interacoes.registrarAcompanhamento(tx, { compromissoId, data: "2026-11-01", registro: "Acompanhamento fictício.", situacao: "em_andamento" });
  });
}

describe("Atualização de um banco da Etapa 3 (migração 0008)", () => {
  test("copia a pasta antes de atualizar; as tabelas anteriores ficam idênticas e as novas nascem vazias", async () => {
    const pasta = path.join(temporaria, "dados", "pglite");
    const antigo = await abrirBanco(pasta, { pastaMigracoes: migracoesDaEtapa3 });
    await carregarDadosDaEtapa3(antigo);
    const tabelasAntes = await tabelasPublicas(antigo);
    expect(tabelasAntes).toContain("compromisso");
    expect(tabelasAntes).not.toContain("plano_acao");
    const antes = Object.fromEntries(await Promise.all(tabelasAntes.map(async (t) => [t, await conteudo(antigo, t)] as const)));
    expect(antes.compromisso).toHaveLength(1);
    expect(antes.registro_auditoria.length).toBeGreaterThan(0);
    await fecharBanco(antigo);

    const atualizado = await abrirBanco(pasta);
    try {
      const copias = readdirSync(path.join(temporaria, "dados", "copias"));
      expect(copias).toHaveLength(1);
      expect(copias[0]).toMatch(/^antes-migracao-/);

      expect(await tabelasPublicas(atualizado)).toEqual([...tabelasAntes, ...TABELAS_NOVAS].sort());
      for (const tabela of tabelasAntes) {
        // O compromisso ganhou acao_id na Etapa 4; o usuário, auth_id na Etapa 5.
        const semColunas = tabela === "compromisso" ? ["acao_id"] : tabela === "usuario" ? ["auth_id"] : [];
        expect(await conteudo(atualizado, tabela, semColunas), tabela).toEqual(antes[tabela]);
      }
      const acoes = await atualizado.execute(sql`select acao_id from compromisso`);
      expect(acoes.rows).toEqual([{ acao_id: null }]);
      for (const tabela of TABELAS_NOVAS) {
        expect(await conteudo(atualizado, tabela), tabela).toEqual([]);
      }
    } finally {
      await fecharBanco(atualizado);
    }
  }, 180_000);
});
