// @vitest-environment node
/**
 * Atualização de um banco da Etapa 4 para a Etapa 5 (migração 0009; D-074, requisito 10):
 * cópia de segurança antes, todas as tabelas anteriores idênticas linha a linha (o usuário ganha
 * só a coluna auth_id, vazia) e a autoria histórica preservada. Somente dados fictícios.
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { comIdentidade } from "@/lib/banco/identidade";
import { comite, projetoTema } from "@/lib/banco/esquema";
import { USUARIO_DESENVOLVIMENTO, obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import * as planos from "@/modulos/plano-acao/consultas";
import * as riscos from "@/modulos/riscos/consultas";
import * as stakeholders from "@/modulos/stakeholders/consultas";

const PASTA_MIGRACOES = path.join(process.cwd(), "src", "lib", "banco", "migracoes");
let temporaria: string;
let migracoesDaEtapa4: string;

/** Pasta só com as atualizações 0000 a 0008, para criar um banco no estado da Etapa 4. */
function prepararMigracoesDaEtapa4(destino: string) {
  mkdirSync(path.join(destino, "meta"), { recursive: true });
  const diario = JSON.parse(readFileSync(path.join(PASTA_MIGRACOES, "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  const entradas = diario.entries.filter((e) => e.idx <= 8);
  for (const e of entradas) cpSync(path.join(PASTA_MIGRACOES, `${e.tag}.sql`), path.join(destino, `${e.tag}.sql`));
  writeFileSync(path.join(destino, "meta", "_journal.json"), JSON.stringify({ ...diario, entries: entradas }));
}

beforeAll(() => {
  temporaria = mkdtempSync(path.join(os.tmpdir(), "crm-migracao-e5-"));
  migracoesDaEtapa4 = path.join(temporaria, "migracoes-e4");
  prepararMigracoesDaEtapa4(migracoesDaEtapa4);
});

afterAll(() => {
  rmSync(temporaria, { recursive: true, force: true });
});

async function tabelasPublicas(banco: Banco): Promise<string[]> {
  const resultado = await banco.execute(sql`select tablename from pg_tables where schemaname = 'public' order by tablename`);
  return (resultado.rows as { tablename: string }[]).map((l) => l.tablename);
}

async function conteudo(banco: Banco, tabela: string, semColunas: string[] = []) {
  const resultado = await banco.execute(sql.raw(`select * from "${tabela}" order by 1`));
  return (resultado.rows as Record<string, unknown>[]).map((linha) => {
    const copia = { ...linha };
    for (const coluna of semColunas) delete copia[coluna];
    return copia;
  });
}

async function carregarDadosDaEtapa4(banco: Banco) {
  const usuario = await obterUsuarioAtual(banco);
  const [comiteQualquer] = await banco.select({ id: comite.id }).from(comite).limit(1);
  await comoUsuario(banco, usuario.id, async (tx) => {
    const pessoaId = await stakeholders.criarPessoa(tx, { nomeCompleto: "Pessoa Fictícia da Migração", observacoes: "Observação fictícia." });
    await stakeholders.criarContato(tx, { stakeholderId: pessoaId, tipo: "email", valor: "ficticia@exemplo.invalid", natureza: "pessoal", principal: false });
    const [projeto] = await tx
      .insert(projetoTema)
      .values({ tipo: "projeto", nome: "Projeto Fictício", nomeNormalizado: "projeto ficticio", comiteId: comiteQualquer.id })
      .returning({ id: projetoTema.id });
    await planos.criarPlano(tx, { projetoTemaId: projeto.id, titulo: "Plano fictício", usarPilaresReferencia: false });
    await riscos.criarRisco(tx, {
      projetoTemaId: projeto.id,
      titulo: "Risco fictício",
      situacao: "aberto",
      probabilidade: 3,
      impacto: 4,
      dataAvaliacao: "2026-11-01",
      avaliadoPor: usuario.id,
      justificativa: "Justificativa fictícia.",
    });
  });
}

describe("Atualização de um banco da Etapa 4 (migração 0009)", () => {
  test("copia a pasta antes de atualizar; as tabelas ficam idênticas, a autoria é preservada e as regras passam a valer", async () => {
    const pasta = path.join(temporaria, "dados", "pglite");
    const antigo = await abrirBanco(pasta, { pastaMigracoes: migracoesDaEtapa4 });
    await carregarDadosDaEtapa4(antigo);
    const tabelasAntes = await tabelasPublicas(antigo);
    expect(tabelasAntes).toContain("risco");
    const antes = Object.fromEntries(await Promise.all(tabelasAntes.map(async (t) => [t, await conteudo(antigo, t)] as const)));
    expect(antes.plano_acao).toHaveLength(1);
    expect(antes.risco).toHaveLength(1);
    expect(antes.pessoa).toHaveLength(1);
    await fecharBanco(antigo);

    const atualizado = await abrirBanco(pasta);
    try {
      const copias = readdirSync(path.join(temporaria, "dados", "copias"));
      expect(copias).toHaveLength(1);
      expect(copias[0]).toMatch(/^antes-migracao-/);

      // Nenhuma tabela nova nem removida; todas as linhas idênticas.
      expect(await tabelasPublicas(atualizado)).toEqual(tabelasAntes);
      for (const tabela of tabelasAntes) {
        // A auditoria ganhou papel_banco na Fase 7A (migração 0010), vazio nos registros antigos.
        const semColunas = tabela === "usuario" ? ["auth_id"] : tabela === "registro_auditoria" ? ["papel_banco"] : [];
        expect(await conteudo(atualizado, tabela, semColunas), tabela).toEqual(antes[tabela]);
      }

      // Requisito 3: o administrador fictício segue como autor, sem identidade para entrar.
      const autores = await atualizado.execute(sql`select distinct criado_por from pessoa`);
      expect(autores.rows).toEqual([{ criado_por: USUARIO_DESENVOLVIMENTO.id }]);
      const conta = await atualizado.execute(sql`select auth_id from usuario where id = ${USUARIO_DESENVOLVIMENTO.id}`);
      expect(conta.rows).toEqual([{ auth_id: null }]);

      // As regras passam a valer sobre os dados que já existiam.
      const semIdentidade = comIdentidade(atualizado, null);
      expect((await semIdentidade.execute(sql`select id from pessoa`)).rows).toEqual([]);
      const comoAdministrador = comIdentidade(atualizado, USUARIO_DESENVOLVIMENTO.id);
      expect((await comoAdministrador.execute(sql`select id from pessoa`)).rows).toHaveLength(1);
      expect((await comoAdministrador.execute(sql`select id from plano_acao`)).rows).toHaveLength(1);
    } finally {
      await fecharBanco(atualizado);
    }
  }, 180_000);
});
