/**
 * P-071, E3 — painéis com dados mudando durante a carga, no PostgreSQL do Supabase (dados fictícios).
 *
 * A carga dos painéis passou de uma transação para quatro transações paralelas. Este teste confere:
 * 1. as transações da aplicação usam READ COMMITTED: cada consulta já via o seu próprio instante também
 *    na transação única, de modo que a divisão não reduz a consistência entre as leituras;
 * 2. cargas simultâneas à inclusão e ao arquivamento de uma iniciativa fictícia não falham, e cada uma
 *    vê a iniciativa inteira (com o seu projeto) ou não a vê, sem estado intermediário;
 * 3. depois do arquivamento, a carga volta a ser idêntica à anterior.
 * Grava só uma iniciativa fictícia, arquivada no fim (nada é excluído).
 */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { abrirBancoPostgres, type Banco, comoUsuario, fecharBanco } from "@/lib/banco/conexao";
import { comIdentidade } from "@/lib/banco/identidade";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { criarIniciativa, definirArquivamentoIniciativa } from "@/modulos/iniciativas/consultas";
import { carregarDadosDoPainel } from "@/modulos/paineis/dados";

let administrativo: Banco;
let aplicacao: Banco;
let administradorId: string;
let projetoId: string;

beforeAll(async () => {
  administrativo = abrirBancoPostgres(process.env.CRM_BANCO_ADMIN_URL as string, { max: 2 });
  aplicacao = abrirBancoPostgres(process.env.CRM_BANCO_URL as string, { max: 5 });
  const [usuario] = (await administrativo.execute(
    sql`select id::text as id from usuario where administrador and situacao = 'ativo' and auth_id is not null order by criado_em limit 1`,
  )) as unknown as { id: string }[];
  const [projeto] = (await administrativo.execute(
    sql`select id::text as id from projeto_tema where arquivado_em is null order by criado_em limit 1`,
  )) as unknown as { id: string }[];
  administradorId = usuario.id;
  projetoId = projeto.id;
});

afterAll(async () => {
  await fecharBanco(administrativo);
  await fecharBanco(aplicacao);
});

test("as transações da aplicação usam READ COMMITTED", async () => {
  const banco = comIdentidade(aplicacao, administradorId);
  const resultado = await banco.transaction((tx) => tx.execute(sql`show transaction_isolation`));
  expect((resultado as unknown as { transaction_isolation: string }[])[0].transaction_isolation).toBe("read committed");
});

test("cargas simultâneas a inclusão e arquivamento: sem falhas nem estado intermediário; depois, idêntica", async () => {
  const banco = comIdentidade(aplicacao, administradorId);
  const hoje = hojeEmBrasilia();
  const antes = await carregarDadosDoPainel(banco, hoje);
  const titulo = `Iniciativa de concorrência P-071 ${randomUUID().slice(0, 8)}`;
  let novaId = "";
  const escritor = (async () => {
    await new Promise((r) => setTimeout(r, 200));
    novaId = await comoUsuario(administrativo, administradorId, (tx) =>
      criarIniciativa(tx, { tipo: "demanda", titulo, situacao: "em_andamento", dataAbertura: hoje, projetos: [projetoId] } as never),
    );
    await new Promise((r) => setTimeout(r, 1200));
    await comoUsuario(administrativo, administradorId, (tx) => definirArquivamentoIniciativa(tx, novaId, true));
  })();
  const atrasos = [0, 300, 700, 1100, 1600, 2200];
  const cargas = atrasos.map(async (ms) => {
    await new Promise((r) => setTimeout(r, ms));
    return carregarDadosDoPainel(banco, hoje);
  });
  const [, ...resultados] = await Promise.all([escritor, ...cargas]);
  for (const r of resultados) {
    const nova = r.iniciativas.filter((i) => i.titulo === titulo);
    expect(r.iniciativas.length - antes.iniciativas.length).toBe(nova.length);
    expect(nova.length).toBeLessThanOrEqual(1);
    // Vista, é vista inteira: com o projeto ao qual foi ligada na mesma transação de inclusão.
    for (const i of nova) expect(i.projetos).toEqual([projetoId]);
  }
  const depois = await carregarDadosDoPainel(banco, hoje);
  expect(depois).toEqual(antes);
  expect(novaId).not.toBe("");
});
