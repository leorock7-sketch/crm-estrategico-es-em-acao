/**
 * Regras de acesso (RLS) comprovadas por consultas de verdade, no contexto de cada usuário.
 * O mesmo conjunto roda em dois bancos: PGlite (seguranca-etapa-5.test.ts, a cada Pull Request)
 * e PostgreSQL do Supabase (seguranca-supabase.test.ts, com as chaves locais). Assim, nada
 * aqui depende de simulação: as consultas passam pelo papel crm_app e pelas regras do banco.
 *
 * Somente dados fictícios. Cada execução usa nomes próprios, para não colidir com outras.
 */
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { type Banco, comoUsuario } from "@/lib/banco/conexao";
import {
  contato,
  pessoa,
  permissaoContexto,
  planoAcaoVersao,
  projetoTema,
  registroAuditoria,
  stakeholderContexto,
  usuario,
} from "@/lib/banco/esquema";
import { comIdentidade } from "@/lib/banco/identidade";
import { erroDoBanco } from "@/lib/banco/erros";
import { ehAdministrador, podeDecidirNoProjeto, podeEditarNoProjeto, podeRegistrarNoCadastro, podeVerDadosRestritos } from "@/modulos/acesso/capacidades";
import { criarIniciativa, listarIniciativas, obterIniciativa } from "@/modulos/iniciativas/consultas";
import { criarInteracao, incluirIniciativaNaInteracao } from "@/modulos/interacoes/consultas";
import * as planos from "@/modulos/plano-acao/consultas";
import { criarContato, criarPessoa, historicoDoStakeholder, listarContatos, listarPessoas, obterPessoa } from "@/modulos/stakeholders/consultas";

type Perfil = "gestor" | "colaborador" | "leitor";

export type Ambiente = {
  /** Conexão privilegiada, só para montar o cenário e conferir resultados. */
  administrativo: Banco;
  /** Conexão-base que a aplicação usaria: as operações passam por comIdentidade(). */
  aplicacao: Banco;
};

async function codigoDaFalha(operacao: Promise<unknown>): Promise<string> {
  try {
    await operacao;
    return "sem falha";
  } catch (erro) {
    return erroDoBanco(erro)?.code ?? "erro desconhecido";
  }
}

export function regrasDeAcesso(obterAmbiente: () => Ambiente) {
  const sufixo = randomUUID().slice(0, 8);
  let adm: Banco;
  let app: Banco;
  const u = {} as Record<
    "administrador" | "gestorA" | "colaboradorA" | "leitorA" | "gestorB" | "vencido" | "revogado" | "inativo" | "semPermissao",
    string
  >;
  let projetoA: string;
  let projetoB: string;
  let pessoaEmA: string;
  let pessoaEmB: string;
  let contatoPessoalEmA: string;

  const como = (usuarioId: string | null) => comIdentidade(app, usuarioId);

  async function novoUsuario(nome: string, extra: Partial<typeof usuario.$inferInsert> = {}) {
    const [linha] = await adm
      .insert(usuario)
      .values({ nome: `${nome} ${sufixo}`, email: `${nome}.${sufixo}@exemplo.invalid`.toLowerCase(), ...extra })
      .returning({ id: usuario.id });
    return linha.id;
  }

  async function conceder(usuarioId: string, projetoId: string, perfil: Perfil, validaAte: string | null = null) {
    await adm.insert(permissaoContexto).values({ usuarioId, projetoTemaId: projetoId, perfil, validaAte });
  }

  beforeAll(async () => {
    ({ administrativo: adm, aplicacao: app } = obterAmbiente());

    u.administrador = await novoUsuario("Administradora", { administrador: true });
    u.gestorA = await novoUsuario("GestorA");
    u.colaboradorA = await novoUsuario("ColaboradorA");
    u.leitorA = await novoUsuario("LeitorA");
    u.gestorB = await novoUsuario("GestorB");
    u.vencido = await novoUsuario("Vencido");
    u.revogado = await novoUsuario("Revogado");
    u.inativo = await novoUsuario("Inativo");
    u.semPermissao = await novoUsuario("SemPermissao");

    const [comite] = (await adm.execute(sql`select id from comite order by nome limit 1`)).rows as { id: string }[];
    const projeto = async (nome: string) => {
      const [linha] = await adm
        .insert(projetoTema)
        .values({ tipo: "projeto", nome: `${nome} ${sufixo}`, nomeNormalizado: `${nome} ${sufixo}`.toLowerCase(), comiteId: comite.id })
        .returning({ id: projetoTema.id });
      return linha.id;
    };
    projetoA = await projeto("Projeto A");
    projetoB = await projeto("Projeto B");

    await conceder(u.gestorA, projetoA, "gestor");
    await conceder(u.colaboradorA, projetoA, "colaborador");
    await conceder(u.leitorA, projetoA, "leitor");
    await conceder(u.gestorB, projetoB, "gestor");
    await conceder(u.vencido, projetoA, "gestor", "2020-01-01");
    await conceder(u.revogado, projetoA, "colaborador");
    await conceder(u.inativo, projetoA, "gestor");
    await adm.update(permissaoContexto).set({ arquivadoEm: new Date() }).where(eq(permissaoContexto.usuarioId, u.revogado));
    await adm.update(usuario).set({ situacao: "inativo" }).where(eq(usuario.id, u.inativo));

    await comoUsuario(adm, u.administrador, async (tx) => {
      pessoaEmA = await criarPessoa(tx, { nomeCompleto: `Pessoa em A ${sufixo}`, observacoes: `Observação restrita A ${sufixo}` });
      pessoaEmB = await criarPessoa(tx, { nomeCompleto: `Pessoa em B ${sufixo}`, observacoes: `Observação restrita B ${sufixo}` });
      await tx.insert(stakeholderContexto).values([
        { stakeholderId: pessoaEmA, projetoTemaId: projetoA, tipoRelacao: "parceiro" },
        { stakeholderId: pessoaEmB, projetoTemaId: projetoB, tipoRelacao: "parceiro" },
      ]);
      contatoPessoalEmA = await criarContato(tx, {
        stakeholderId: pessoaEmA,
        tipo: "email",
        valor: `pessoal.${sufixo}@exemplo.invalid`,
        natureza: "pessoal",
        principal: false,
        observacao: `Nota do contato ${sufixo}`,
      });
      await criarContato(tx, {
        stakeholderId: pessoaEmA,
        tipo: "email",
        valor: `institucional.${sufixo}@exemplo.invalid`,
        natureza: "institucional",
        principal: false,
      });
    });
  });

  describe("Requisito 5: regras no banco, no caminho real da aplicação", () => {
    test("toda tabela de dados tem RLS ligado e forçado, e ao menos uma regra (falha se surgir tabela nova sem regra)", async () => {
      const tabelas = (
        await adm.execute(sql`
          select c.relname as tabela, c.relrowsecurity as ligado, c.relforcerowsecurity as forcado,
            (select count(*)::int from pg_policy p where p.polrelid = c.oid) as regras
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'`)
      ).rows as { tabela: string; ligado: boolean; forcado: boolean; regras: number }[];
      expect(tabelas.length).toBeGreaterThanOrEqual(44);
      expect(tabelas.filter((t) => !t.ligado || !t.forcado || t.regras === 0).map((t) => t.tabela)).toEqual([]);
    });

    test("o papel crm_app não é superusuário, não tem BYPASSRLS, não é dono das tabelas e não exclui", async () => {
      const [papel] = (
        await adm.execute(sql`select rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles where rolname = 'crm_app'`)
      ).rows as Record<string, boolean>[];
      expect(papel).toEqual({ rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false });
      const donas = (
        await adm.execute(sql`select tablename from pg_tables where schemaname = 'public' and tableowner = 'crm_app'`)
      ).rows;
      expect(donas).toEqual([]);
      const comExclusao = (
        await adm.execute(sql`
          select table_name from information_schema.role_table_grants
          where grantee = 'crm_app' and table_schema = 'public' and privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')`)
      ).rows;
      expect(comExclusao).toEqual([]);
    });

    test("o banco da aplicação realmente opera como crm_app, sem contornar as regras", async () => {
      const [linha] = (await como(u.leitorA).execute(sql`select current_user as papel`)).rows as { papel: string }[];
      expect(linha.papel).toBe("crm_app");
    });

    test("sem identidade na transação, as consultas devolvem zero linhas e as gravações são recusadas", async () => {
      const semIdentidade = como(null);
      expect(await semIdentidade.select({ id: projetoTema.id }).from(projetoTema)).toEqual([]);
      expect(await semIdentidade.select({ id: pessoa.id }).from(pessoa)).toEqual([]);
      expect(await semIdentidade.select({ id: usuario.id }).from(usuario)).toEqual([]);
      expect(await semIdentidade.select({ id: registroAuditoria.id }).from(registroAuditoria)).toEqual([]);
      expect(await codigoDaFalha(semIdentidade.insert(pessoa).values({ id: randomUUID(), nomeCompleto: "X", nomeNormalizado: "x" }))).toBe("42501");
    });

    test("identidade que não corresponde a nenhum usuário equivale a não ter identidade", async () => {
      const inexistente = como(randomUUID());
      expect(await inexistente.select({ id: pessoa.id }).from(pessoa)).toEqual([]);
      expect(await inexistente.select({ id: projetoTema.id }).from(projetoTema)).toEqual([]);
    });

    test("consulta direta por perfil devolve só os projetos e temas permitidos", async () => {
      const visiveis = async (id: string) =>
        (await como(id).select({ id: projetoTema.id }).from(projetoTema)).map((p) => p.id);
      expect(await visiveis(u.gestorA)).toContain(projetoA);
      expect(await visiveis(u.gestorA)).not.toContain(projetoB);
      expect(await visiveis(u.leitorA)).toContain(projetoA);
      expect(await visiveis(u.leitorA)).not.toContain(projetoB);
      expect(await visiveis(u.semPermissao)).toEqual([]);
      const doAdministrador = await visiveis(u.administrador);
      expect(doAdministrador).toEqual(expect.arrayContaining([projetoA, projetoB]));
    });

    test("os gatilhos de auditoria e de integridade continuam funcionando sob as regras", async () => {
      const id = await comoUsuario(como(u.gestorA), u.gestorA, (tx) =>
        criarPessoa(tx, { nomeCompleto: `Pessoa da auditoria ${sufixo}` }, { incluirObservacoes: false }),
      );
      const [auditoria] = await adm
        .select({ usuarioId: registroAuditoria.usuarioId, operacao: registroAuditoria.operacao })
        .from(registroAuditoria)
        .where(and(eq(registroAuditoria.tabela, "pessoa"), eq(registroAuditoria.registroId, id)));
      expect(auditoria).toEqual({ usuarioId: u.gestorA, operacao: "inclusao" });
      const falha = await codigoDaFalha(comoUsuario(como(u.gestorA), u.gestorA, (tx) => tx.update(pessoa).set({ nomeCompleto: " " }).where(eq(pessoa.id, id))));
      expect(falha).toBe("23514");
    });

    test("a trilha de auditoria não aceita gravação direta da aplicação", async () => {
      const administrador = como(u.administrador);
      expect(
        await codigoDaFalha(
          administrador.insert(registroAuditoria).values({ tabela: "pessoa", registroId: randomUUID(), operacao: "inclusao" }),
        ),
      ).toBe("42501");
      expect(await codigoDaFalha(administrador.execute(sql`delete from registro_auditoria`))).toBe("42501");
    });

    test("a aplicação não exclui registros nem com perfil de administrador", async () => {
      expect(await codigoDaFalha(como(u.administrador).execute(sql`delete from contato where id = ${contatoPessoalEmA}`))).toBe("42501");
    });
  });

  describe("Requisito 4: revogação e desativação com bloqueio efetivo", () => {
    test("permissão vencida não dá acesso", async () => {
      expect(await como(u.vencido).select({ id: projetoTema.id }).from(projetoTema)).toEqual([]);
    });

    test("permissão revogada não dá acesso", async () => {
      expect(await como(u.revogado).select({ id: projetoTema.id }).from(projetoTema)).toEqual([]);
    });

    test("usuário inativo não lê nem grava, nem o diretório básico", async () => {
      const inativo = como(u.inativo);
      expect(await inativo.select({ id: pessoa.id }).from(pessoa)).toEqual([]);
      expect(await inativo.select({ id: projetoTema.id }).from(projetoTema)).toEqual([]);
      expect(await podeRegistrarNoCadastro(inativo)).toBe(false);
      expect(await codigoDaFalha(inativo.insert(pessoa).values({ id: randomUUID(), nomeCompleto: "X", nomeNormalizado: "x" }))).toBe("42501");
    });

    test("com a mesma conexão aberta, revogar bloqueia na consulta seguinte e conceder volta a valer", async () => {
      const id = await novoUsuario("Temporario");
      await conceder(id, projetoA, "leitor");
      const sessaoAberta = como(id);
      expect((await sessaoAberta.select({ id: projetoTema.id }).from(projetoTema)).map((p) => p.id)).toEqual([projetoA]);
      await adm.update(permissaoContexto).set({ arquivadoEm: new Date() }).where(eq(permissaoContexto.usuarioId, id));
      expect(await sessaoAberta.select({ id: projetoTema.id }).from(projetoTema)).toEqual([]);
    });

    test("com a mesma conexão aberta, desativar bloqueia na consulta seguinte", async () => {
      const id = await novoUsuario("Desativado");
      await conceder(id, projetoA, "gestor");
      const sessaoAberta = como(id);
      expect((await sessaoAberta.select({ id: pessoa.id }).from(pessoa)).length).toBeGreaterThan(0);
      await adm.update(usuario).set({ situacao: "inativo" }).where(eq(usuario.id, id));
      expect(await sessaoAberta.select({ id: pessoa.id }).from(pessoa)).toEqual([]);
      expect(await sessaoAberta.select({ id: projetoTema.id }).from(projetoTema)).toEqual([]);
    });
  });

  describe("Requisito 2: correspondência entre identidade e usuário interno", () => {
    const identificar = async (authId: string) =>
      (await como(null).execute(sql`select * from identificar_usuario(${authId}::uuid)`)).rows as { id: string; situacao: string }[];

    test("a identidade liga-se ao usuário interno por auth_id, único", async () => {
      const authId = randomUUID();
      const id = await novoUsuario("ComConta", { authId });
      expect((await identificar(authId)).map((l) => l.id)).toEqual([id]);
      expect(await codigoDaFalha(novoUsuario("Duplicado", { authId }))).toBe("23505");
    });

    test("conta autenticada sem cadastro interno não é identificada", async () => {
      expect(await identificar(randomUUID())).toEqual([]);
    });

    test("usuário com o mesmo e-mail, sem vínculo por auth_id, não herda acesso", async () => {
      const email = `mesmo.${sufixo}@exemplo.invalid`;
      await novoUsuario("MesmoEmail", { email });
      const contaDoMesmoEmail = randomUUID();
      expect(await identificar(contaDoMesmoEmail)).toEqual([]);
    });

    test("usuário inativo é identificado como inativo, para ser recusado", async () => {
      const authId = randomUUID();
      await novoUsuario("InativoComConta", { authId, situacao: "inativo" });
      expect((await identificar(authId))[0].situacao).toBe("inativo");
    });
  });

  describe("Requisito 3: autoria histórica", () => {
    test("usuário sem auth_id, como o administrador fictício, não tem como ser identificado", async () => {
      const [resultado] = (await adm.execute(sql`select count(*)::int as n from usuario where auth_id is null`)).rows as { n: number }[];
      expect(resultado.n).toBeGreaterThan(0);
      const nulo = (await como(null).execute(sql`select * from identificar_usuario(null)`)).rows;
      expect(nulo).toEqual([]);
    });

    test("novas inclusões registram o usuário autenticado, e a alteração registra quem alterou", async () => {
      const id = await comoUsuario(como(u.colaboradorA), u.colaboradorA, (tx) =>
        criarPessoa(tx, { nomeCompleto: `Pessoa da colaboradora ${sufixo}` }, { incluirObservacoes: false }),
      );
      await comoUsuario(como(u.gestorA), u.gestorA, (tx) => tx.update(pessoa).set({ nomeTratamento: "Alterado" }).where(eq(pessoa.id, id)));
      const [linha] = await adm
        .select({ criadoPor: pessoa.criadoPor, atualizadoPor: pessoa.atualizadoPor })
        .from(pessoa)
        .where(eq(pessoa.id, id));
      expect(linha).toEqual({ criadoPor: u.colaboradorA, atualizadoPor: u.gestorA });
    });
  });

  describe("Requisito 9: matriz de perfis", () => {
    const capacidadesEmA = async (id: string) => {
      const b = como(id);
      return {
        ver: (await b.select({ id: projetoTema.id }).from(projetoTema).where(eq(projetoTema.id, projetoA))).length === 1,
        editar: await podeEditarNoProjeto(b, projetoA),
        decidir: await podeDecidirNoProjeto(b, projetoA),
        cadastro: await podeRegistrarNoCadastro(b),
        administrar: await ehAdministrador(b),
      };
    };

    test("administrador: acesso integral, inclusive usuários e permissões", async () => {
      expect(await capacidadesEmA(u.administrador)).toEqual({ ver: true, editar: true, decidir: true, cadastro: true, administrar: true });
      const b = como(u.administrador);
      await b.update(usuario).set({ nome: `Renomeado ${sufixo}` }).where(eq(usuario.id, u.semPermissao));
      const [linha] = await adm.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, u.semPermissao));
      expect(linha.nome).toBe(`Renomeado ${sufixo}`);
    });

    test("gestor: consulta, registra, altera e decide só nos seus projetos ou temas", async () => {
      expect(await capacidadesEmA(u.gestorA)).toEqual({ ver: true, editar: true, decidir: true, cadastro: true, administrar: false });
      expect(await capacidadesEmA(u.gestorB)).toEqual({ ver: false, editar: false, decidir: false, cadastro: true, administrar: false });
    });

    test("colaborador: consulta, registra e altera nos contextos autorizados, sem decidir", async () => {
      expect(await capacidadesEmA(u.colaboradorA)).toEqual({ ver: true, editar: true, decidir: false, cadastro: true, administrar: false });
    });

    test("leitor: somente consulta", async () => {
      expect(await capacidadesEmA(u.leitorA)).toEqual({ ver: true, editar: false, decidir: false, cadastro: false, administrar: false });
    });

    test("permissão vencida, revogada, usuário inativo e sem permissão: nada", async () => {
      const nada = { ver: false, editar: false, decidir: false, cadastro: false, administrar: false };
      for (const id of [u.vencido, u.revogado, u.inativo, u.semPermissao]) {
        expect(await capacidadesEmA(id)).toEqual(nada);
      }
    });

    test("leitor não grava, inclusive por comando direto: a alteração não atinge nenhuma linha", async () => {
      const b = como(u.leitorA);
      await b.update(projetoTema).set({ descricao: "Alterado pelo leitor" }).where(eq(projetoTema.id, projetoA));
      const [linha] = await adm.select({ descricao: projetoTema.descricao }).from(projetoTema).where(eq(projetoTema.id, projetoA));
      expect(linha.descricao).toBeNull();
      expect(await codigoDaFalha(b.insert(pessoa).values({ id: randomUUID(), nomeCompleto: "Leitor", nomeNormalizado: "leitor" }))).toBe("42501");
    });

    test("usuário comum não administra usuários nem permissões, inclusive informando o identificador", async () => {
      const b = como(u.gestorA);
      await b.update(usuario).set({ administrador: true }).where(eq(usuario.id, u.gestorA));
      const [linha] = await adm.select({ administrador: usuario.administrador }).from(usuario).where(eq(usuario.id, u.gestorA));
      expect(linha.administrador).toBe(false);
      expect(await codigoDaFalha(b.insert(permissaoContexto).values({ usuarioId: u.gestorA, projetoTemaId: projetoB, perfil: "gestor" }))).toBe("42501");
      expect(await codigoDaFalha(b.insert(usuario).values({ nome: "Novo", email: `novo.${sufixo}@exemplo.invalid` }))).toBe("42501");
    });

    test("cada um só vê as próprias permissões; o administrador vê todas", async () => {
      const doGestor = await como(u.gestorA).select({ usuarioId: permissaoContexto.usuarioId }).from(permissaoContexto);
      expect(new Set(doGestor.map((p) => p.usuarioId))).toEqual(new Set([u.gestorA]));
      const doAdministrador = await como(u.administrador).select({ usuarioId: permissaoContexto.usuarioId }).from(permissaoContexto);
      expect(doAdministrador.map((p) => p.usuarioId)).toEqual(expect.arrayContaining([u.gestorA, u.leitorA, u.gestorB]));
    });

    test("o sistema não fica sem administrador ativo por operação da aplicação", async () => {
      const [outros] = (await adm.execute(sql`select count(*)::int as n from usuario where administrador and situacao = 'ativo'`)).rows as { n: number }[];
      if (outros.n === 1) {
        const falha = await codigoDaFalha(como(u.administrador).update(usuario).set({ situacao: "inativo" }).where(eq(usuario.id, u.administrador)));
        expect(falha).toBe("P0001");
      } else {
        expect(outros.n).toBeGreaterThan(1);
      }
    });
  });

  describe("Requisito 6: decisão sobre versões do plano (D3)", () => {
    let planoId: string;
    let versaoId: string;

    const enviar = async (id: string) => {
      const b = como(id);
      await comoUsuario(b, id, (tx) => planos.enviarParaAprovacao(tx, versaoId, "Motivo fictício."));
    };

    beforeAll(async () => {
      const gestor = como(u.gestorA);
      planoId = await comoUsuario(gestor, u.gestorA, (tx) =>
        planos.criarPlano(tx, { projetoTemaId: projetoA, titulo: `Plano ${sufixo}`, objetivo: "Fictício", usarPilaresReferencia: false }),
      );
      [{ id: versaoId }] = await adm
        .select({ id: planoAcaoVersao.id })
        .from(planoAcaoVersao)
        .where(eq(planoAcaoVersao.planoAcaoId, planoId));
      await comoUsuario(gestor, u.gestorA, (tx) =>
        planos.incluirAcaoNaVersao(tx, { versaoId, titulo: "Ação fictícia", responsavelUsuarioId: u.gestorA }),
      );
    });

    test("colaborador envia, mas não decide; leitor não envia; gestor de outro projeto não decide", async () => {
      await enviar(u.colaboradorA);
      const situacao = async () =>
        (await adm.select({ s: planoAcaoVersao.situacao }).from(planoAcaoVersao).where(eq(planoAcaoVersao.id, versaoId)))[0].s;
      expect(await situacao()).toBe("em_aprovacao");

      const decidirComo = (id: string, decisao: "aprovada" | "rejeitada" | "devolvida") =>
        comoUsuario(como(id), id, (tx) => planos.decidirVersao(tx, versaoId, decisao, "Parecer fictício."));

      expect(await codigoDaFalha(decidirComo(u.colaboradorA, "aprovada"))).toBe("42501");
      expect(await situacao()).toBe("em_aprovacao");
      expect(await codigoDaFalha(decidirComo(u.colaboradorA, "devolvida"))).toBe("42501");
      expect(await situacao()).toBe("em_aprovacao");
      await decidirComo(u.leitorA, "aprovada").catch(() => {});
      expect(await situacao()).toBe("em_aprovacao");
      await decidirComo(u.gestorB, "aprovada").catch(() => {});
      expect(await situacao()).toBe("em_aprovacao");
    });

    test("gestor do projeto aprova; a decisão registra o responsável e a data", async () => {
      await comoUsuario(como(u.gestorA), u.gestorA, (tx) => planos.decidirVersao(tx, versaoId, "aprovada", "Aprovado."));
      const [linha] = await adm
        .select({ s: planoAcaoVersao.situacao, por: planoAcaoVersao.decididaPor, em: planoAcaoVersao.decididaEm })
        .from(planoAcaoVersao)
        .where(eq(planoAcaoVersao.id, versaoId));
      expect(linha.s).toBe("aprovada");
      expect(linha.por).toBe(u.gestorA);
      expect(linha.em).toBeInstanceOf(Date);
      expect(planoId).toBeTruthy();
    });
  });

  describe("Requisito 7: registros compartilhados entre projetos ou temas", () => {
    let compartilhada: string;
    let soDeB: string;

    beforeAll(async () => {
      await comoUsuario(adm, u.administrador, async (tx) => {
        compartilhada = await criarIniciativa(tx, {
          titulo: `Iniciativa de A e B ${sufixo}`,
          tipo: "demanda",
          prioridade: "media",
          situacao: "registrada",
          dataAbertura: "2026-01-01",
          projetos: [projetoA, projetoB],
        });
        soDeB = await criarIniciativa(tx, {
          titulo: `Iniciativa só de B ${sufixo}`,
          tipo: "demanda",
          prioridade: "media",
          situacao: "registrada",
          dataAbertura: "2026-01-01",
          projetos: [projetoB],
        });
      });
    });

    const titulos = async (id: string) =>
      (await como(id).execute(sql`select titulo from iniciativa where titulo like ${`%${sufixo}`}`)).rows.map((l) => (l as { titulo: string }).titulo);

    test("quem tem A vê a iniciativa compartilhada, mas não a ligação com B", async () => {
      expect(await titulos(u.leitorA)).toEqual([`Iniciativa de A e B ${sufixo}`]);
      const ligacoes = (
        await como(u.leitorA).execute(sql`select projeto_tema_id from iniciativa_projeto_tema where iniciativa_id = ${compartilhada}`)
      ).rows as { projeto_tema_id: string }[];
      expect(ligacoes.map((l) => l.projeto_tema_id)).toEqual([projetoA]);
    });

    test("quem não tem A nem B não vê o registro", async () => {
      expect(await titulos(u.semPermissao)).toEqual([]);
      expect(await como(u.semPermissao).execute(sql`select 1 from iniciativa_projeto_tema where iniciativa_id = ${compartilhada}`).then((r) => r.rows)).toEqual([]);
    });

    test("interação em A ligada a iniciativa só de B: quem só tem A vê a reunião, não a iniciativa de B", async () => {
      let interacaoId = "";
      await comoUsuario(adm, u.administrador, async (tx) => {
        interacaoId = await criarInteracao(tx, {
          assunto: `Reunião ${sufixo}`,
          tipo: "reuniao_virtual",
          situacao: "realizada",
          inicio: "2026-01-02T10:00",
          projetos: [projetoA],
          iniciativas: [],
          participantesExternos: [],
          participantesInternos: [],
        });
        await incluirIniciativaNaInteracao(tx, { interacaoId, iniciativaId: soDeB });
      });
      const b = como(u.leitorA);
      const reunioes = (await b.execute(sql`select id from interacao where id = ${interacaoId}`)).rows;
      expect(reunioes).toHaveLength(1);
      const ligadas = (await b.execute(sql`select iniciativa_id from interacao_iniciativa where interacao_id = ${interacaoId}`)).rows;
      expect(ligadas).toEqual([]);
      const projetos = (await b.execute(sql`select projeto_tema_id from interacao_projeto_tema where interacao_id = ${interacaoId}`)).rows as { projeto_tema_id: string }[];
      expect(projetos.map((p) => p.projeto_tema_id)).toEqual([projetoA]);
    });

    test("retirar a ligação com A não remove nem revela a ligação com B", async () => {
      const iniciativaTemporaria = await comoUsuario(adm, u.administrador, (tx) =>
        criarIniciativa(tx, {
          titulo: `Temporária ${sufixo}`,
          tipo: "demanda",
          prioridade: "media",
          situacao: "registrada",
          dataAbertura: "2026-01-01",
          projetos: [projetoA, projetoB],
        }),
      );
      await comoUsuario(como(u.gestorA), u.gestorA, (tx) =>
        tx.execute(sql`update iniciativa_projeto_tema set arquivado_em = now() where iniciativa_id = ${iniciativaTemporaria} and projeto_tema_id = ${projetoA}`),
      );
      const restantes = (
        await adm.execute(sql`select projeto_tema_id from iniciativa_projeto_tema where iniciativa_id = ${iniciativaTemporaria} and arquivado_em is null`)
      ).rows as { projeto_tema_id: string }[];
      expect(restantes.map((r) => r.projeto_tema_id)).toEqual([projetoB]);
      expect((await como(u.gestorA).execute(sql`select id from iniciativa where id = ${iniciativaTemporaria}`)).rows).toEqual([]);
    });

    test("usuário de A não retira nem altera a ligação com B, informando o identificador", async () => {
      await comoUsuario(como(u.gestorA), u.gestorA, (tx) =>
        tx.execute(sql`update iniciativa_projeto_tema set arquivado_em = now() where iniciativa_id = ${compartilhada} and projeto_tema_id = ${projetoB}`),
      );
      const ligacoes = (
        await adm.execute(sql`select projeto_tema_id from iniciativa_projeto_tema where iniciativa_id = ${compartilhada} and arquivado_em is null`)
      ).rows as { projeto_tema_id: string }[];
      expect(ligacoes.map((l) => l.projeto_tema_id).sort()).toEqual([projetoA, projetoB].sort());
    });

    test("as consultas da aplicação respeitam o mesmo limite", async () => {
      const b = como(u.leitorA);
      expect(await obterIniciativa(b, soDeB)).toBeNull();
      expect(await obterIniciativa(b, compartilhada)).not.toBeNull();
      const lista = await listarIniciativas(b);
      expect(lista.map((i) => i.id)).not.toContain(soDeB);
    });
  });

  describe("Decisão D4 e P-054: diretório básico e dados restritos", () => {
    const valores = async (id: string) => (await listarContatos(como(id), pessoaEmA)).map((c) => c.valor);

    test("todos os perfis ativos consultam o diretório: nomes e contatos institucionais", async () => {
      for (const id of [u.administrador, u.gestorA, u.colaboradorA, u.leitorA, u.gestorB, u.semPermissao]) {
        const lista = await listarPessoas(como(id), {});
        expect(lista.map((p) => p.id)).toContain(pessoaEmA);
        expect(await valores(id)).toContain(`institucional.${sufixo}@exemplo.invalid`);
      }
    });

    test("contatos pessoais: administrador e gestor ou colaborador do contexto associado", async () => {
      const pessoal = `pessoal.${sufixo}@exemplo.invalid`;
      expect(await valores(u.administrador)).toContain(pessoal);
      expect(await valores(u.gestorA)).toContain(pessoal);
      expect(await valores(u.colaboradorA)).toContain(pessoal);
    });

    test("leitor, gestor de outro projeto e usuário sem permissão não veem contatos pessoais", async () => {
      const pessoal = `pessoal.${sufixo}@exemplo.invalid`;
      for (const id of [u.leitorA, u.gestorB, u.semPermissao]) {
        expect(await valores(id)).not.toContain(pessoal);
        expect(await podeVerDadosRestritos(como(id), pessoaEmA)).toBe(false);
      }
    });

    test("observações: quem não pode vê-las recebe vazio, e a coluna não pode ser lida diretamente", async () => {
      expect((await obterPessoa(como(u.gestorA), pessoaEmA))?.observacoes).toBe(`Observação restrita A ${sufixo}`);
      expect((await obterPessoa(como(u.leitorA), pessoaEmA))?.observacoes).toBeNull();
      expect((await obterPessoa(como(u.gestorB), pessoaEmA))?.observacoes).toBeNull();
      expect(await codigoDaFalha(como(u.leitorA).execute(sql`select observacoes from pessoa`))).toBe("42501");
      expect(await codigoDaFalha(como(u.administrador).execute(sql`select observacao from contato`))).toBe("42501");
      expect(await codigoDaFalha(como(u.leitorA).execute(sql`select * from pessoa`))).toBe("42501");
    });

    test("observação de contato: mesma regra", async () => {
      const notas = async (id: string) => (await listarContatos(como(id), pessoaEmA)).map((c) => c.observacao).filter(Boolean);
      expect(await notas(u.colaboradorA)).toEqual([`Nota do contato ${sufixo}`]);
      expect(await notas(u.gestorB)).toEqual([]);
    });

    test("relacionamento compartilhado não abre acesso indireto: B com a pessoa de A em iniciativa comum continua sem os dados restritos", async () => {
      await comoUsuario(adm, u.administrador, async (tx) => {
        const id = await criarIniciativa(tx, {
          titulo: `Comum ${sufixo}`,
          tipo: "demanda",
          prioridade: "media",
          situacao: "registrada",
          dataAbertura: "2026-01-01",
          projetos: [projetoA, projetoB],
        });
        await tx.execute(sql`insert into iniciativa_stakeholder (iniciativa_id, stakeholder_id, papel) values (${id}, ${pessoaEmA}, 'apoiador')`);
      });
      expect(await valores(u.gestorB)).not.toContain(`pessoal.${sufixo}@exemplo.invalid`);
      expect(await podeVerDadosRestritos(como(u.gestorB), pessoaEmA)).toBe(false);
    });

    test("quem não pode ver as observações não as altera", async () => {
      expect(await codigoDaFalha(comoUsuario(como(u.gestorB), u.gestorB, (tx) => tx.update(pessoa).set({ observacoes: "Sobrescrita" }).where(eq(pessoa.id, pessoaEmA))))).toBe("42501");
      expect((await obterPessoa(como(u.gestorA), pessoaEmA))?.observacoes).toBe(`Observação restrita A ${sufixo}`);
    });

    test("quem não pode registrar contato pessoal é recusado", async () => {
      const falha = await codigoDaFalha(
        comoUsuario(como(u.gestorB), u.gestorB, (tx) =>
          criarContato(tx, { stakeholderId: pessoaEmA, tipo: "email", valor: `tentativa.${sufixo}@exemplo.invalid`, natureza: "pessoal", principal: false }),
        ),
      );
      expect(falha).toBe("42501");
    });

    test("o histórico do cadastro não revela dados restritos a quem não pode vê-los", async () => {
      const doGestor = await historicoDoStakeholder(como(u.gestorA), pessoaEmA);
      expect(doGestor.some((h) => h.tabela === "pessoa")).toBe(true);
      expect(doGestor.some((h) => h.tabela === "contato")).toBe(true);
      for (const id of [u.leitorA, u.gestorB]) {
        const doOutro = await historicoDoStakeholder(como(id), pessoaEmA);
        expect(doOutro.filter((h) => h.tabela === "pessoa" || h.tabela === "contato")).toEqual([]);
        expect(JSON.stringify(doOutro)).not.toContain("Observação restrita");
        expect(JSON.stringify(doOutro)).not.toContain(`pessoal.${sufixo}`);
      }
    });

    test("a pesquisa de duplicidade não revela contato pessoal a quem não pode vê-lo", async () => {
      const achados = (await como(u.gestorB).select({ id: contato.id }).from(contato).where(eq(contato.id, contatoPessoalEmA)));
      expect(achados).toEqual([]);
      const dados = (await como(u.leitorA).select({ id: contato.id }).from(contato).where(eq(contato.valor, `pessoal.${sufixo}@exemplo.invalid`)));
      expect(dados).toEqual([]);
      expect(pessoaEmB).toBeTruthy();
    });
  });
}
