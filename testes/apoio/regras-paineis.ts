/**
 * Painéis e relatórios por perfil (D-079), com consultas de verdade: passam pelo papel crm_app e pelas
 * regras do banco, no contexto de cada usuário. O mesmo conjunto roda no PGlite (a cada Pull Request)
 * e no PostgreSQL do Supabase. A conexão privilegiada só monta o cenário e confere a origem dos números.
 *
 * Somente dados fictícios. Cada execução usa nomes próprios, e os projetos do cenário são arquivados ao
 * final, para não pesarem nas telas de demonstração. Nada é excluído.
 */
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { strFromU8, unzipSync } from "fflate";
import { inArray, type SQL, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type Banco, comoUsuario } from "@/lib/banco/conexao";
import { permissaoContexto, projetoTema, projetoTemaComite, stakeholderContexto, usuario } from "@/lib/banco/esquema";
import { comIdentidade } from "@/lib/banco/identidade";
import { hojeEmBrasilia } from "@/lib/formatacao";
import * as avaliacoes from "@/modulos/avaliacoes/consultas";
import { METODOLOGIA_V22 } from "@/modulos/avaliacoes/rubricas-v22";
import { criarIniciativa } from "@/modulos/iniciativas/consultas";
import { SITUACOES_INICIATIVA_EM_CURSO } from "@/modulos/iniciativas/rotulos";
import { criarCompromisso, criarInteracao, incluirIniciativaNaInteracao } from "@/modulos/interacoes/consultas";
import { carregarDadosDoPainel, type DadosDoPainel } from "@/modulos/paineis/dados";
import type { FiltrosPainel } from "@/modulos/paineis/filtros";
import { calcularBlocos, calcularPanorama, projetosNoEscopo } from "@/modulos/paineis/indicadores";
import { type CodigoRelatorio, CODIGOS_RELATORIO, escopoDeExportacao, montarRelatorio } from "@/modulos/paineis/relatorios";
import { gerarXlsx, neutralizarTexto } from "@/modulos/paineis/xlsx";
import * as planos from "@/modulos/plano-acao/consultas";
import { criarRisco, registrarAvaliacao } from "@/modulos/riscos/consultas";
import { criarPessoa } from "@/modulos/stakeholders/consultas";

export type AmbientePaineis = {
  /** Conexão privilegiada, só para montar o cenário e conferir a origem. */
  administrativo: Banco;
  /** Conexão-base que a aplicação usaria: as operações passam por comIdentidade(). */
  aplicacao: Banco;
};

type Perfil = "gestor" | "colaborador" | "leitor";

/** Conteúdo de um arquivo gerado: abas, linhas como texto e o XML cru do pacote. */
async function lerArquivo(conteudo: Buffer) {
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(conteudo as never);
  const abas = new Map<string, string[][]>();
  pasta.eachSheet((aba) => {
    const linhas: string[][] = [];
    aba.eachRow((linha) => linhas.push(Array.from((linha.values as unknown[]).slice(1), (v) => (v === null || v === undefined ? "" : String(v)))));
    abas.set(aba.name, linhas);
  });
  const pacote = unzipSync(new Uint8Array(conteudo));
  const xml = Object.fromEntries(Object.entries(pacote).map(([nome, bytes]) => [nome, strFromU8(bytes)]));
  const texto = [...abas.values()].flat(2).join("\n");
  return { pasta, abas, xml, texto };
}

export function regrasDosPaineis(obterAmbiente: () => AmbientePaineis) {
  const sufixo = randomUUID().slice(0, 8);
  const hoje = hojeEmBrasilia();
  const RESTRITO_B = `RESTRITO-B-${sufixo}`;
  const JUSTIFICATIVA = `JUSTIFICATIVA-SIGILOSA-${sufixo}`;
  const OBSERVACAO = `OBSERVACAO-SIGILOSA-${sufixo}`;
  const RESSALVA = `RESSALVA-SIGILOSA-${sufixo}`;
  const EVIDENCIA = `EVIDENCIA-SIGILOSA-${sufixo}`;
  const AVALIADO_A = `Pessoa Avaliada A ${sufixo}`;
  const SEM_AVALIACAO_A = `Pessoa Sem Avaliacao A ${sufixo}`;
  const AVALIADO_B = `${RESTRITO_B} Pessoa Avaliada`;
  const FORMULA = `=HYPERLINK("http://exemplo.invalid/${sufixo}","clique")`;
  const NOME_A = `Painel Projeto A ${sufixo}`;
  const NOME_B = `${RESTRITO_B} Painel Projeto B`;
  const PASSADO = "2020-03-10";
  const PERIODO: FiltrosPainel = { de: "2020-03-01", ate: "2020-03-31" };

  let adm: Banco;
  let app: Banco;
  let projetoA: string;
  let projetoB: string;
  let comite1: string;
  let comite2: string;
  const u = {} as Record<
    "administrador" | "gestorA" | "colaboradorA" | "leitorA" | "gestorB" | "colabAleitorB" | "gestorAcolabB" | "vencido" | "semPermissao",
    string
  >;

  const como = (id: string) => comIdentidade(app, id);
  const dadosDe = (id: string) => carregarDadosDoPainel(como(id), hoje);

  async function novoUsuario(nome: string, administrador = false) {
    const [linha] = await adm
      .insert(usuario)
      .values({ nome: `${nome} ${sufixo}`, email: `painel.${nome}.${sufixo}@exemplo.invalid`.toLowerCase(), administrador })
      .returning({ id: usuario.id });
    return linha.id;
  }

  const conceder = (usuarioId: string, projetoId: string, perfil: Perfil, validaAte: string | null = null) =>
    adm.insert(permissaoContexto).values({ usuarioId, projetoTemaId: projetoId, perfil, validaAte });

  async function novoProjeto(nome: string, comiteId: string) {
    const [linha] = await adm
      .insert(projetoTema)
      .values({ tipo: "projeto", nome, nomeNormalizado: nome.toLowerCase(), comiteId })
      .returning({ id: projetoTema.id });
    return linha.id;
  }

  beforeAll(async () => {
    ({ administrativo: adm, aplicacao: app } = obterAmbiente());
    u.administrador = await novoUsuario("Administradora", true);
    u.gestorA = await novoUsuario("GestorA");
    u.colaboradorA = await novoUsuario("ColaboradorA");
    u.leitorA = await novoUsuario("LeitorA");
    u.gestorB = await novoUsuario("GestorB");
    u.colabAleitorB = await novoUsuario("ColabAleitorB");
    u.gestorAcolabB = await novoUsuario("GestorAcolabB");
    u.vencido = await novoUsuario("Vencido");
    u.semPermissao = await novoUsuario("SemPermissao");

    const comites = (await adm.execute(sql`select id from comite where arquivado_em is null order by nome limit 2`)).rows as { id: string }[];
    [comite1, comite2] = comites.map((c) => c.id);
    projetoA = await novoProjeto(NOME_A, comite1);
    projetoB = await novoProjeto(NOME_B, comite2);
    // O projeto A também participa do comitê 2: aparece nas duas linhas e conta uma vez no total.
    await adm.insert(projetoTemaComite).values({ projetoTemaId: projetoA, comiteId: comite2 });

    await conceder(u.gestorA, projetoA, "gestor");
    await conceder(u.colaboradorA, projetoA, "colaborador");
    await conceder(u.leitorA, projetoA, "leitor");
    await conceder(u.gestorB, projetoB, "gestor");
    await conceder(u.colabAleitorB, projetoA, "colaborador");
    await conceder(u.colabAleitorB, projetoB, "leitor");
    await conceder(u.gestorAcolabB, projetoA, "gestor");
    await conceder(u.gestorAcolabB, projetoB, "colaborador");
    await conceder(u.vencido, projetoA, "gestor", "2020-01-01");

    const vigentes = (await adm.execute(sql`select id from metodologia_versao where situacao = 'vigente'`)).rows;
    if (vigentes.length === 0) {
      await comoUsuario(adm, u.administrador, async (tx) => {
        const id = await avaliacoes.criarMetodologia(tx, { ...METODOLOGIA_V22, nome: `V2.2 fictícia ${sufixo}` });
        await avaliacoes.alterarSituacaoMetodologia(tx, id, "vigente");
      });
    }

    await comoUsuario(adm, u.administrador, async (tx) => {
      const pessoaA = await criarPessoa(tx, { nomeCompleto: AVALIADO_A, observacoes: OBSERVACAO });
      const pessoaSemAvaliacao = await criarPessoa(tx, { nomeCompleto: SEM_AVALIACAO_A, observacoes: OBSERVACAO });
      const pessoaB = await criarPessoa(tx, { nomeCompleto: AVALIADO_B, observacoes: OBSERVACAO });
      await tx.insert(stakeholderContexto).values([
        { stakeholderId: pessoaA, projetoTemaId: projetoA, tipoRelacao: "parceiro" },
        { stakeholderId: pessoaSemAvaliacao, projetoTemaId: projetoA, tipoRelacao: "parceiro" },
        { stakeholderId: pessoaB, projetoTemaId: projetoB, tipoRelacao: "parceiro" },
      ]);

      // Iniciativas: A tem 3 (uma compartilhada com B); B tem 2 (a compartilhada e uma só de B).
      const iniciativa = (titulo: string, projetos: string[], extra: Record<string, unknown> = {}) =>
        criarIniciativa(tx, { tipo: "demanda", titulo, situacao: "em_andamento", dataAbertura: "2020-01-01", projetos, ...extra } as never);
      const iniciativaVencida = await iniciativa(`Iniciativa A vencida ${sufixo}`, [projetoA], { dataPrevistaConclusao: "2020-06-01", responsavelId: u.gestorA });
      await iniciativa(`Iniciativa A concluída ${sufixo}`, [projetoA], { situacao: "concluida", dataConclusao: PASSADO, dataPrevistaConclusao: "2020-12-01" });
      await iniciativa(`Iniciativa compartilhada ${sufixo}`, [projetoA, projetoB]);
      await iniciativa(`${RESTRITO_B} Iniciativa`, [projetoB]);

      // Interações: A tem 3 (uma compartilhada com B, uma ligada só pela iniciativa); B tem 2.
      const interacao = (assunto: string, projetos: string[], inicio: string, internos: string[] = []) =>
        criarInteracao(tx, { tipo: "email", assunto, inicio, situacao: "realizada", projetos, iniciativas: [], participantesExternos: [], participantesInternos: internos } as never);
      const interacaoA = await interacao(`Interação A ${sufixo}`, [projetoA], `${PASSADO}T10:00`, [u.gestorA]);
      const interacaoAB = await interacao(`Interação compartilhada ${sufixo}`, [projetoA, projetoB], "2020-04-10T10:00");
      const interacaoB = await interacao(`${RESTRITO_B} Interação`, [projetoB], `${PASSADO}T11:00`);
      const pelaIniciativa = await interacao(`Interação pela iniciativa ${sufixo}`, [], "2020-04-12T10:00");
      await incluirIniciativaNaInteracao(tx, { interacaoId: pelaIniciativa, iniciativaId: iniciativaVencida, contribuicao: "Contribuição fictícia." } as never);

      // Compromissos: A tem 3 pendentes (1 vencido, 2 sem prazo); B tem 2 (a compartilhada e 1 vencido).
      await criarCompromisso(tx, { descricao: `Compromisso A vencido ${sufixo}`, interacaoId: interacaoA, responsavelUsuarioId: u.gestorA, prazo: "2020-01-15" });
      await criarCompromisso(tx, { descricao: `Compromisso compartilhado ${sufixo}`, interacaoId: interacaoAB, responsavelStakeholderId: pessoaA });
      await criarCompromisso(tx, { descricao: FORMULA, interacaoId: interacaoA, responsavelUsuarioId: u.colaboradorA });
      await criarCompromisso(tx, { descricao: `${RESTRITO_B} Compromisso`, interacaoId: interacaoB, responsavelUsuarioId: u.gestorB, prazo: "2020-01-15" });

      // Plano de A: versão 1 aprovada (3 ações, 1 marco alcançado); versão 2 em rascunho com ação a mais.
      const planoA = await planos.criarPlano(tx, { projetoTemaId: projetoA, titulo: `Plano A ${sufixo}`, usarPilaresReferencia: false } as never);
      const v1A = (await planos.versaoEmElaboracao(tx, planoA))!.id;
      const acao = (versaoId: string, titulo: string, extra: Record<string, unknown>) => planos.incluirAcaoNaVersao(tx, { versaoId, titulo, ...extra } as never);
      const acaoAtrasada = await acao(v1A, `Ação A atrasada ${sufixo}`, { responsavelUsuarioId: u.gestorA, fimPrevisto: "2020-06-01", justificativa: JUSTIFICATIVA });
      const marcoId = await planos.incluirMarco(tx, { versaoId: v1A, acaoId: acaoAtrasada, descricao: `Marco A ${sufixo}`, prazoPrevisto: "2020-02-01" });
      await acao(v1A, `+1+1 Ação sem prazo ${sufixo}`, { responsavelStakeholderId: pessoaA });
      const acaoConcluida = await acao(v1A, `Ação A concluída ${sufixo}`, { responsavelUsuarioId: u.colaboradorA, fimPrevisto: "2020-01-20" });
      await planos.enviarParaAprovacao(tx, v1A, undefined);
      await planos.decidirVersao(tx, v1A, "aprovada", "Decisão fictícia.");
      await planos.registrarAcompanhamento(tx, { acaoId: acaoConcluida, data: PASSADO, situacao: "concluida", percentual: 100 } as never);
      await planos.registrarAcompanhamento(tx, { acaoId: acaoAtrasada, data: PASSADO, marcoId, marcoAlcancado: true } as never);
      const v2A = await planos.criarNovaVersao(tx, planoA);
      await acao(v2A, `Ação só no rascunho ${sufixo}`, { responsavelUsuarioId: u.gestorA });

      // Plano de B: versão 1 aprovada, com 1 ação.
      const planoB = await planos.criarPlano(tx, { projetoTemaId: projetoB, titulo: `${RESTRITO_B} Plano`, usarPilaresReferencia: false } as never);
      const v1B = (await planos.versaoEmElaboracao(tx, planoB))!.id;
      await acao(v1B, `${RESTRITO_B} Ação`, { responsavelUsuarioId: u.gestorB, fimPrevisto: "2020-06-01" });
      await planos.enviarParaAprovacao(tx, v1B, undefined);
      await planos.decidirVersao(tx, v1B, "aprovada", "Decisão fictícia.");

      // Riscos: A tem 1 crítico que caiu para moderado e 1 baixo só com inerente; B tem 1 crítico.
      const novoRisco = (projetoTemaId: string, titulo: string, p: number, i: number, extra: Record<string, unknown> = {}) =>
        criarRisco(tx, { projetoTemaId, titulo, situacao: "aberto", dataAvaliacao: PASSADO, probabilidade: p, impacto: i, justificativa: JUSTIFICATIVA, avaliadoPor: u.administrador, ...extra } as never);
      const riscoA = await novoRisco(projetoA, `Risco A residual ${sufixo}`, 5, 5, { responsavelId: u.gestorA, proximaRevisao: "2020-06-01", causa: JUSTIFICATIVA });
      await registrarAvaliacao(tx, { riscoId: riscoA, tipo: "residual", dataAvaliacao: PASSADO, probabilidade: 2, impacto: 4, justificativa: JUSTIFICATIVA, avaliadoPor: u.administrador });
      await novoRisco(projetoA, `Risco A inerente ${sufixo}`, 1, 1);
      await novoRisco(projetoB, `${RESTRITO_B} Risco`, 5, 5);

      // Avaliações: uma publicada em A, uma publicada em B; a segunda pessoa de A fica sem avaliação.
      const publicar = async (projeto: string, stakeholder: string) => {
        const versaoId = await avaliacoes.iniciarRascunho(tx, projeto, stakeholder);
        await avaliacoes.salvarRascunho(
          tx,
          {
            versaoId,
            nivelPoder: "alto",
            nivelInteresse: "baixo",
            justificativaPoder: JUSTIFICATIVA,
            justificativaInteresse: JUSTIFICATIVA,
            posicionamento: "favoravel",
            naturezaPosicionamento: "manifestacao_formal",
            validacaoInstitucional: JUSTIFICATIVA,
            justificativaPosicionamento: JUSTIFICATIVA,
            situacaoRessalvas: "ha_ressalvas",
            descricaoRessalvas: RESSALVA,
            grauConfianca: "alto",
            justificativaConfianca: JUSTIFICATIVA,
            justificativa: JUSTIFICATIVA,
            dataReferencia: PASSADO,
          },
          new Map(),
        );
        await avaliacoes.adicionarEvidencia(tx, { versaoId, tipo: "documento", descricao: EVIDENCIA } as never);
        await avaliacoes.publicarRascunho(tx, versaoId);
      };
      await publicar(projetoA, pessoaA);
      await publicar(projetoB, pessoaB);
    });
  });

  afterAll(async () => {
    if (projetoA && projetoB) await adm.update(projetoTema).set({ arquivadoEm: new Date() }).where(inArray(projetoTema.id, [projetoA, projetoB]));
  });

  // --- Conferência na origem, pela conexão privilegiada e sem as funções da aplicação --------------

  const umValor = async (consulta: SQL) => ((await adm.execute(consulta)).rows[0] as { n: number }).n;

  const projetosEntre = (ids: readonly string[], coluna: SQL) =>
    sql`${coluna} in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`;

  async function contagensNaOrigem(ids: readonly string[]) {
    const emCurso = sql.join(SITUACOES_INICIATIVA_EM_CURSO.map((s) => sql`${s}`), sql`, `);
    const iniciativaNoAlvo = (campo: SQL) => sql`exists (
      select 1 from iniciativa_projeto_tema l join iniciativa ii on ii.id = l.iniciativa_id
      where l.iniciativa_id = ${campo} and l.arquivado_em is null and ii.arquivado_em is null and ${projetosEntre(ids, sql`l.projeto_tema_id`)})`;
    const interacaoNoAlvo = (campo: SQL) => sql`(
      exists (select 1 from interacao_projeto_tema l where l.interacao_id = ${campo} and l.arquivado_em is null and ${projetosEntre(ids, sql`l.projeto_tema_id`)})
      or exists (select 1 from interacao_iniciativa li where li.interacao_id = ${campo} and li.arquivado_em is null and ${iniciativaNoAlvo(sql`li.iniciativa_id`)}))`;
    const compromissoNoAlvo = sql`(
      (c.iniciativa_id is not null and ${iniciativaNoAlvo(sql`c.iniciativa_id`)})
      or (c.interacao_id is not null and exists (select 1 from interacao ix where ix.id = c.interacao_id and ix.arquivado_em is null and ${interacaoNoAlvo(sql`ix.id`)})))`;
    const acoesVigentes = sql`
      from acao_planejamento ap
      join plano_acao_versao v on v.id = ap.plano_acao_versao_id
      join plano_acao p on p.id = v.plano_acao_id
      where ap.arquivado_em is null and v.situacao = 'aprovada' and p.arquivado_em is null and ${projetosEntre(ids, sql`p.projeto_tema_id`)}`;
    return {
      iniciativasEmCurso: await umValor(sql`
        select count(*)::int as n from iniciativa i where i.arquivado_em is null and i.situacao::text in (${emCurso}) and ${iniciativaNoAlvo(sql`i.id`)}`),
      interacoes: await umValor(sql`select count(*)::int as n from interacao x where x.arquivado_em is null and ${interacaoNoAlvo(sql`x.id`)}`),
      compromissosPendentes: await umValor(sql`
        select count(*)::int as n from compromisso c where c.arquivado_em is null and c.situacao in ('aberto', 'em_andamento') and ${compromissoNoAlvo}`),
      compromissosVencidos: await umValor(sql`
        select count(*)::int as n from compromisso c where c.arquivado_em is null and c.situacao in ('aberto', 'em_andamento') and c.prazo < ${hoje}::date and ${compromissoNoAlvo}`),
      acoesVigentes: await umValor(sql`select count(*)::int as n ${acoesVigentes}`),
      marcosPrevistos: await umValor(sql`
        select count(*)::int as n from marco_planejamento m
        join plano_acao_versao v on v.id = m.plano_acao_versao_id
        join plano_acao p on p.id = v.plano_acao_id
        where m.arquivado_em is null and v.situacao = 'aprovada' and p.arquivado_em is null and ${projetosEntre(ids, sql`p.projeto_tema_id`)}`),
      riscos: await umValor(sql`select count(*)::int as n from risco r where r.arquivado_em is null and ${projetosEntre(ids, sql`r.projeto_tema_id`)}`),
      associados: await umValor(sql`
        select count(*)::int as n from (
          select distinct projeto_tema_id, stakeholder_id from stakeholder_contexto
          where arquivado_em is null and data_fim is null and ${projetosEntre(ids, sql`projeto_tema_id`)}) s`),
    };
  }

  const resumoDe = (dados: DadosDoPainel, escopo: ReadonlySet<string>, filtros: FiltrosPainel = {}) => {
    const { total } = calcularPanorama(dados, escopo, filtros, hoje);
    return {
      iniciativasEmCurso: total.iniciativasEmCurso,
      interacoes: total.interacoesNoPeriodo,
      compromissosPendentes: total.compromissosPendentes,
      compromissosVencidos: total.compromissosVencidos,
      acoesVigentes: total.acoesVigentes,
      marcosPrevistos: total.marcosPrevistos,
      riscos: Object.values(total.riscosPorClassificacao).reduce((s, n) => s + n, 0) + total.riscosSemAvaliacao,
    };
  };

  /** Números esperados, à mão, pelo cenário montado acima. */
  const ESPERADO_A = { iniciativasEmCurso: 2, interacoes: 3, compromissosPendentes: 3, compromissosVencidos: 1, acoesVigentes: 3, marcosPrevistos: 1, riscos: 2 };
  const ESPERADO_B = { iniciativasEmCurso: 2, interacoes: 2, compromissosPendentes: 2, compromissosVencidos: 1, acoesVigentes: 1, marcosPrevistos: 0, riscos: 1 };

  describe("Painéis por perfil, nas regras do banco", () => {
    test("gestor, colaborador e leitor de A veem os mesmos números: só os de A", async () => {
      const blocosDe = async (id: string) => {
        const dados = await dadosDe(id);
        return calcularBlocos(dados, projetosNoEscopo(dados, {}), {}, hoje);
      };
      const gestor = await blocosDe(u.gestorA);
      expect(await blocosDe(u.colaboradorA)).toEqual(gestor);
      expect(await blocosDe(u.leitorA)).toEqual(gestor);

      for (const id of [u.gestorA, u.colaboradorA, u.leitorA]) {
        const dados = await dadosDe(id);
        expect(dados.projetos.map((p) => p.id)).toEqual([projetoA]);
        expect(resumoDe(dados, projetosNoEscopo(dados, {}))).toEqual(ESPERADO_A);
      }
    });

    test("nada de B chega a quem só tem A: nem nomes, nem identificadores, nem no registro compartilhado", async () => {
      for (const id of [u.gestorA, u.colaboradorA, u.leitorA]) {
        const texto = JSON.stringify(await dadosDe(id));
        expect(texto).not.toContain(RESTRITO_B);
        expect(texto).not.toContain(projetoB);
        expect(texto).toContain(`Compromisso compartilhado ${sufixo}`);
      }
    });

    test("os dados do painel não trazem justificativas, evidências, ressalvas descritas nem observações", async () => {
      for (const id of [u.administrador, u.gestorA, u.colaboradorA, u.leitorA]) {
        const texto = JSON.stringify(await dadosDe(id));
        expect(texto).not.toContain(RESSALVA);
        expect(texto).not.toContain(EVIDENCIA);
        expect(texto).not.toContain(OBSERVACAO);
      }
    });

    test("gestor de B vê os números de B, sem as ações e os riscos de A", async () => {
      const dados = await dadosDe(u.gestorB);
      expect(dados.projetos.map((p) => p.id)).toEqual([projetoB]);
      expect(resumoDe(dados, projetosNoEscopo(dados, {}))).toEqual(ESPERADO_B);
      const texto = JSON.stringify(dados);
      expect(texto).not.toContain(NOME_A);
      expect(texto).not.toContain(`Ação A atrasada ${sufixo}`);
      // O responsável externo do compromisso compartilhado é visível, como na tela de origem; quem não
      // está ligado a nenhum registro de B, não.
      expect(texto).not.toContain(SEM_AVALIACAO_A);
    });

    test("sem permissão ou com permissão vencida, nenhum projeto e nenhuma contagem", async () => {
      for (const id of [u.semPermissao, u.vencido]) {
        const dados = await dadosDe(id);
        expect(dados.projetos).toEqual([]);
        expect(dados.iniciativas).toEqual([]);
        expect(dados.compromissos).toEqual([]);
        expect(dados.planos).toEqual([]);
        expect(dados.riscos).toEqual([]);
        expect(dados.fichas).toEqual([]);
        expect(resumoDe(dados, new Set())).toEqual({ iniciativasEmCurso: 0, interacoes: 0, compromissosPendentes: 0, compromissosVencidos: 0, acoesVigentes: 0, marcosPrevistos: 0, riscos: 0 });
      }
    });

    test("um identificador de projeto proibido no filtro não amplia nada", async () => {
      const dados = await dadosDe(u.gestorA);
      const filtro = { projetoTemaId: projetoB };
      const escopo = projetosNoEscopo(dados, filtro);
      expect([...escopo]).toEqual([]);
      expect(resumoDe(dados, escopo, filtro).iniciativasEmCurso).toBe(0);
    });

    test("projeto em dois comitês aparece em cada linha e conta uma vez no total; registro compartilhado também", async () => {
      const dados = await dadosDe(u.administrador);
      const escopo = new Set([projetoA, projetoB]);
      const { linhas, total } = calcularPanorama(dados, escopo, {}, hoje);
      const linha1 = linhas.find((l) => l.comiteId === comite1)!;
      const linha2 = linhas.find((l) => l.comiteId === comite2)!;
      expect(linha1.projetosPrincipais).toBe(1);
      expect(linha2.projetosPrincipais).toBe(1);
      expect(linha2.projetosParticipantes).toBe(1);
      expect(total.projetosPrincipais).toBe(2);
      // A: 3 ações em cada linha em que aparece; o total são 3 + 1, e não a soma das linhas.
      expect(linha1.acoesVigentes).toBe(3);
      expect(linha2.acoesVigentes).toBe(4);
      expect(total.acoesVigentes).toBe(4);
      // A iniciativa, a interação e o compromisso compartilhados contam uma vez só.
      expect(total.iniciativasEmCurso).toBe(3);
      expect(total.interacoesNoPeriodo).toBe(4);
      expect(total.compromissosPendentes).toBe(4);
    });

    test("quem só tem A vê a linha do comitê 2 só com A, sem totais que deixem deduzir B", async () => {
      const dados = await dadosDe(u.colaboradorA);
      const { linhas, total } = calcularPanorama(dados, projetosNoEscopo(dados, {}), {}, hoje);
      const linha2 = linhas.find((l) => l.comiteId === comite2)!;
      expect([linha2.projetosPrincipais, linha2.projetosParticipantes]).toEqual([0, 1]);
      expect(linha2.acoesVigentes).toBe(3);
      expect(linha2.compromissosPendentes).toBe(3);
      expect(total.acoesVigentes).toBe(3);
      expect(total.compromissosPendentes).toBe(3);
    });
  });

  describe("Contagens confrontadas com os registros de origem", () => {
    test("A, B e A + B coincidem com a origem e com o que o cenário criou", async () => {
      const dados = await dadosDe(u.administrador);
      for (const [ids, esperado] of [
        [[projetoA], ESPERADO_A],
        [[projetoB], ESPERADO_B],
      ] as const) {
        const origem = await contagensNaOrigem(ids);
        expect(resumoDe(dados, new Set(ids))).toEqual(esperado);
        const { associados, ...semAssociados } = origem;
        expect(semAssociados).toEqual(esperado);
        expect(associados).toBeGreaterThan(0);
      }
      const origemAB = await contagensNaOrigem([projetoA, projetoB]);
      const { associados: associadosAB, ...semAssociados } = origemAB;
      expect(associadosAB).toBeGreaterThan(0);
      expect(resumoDe(dados, new Set([projetoA, projetoB]))).toEqual(semAssociados);
    });

    test("no conjunto completo do banco, o total do administrador coincide com a origem", async () => {
      const dados = await dadosDe(u.administrador);
      const todos = (await adm.execute(sql`select id from projeto_tema where arquivado_em is null`)).rows as { id: string }[];
      const ids = todos.map((p) => p.id);
      expect(dados.projetos.map((p) => p.id).sort()).toEqual([...ids].sort());
      const { associados, ...origem } = await contagensNaOrigem(ids);
      const escopo = new Set(ids);
      expect(resumoDe(dados, escopo)).toEqual(origem);
      // Cada associado vigente aparece como avaliado, sem avaliação ou avaliado em metodologia anterior.
      const blocos = calcularBlocos(dados, escopo, {}, hoje).find((b) => b.id === "stakeholders")!;
      const cobertura = blocos.grupos[0].indicadores;
      const n = (rotulo: string) => cobertura.find((i) => i.rotulo === rotulo)?.valor as number;
      expect(n("Avaliações na metodologia vigente") + n("Associados sem avaliação publicada") + n("Avaliados em metodologia anterior")).toBe(associados);
    });

    test("versão em rascunho aparece à parte e não soma à vigente", async () => {
      const dados = await dadosDe(u.gestorA);
      const [plano] = dados.planos;
      expect(plano.vigente?.numeroVersao).toBe(1);
      expect(plano.acoes).toHaveLength(3);
      expect(plano.acoes.map((a) => a.titulo)).not.toContain(`Ação só no rascunho ${sufixo}`);
      expect(plano.naoAprovadas).toEqual([{ numeroVersao: 2, situacao: "rascunho", acoes: 4, marcos: 1 }]);
      const concluida = plano.acoes.find((a) => a.titulo === `Ação A concluída ${sufixo}`)!;
      expect(concluida.dataConclusao).toBe(PASSADO);
      // Marco alcançado no acompanhamento, com a data dele.
      const marco = plano.acoes.flatMap((a) => a.marcos)[0];
      expect(marco.alcancadoEm).toBe(PASSADO);
    });

    test("com período, conclusões e interações usam a data efetiva", async () => {
      const dados = await dadosDe(u.gestorA);
      const escopo = projetosNoEscopo(dados, PERIODO);
      const blocos = calcularBlocos(dados, escopo, PERIODO, hoje);
      const valor = (bloco: string, rotulo: string) =>
        blocos.find((b) => b.id === bloco)?.grupos.flatMap((g) => g.indicadores).find((i) => i.rotulo === rotulo)?.valor;
      expect(valor("iniciativas", "Concluídas no período")).toBe(1);
      expect(valor("planos", "Concluídas no período")).toBe(1);
      expect(valor("planos", "Alcançados no período")).toBe(1);
      expect(resumoDe(dados, escopo, PERIODO).interacoes).toBe(1);
    });

    test("riscos: faixas reais, inerente e residual, e a regra provisória identificada", async () => {
      const dados = await dadosDe(u.leitorA);
      const { total } = calcularPanorama(dados, projetosNoEscopo(dados, {}), {}, hoje);
      expect(total.riscosPorClassificacao).toEqual({ baixo: 1, moderado: 1, alto: 0, critico: 0 });
      const comResidual = dados.riscos.find((r) => r.titulo === `Risco A residual ${sufixo}`)!;
      expect(comResidual.inerente?.criticidade).toBe(25);
      expect(comResidual.inerente?.classificacao).toBe("critico");
      expect(comResidual.residual?.criticidade).toBe(8);
      expect(comResidual.residual?.classificacao).toBe("moderado");
      const bloco = calcularBlocos(dados, projetosNoEscopo(dados, {}), {}, hoje).find((b) => b.id === "riscos")!;
      const aReavaliar = bloco.grupos.flatMap((g) => g.indicadores).find((i) => i.rotulo === "A reavaliar")!;
      expect(aReavaliar.nota).toMatch(/P-049/);
      expect(total.riscosAReavaliar).toBe(aReavaliar.valor);
    });

    test("stakeholders: avaliado e sem avaliação ficam separados, sem virar nível baixo", async () => {
      const dados = await dadosDe(u.leitorA);
      const { total } = calcularPanorama(dados, projetosNoEscopo(dados, {}), {}, hoje);
      expect([total.stakeholdersAvaliados, total.stakeholdersSemAvaliacao]).toEqual([1, 1]);
      const bloco = calcularBlocos(dados, projetosNoEscopo(dados, {}), {}, hoje).find((b) => b.id === "stakeholders")!;
      const nivelBaixoPoder = bloco.grupos.find((g) => g.titulo === "Poder")?.indicadores.find((i) => i.rotulo === "Baixo");
      expect(nivelBaixoPoder?.valor).toBe(0);
    });
  });

  describe("Exportações por perfil", () => {
    async function exportar(id: string, codigo: CodigoRelatorio, filtros: FiltrosPainel = {}) {
      const banco = como(id);
      const escopo = await escopoDeExportacao(banco);
      const dados = await carregarDadosDoPainel(banco, hoje);
      const arquivo = montarRelatorio(codigo, dados, escopo, filtros, { hoje, extraidoEm: new Date("2026-06-15T15:30:00Z"), usuario: `Responsável ${sufixo}` });
      return { arquivo, ...(await lerArquivo(await gerarXlsx(arquivo))) };
    }

    test("o servidor decide o alcance pelo perfil válido, não pela tela", async () => {
      const alcance = async (id: string) => {
        const e = await escopoDeExportacao(como(id));
        const lista = (c: "todos" | ReadonlySet<string>) => (c === "todos" ? "todos" : [...c].sort());
        return { podeExportar: e.podeExportar, projetos: lista(e.projetos), nominais: lista(e.nominais) };
      };
      expect(await alcance(u.administrador)).toEqual({ podeExportar: true, projetos: "todos", nominais: "todos" });
      expect(await alcance(u.gestorA)).toEqual({ podeExportar: true, projetos: [projetoA], nominais: [projetoA] });
      expect(await alcance(u.colaboradorA)).toEqual({ podeExportar: true, projetos: [projetoA], nominais: [] });
      expect(await alcance(u.leitorA)).toEqual({ podeExportar: false, projetos: [], nominais: [] });
      expect(await alcance(u.colabAleitorB)).toEqual({ podeExportar: true, projetos: [projetoA], nominais: [] });
      expect(await alcance(u.gestorAcolabB)).toEqual({ podeExportar: true, projetos: [projetoA, projetoB].sort(), nominais: [projetoA] });
      expect(await alcance(u.semPermissao)).toEqual({ podeExportar: false, projetos: [], nominais: [] });
      expect(await alcance(u.vencido)).toEqual({ podeExportar: false, projetos: [], nominais: [] });
    });

    test("leitor não exporta nenhum relatório, mesmo chamando direto a montagem", async () => {
      const banco = como(u.leitorA);
      const escopo = await escopoDeExportacao(banco);
      const dados = await carregarDadosDoPainel(banco, hoje);
      for (const codigo of CODIGOS_RELATORIO) {
        expect(() => montarRelatorio(codigo, dados, escopo, {}, { hoje, extraidoEm: new Date(), usuario: "Leitor" })).toThrow(/não exporta/);
      }
    });

    test("gestor e colaborador de A: R1 a R5 sem nenhum dado de B", async () => {
      for (const id of [u.gestorA, u.colaboradorA]) {
        for (const codigo of CODIGOS_RELATORIO) {
          const { texto, xml } = await exportar(id, codigo);
          expect(texto, codigo).not.toContain(RESTRITO_B);
          expect(texto, codigo).not.toContain(projetoB);
          expect(Object.values(xml).join("\n"), codigo).not.toContain(RESTRITO_B);
        }
      }
    });

    test("colaborador de A e leitor de B exporta só A: o painel mostra B, o arquivo não", async () => {
      const dados = await dadosDe(u.colabAleitorB);
      expect(dados.projetos.map((p) => p.id).sort()).toEqual([projetoA, projetoB].sort());
      for (const codigo of CODIGOS_RELATORIO) {
        const { texto } = await exportar(u.colabAleitorB, codigo);
        expect(texto, codigo).not.toContain(RESTRITO_B);
      }
      const { abas } = await exportar(u.colabAleitorB, "R1");
      const total = abas.get("Panorama")?.at(-1);
      expect(total?.[7]).toBe("3");
    });

    test("nenhum arquivo traz justificativas, evidências, descrição de ressalvas nem observações", async () => {
      for (const id of [u.administrador, u.gestorA, u.colaboradorA]) {
        for (const codigo of CODIGOS_RELATORIO) {
          const { xml } = await exportar(id, codigo);
          const tudo = Object.values(xml).join("\n");
          for (const sigilo of [JUSTIFICATIVA, RESSALVA, EVIDENCIA, OBSERVACAO]) expect(tudo, `${codigo} ${sigilo}`).not.toContain(sigilo);
        }
      }
    });

    test("R5 do colaborador: só contagens, sem nome de stakeholder", async () => {
      const { abas, texto } = await exportar(u.colaboradorA, "R5");
      expect([...abas.keys()]).toEqual(["Extração", "Contagens"]);
      expect(texto).not.toContain(AVALIADO_A);
      expect(texto).not.toContain(SEM_AVALIACAO_A);
      const [cabecalho, linha] = abas.get("Contagens") ?? [];
      expect(linha[0]).toBe(NOME_A);
      expect(linha[cabecalho.indexOf("Avaliações na metodologia vigente")]).toBe("1");
      expect(linha[cabecalho.indexOf("Sem avaliação publicada")]).toBe("1");
      expect(linha[cabecalho.indexOf("Poder alto")]).toBe("1");
      expect(linha[cabecalho.indexOf("Poder baixo")]).toBe("0");
    });

    test("R5 do gestor: nominal só no próprio projeto, com níveis, natureza e ressalvas", async () => {
      const { abas } = await exportar(u.gestorA, "R5");
      const nominais = abas.get("Avaliações nominais") ?? [];
      const [cabecalho, ...linhas] = nominais;
      expect(cabecalho).toEqual(expect.arrayContaining(["Poder", "Interesse", "Posicionamento", "Natureza da informação", "Ressalvas"]));
      expect(cabecalho.join(" ")).not.toMatch(/justificativa|evidência/i);
      const avaliado = linhas.find((l) => l[1] === AVALIADO_A)!;
      expect(avaliado[cabecalho.indexOf("Poder")]).toBe("Alto");
      expect(avaliado[cabecalho.indexOf("Interesse")]).toBe("Baixo");
      expect(avaliado[cabecalho.indexOf("Posicionamento")]).toBe("Favorável");
      expect(avaliado[cabecalho.indexOf("Natureza da informação")]).toBe("Manifestação formal");
      expect(avaliado[cabecalho.indexOf("Ressalvas")]).toBe("Há ressalvas relevantes");
      const sem = linhas.find((l) => l[1] === SEM_AVALIACAO_A)!;
      expect(sem[cabecalho.indexOf("Poder")]).toBe("Sem avaliação");
      expect(linhas).toHaveLength(2);
    });

    test("R5: a situação específica H5 fica em coluna própria, identificada como não classificação", async () => {
      const { abas } = await exportar(u.colaboradorA, "R5");
      const [cabecalho, linha] = abas.get("Contagens") ?? [];
      const coluna = cabecalho.findIndex((c) => c.startsWith("Situação específica, não é classificação"));
      expect(coluna).toBe(cabecalho.length - 1);
      expect(linha[coluna]).toBe("0");
    });

    test("R5 com filtro de responsável: só o que a pessoa avaliou; sem nulo virar nível nem nome de fora", async () => {
      const deQuemAvaliou = await exportar(u.gestorA, "R5", { responsavelId: u.administrador });
      expect((deQuemAvaliou.abas.get("Avaliações nominais") ?? []).slice(1).map((l) => l[1])).toEqual([AVALIADO_A]);
      const deOutro = await exportar(u.gestorA, "R5", { responsavelId: u.colaboradorA });
      expect((deOutro.abas.get("Avaliações nominais") ?? []).slice(1)).toEqual([]);
      const [cabecalho, linha] = deOutro.abas.get("Contagens") ?? [];
      expect(linha[cabecalho.indexOf("Avaliações na metodologia vigente")]).toBe("0");
    });

    test("gestor de A e colaborador de B: nominal só de A; de B, apenas as contagens", async () => {
      const { abas, texto } = await exportar(u.gestorAcolabB, "R5");
      const nominais = (abas.get("Avaliações nominais") ?? []).slice(1);
      expect(nominais.map((l) => l[0])).toEqual([NOME_A, NOME_A]);
      expect(texto).not.toContain(AVALIADO_B);
      expect((abas.get("Contagens") ?? []).slice(1).map((l) => l[0]).sort()).toEqual([NOME_A, NOME_B].sort());
    });

    test("cabeçalho do arquivo: filtros, data da extração e usuário responsável", async () => {
      const { abas } = await exportar(u.gestorA, "R2", { ...PERIODO, projetoTemaId: projetoA });
      const extracao = new Map((abas.get("Extração") ?? []).map((l) => [l[0], l[1]]));
      expect(extracao.get("Usuário responsável")).toBe(`Responsável ${sufixo}`);
      expect(extracao.get("Data e hora da extração")).toMatch(/15\/06\/2026/);
      expect(extracao.get("Filtro: Projeto ou tema")).toBe(NOME_A);
      expect(extracao.get("Filtro: Período")).toBe("01/03/2020 a 31/03/2020");
      expect(extracao.get("Filtro: Comitê")).toBe("Todos");
    });

    test("projeto proibido no filtro não vira dado nem nome no arquivo", async () => {
      const { abas, texto } = await exportar(u.gestorA, "R2", { projetoTemaId: projetoB });
      expect(texto).not.toContain(RESTRITO_B);
      expect(abas.get("Compromissos")).toHaveLength(1);
      const extracao = new Map((abas.get("Extração") ?? []).map((l) => [l[0], l[1]]));
      expect(extracao.get("Filtro: Projeto ou tema")).toBe("Não disponível para este perfil");
    });

    test("sem fórmulas, dados ocultos, macros ou vínculos: o texto digitado fica neutralizado", async () => {
      for (const codigo of CODIGOS_RELATORIO) {
        const { xml, pasta } = await exportar(u.administrador, codigo);
        const nomes = Object.keys(xml);
        expect(nomes.filter((n) => /vbaProject|externalLink|comments|drawing|macrosheet|embeddings/i.test(n)), codigo).toEqual([]);
        for (const [nome, conteudo] of Object.entries(xml)) {
          expect(conteudo, nome).not.toContain('TargetMode="External"');
          if (!nome.startsWith("xl/worksheets/")) continue;
          expect(conteudo, nome).not.toMatch(/<f[ >]/);
          expect(conteudo, nome).not.toMatch(/hidden="(1|true)"/);
        }
        expect(xml["xl/workbook.xml"], codigo).not.toMatch(/state="(hidden|veryHidden)"|<definedName[ >]/);
        pasta.eachSheet((aba) => expect(aba.state ?? "visible", aba.name).toBe("visible"));
      }
    });

    test("texto iniciado por =, +, - ou @ vira texto de verdade, inclusive se reaberto", async () => {
      const r2 = await exportar(u.gestorA, "R2");
      const celulas = (r2.abas.get("Compromissos") ?? []).map((l) => l[0]);
      expect(celulas).toContain(`'${FORMULA}`);
      expect(celulas).not.toContain(FORMULA);
      const planilha = r2.pasta.getWorksheet("Compromissos");
      planilha?.eachRow((linha) => expect(linha.getCell(1).type).not.toBe(ExcelJS.ValueType.Formula));
      const r3 = await exportar(u.gestorA, "R3");
      expect((r3.abas.get("Ações") ?? []).map((l) => l[4])).toContain(`'+1+1 Ação sem prazo ${sufixo}`);
      expect(neutralizarTexto("@SOMA(1)")).toBe("'@SOMA(1)");
      expect(neutralizarTexto("-2+3")).toBe("'-2+3");
      expect(neutralizarTexto("texto normal = 1")).toBe("texto normal = 1");
    });

    test("R1: o arquivo traz as mesmas contagens do painel, e o total conta cada registro uma vez", async () => {
      const dados = await dadosDe(u.gestorA);
      const { total } = calcularPanorama(dados, projetosNoEscopo(dados, {}), {}, hoje);
      const { abas } = await exportar(u.gestorA, "R1");
      const [cabecalho, ...linhas] = abas.get("Panorama") ?? [];
      const ultima = linhas.at(-1)!;
      expect(ultima[0]).toMatch(/Total geral/);
      expect(ultima[cabecalho.indexOf("Ações da versão vigente")]).toBe(String(total.acoesVigentes));
      expect(ultima[cabecalho.indexOf("Compromissos pendentes")]).toBe(String(total.compromissosPendentes));
      expect(ultima[cabecalho.indexOf("Riscos a reavaliar (regra provisória P-049)")]).toBe(String(total.riscosAReavaliar));
    });

    test("arquivo sem duplicidade: registro compartilhado aparece uma vez, com os projetos que o perfil pode exportar", async () => {
      const compartilhado = `Compromisso compartilhado ${sufixo}`;
      const deAeB = await exportar(u.gestorAcolabB, "R2");
      const [cabecalho, ...linhas] = deAeB.abas.get("Compromissos") ?? [];
      const repetidas = linhas.filter((l) => l[0] === compartilhado);
      expect(repetidas).toHaveLength(1);
      expect(repetidas[0][cabecalho.indexOf("Projetos e temas")].split("; ").sort()).toEqual([NOME_A, NOME_B].sort());
      expect(linhas).toHaveLength(4);
      // Quem só exporta A vê o mesmo compromisso, sem o nome do outro projeto.
      const deA = await exportar(u.colabAleitorB, "R2");
      const [cabecalhoA, ...linhasA] = deA.abas.get("Compromissos") ?? [];
      expect(linhasA.filter((l) => l[0] === compartilhado).map((l) => l[cabecalhoA.indexOf("Projetos e temas")])).toEqual([NOME_A]);
    });

    test("arquivo sem duplicidade: ações, marcos e riscos não se repetem no administrador, em todo o banco", async () => {
      const r3 = await exportar(u.administrador, "R3");
      const acoes = (r3.abas.get("Ações") ?? []).slice(1).map((l) => `${l[0]}|${l[3]}`);
      expect(new Set(acoes).size).toBe(acoes.length);
      const marcos = (r3.abas.get("Marcos") ?? []).slice(1).map((l) => `${l[0]}|${l[2]}|${l[3]}`);
      expect(new Set(marcos).size).toBe(marcos.length);
      const r4 = await exportar(u.administrador, "R4");
      const riscos = (r4.abas.get("Riscos") ?? []).slice(1).map((l) => `${l[0]}|${l[1]}`);
      expect(new Set(riscos).size).toBe(riscos.length);
    });

    test("R1 de quem exporta A e B: A em cada comitê, e o total conta cada registro uma vez", async () => {
      const { abas } = await exportar(u.gestorAcolabB, "R1");
      const [cabecalho, ...linhas] = abas.get("Panorama") ?? [];
      const n = (linha: string[], nome: string) => Number(linha[cabecalho.indexOf(nome)]);
      const total = linhas.at(-1) as string[];
      expect(n(total, "Ações da versão vigente")).toBe(4);
      expect(n(total, "Compromissos pendentes")).toBe(4);
      expect(n(total, "Iniciativas em curso")).toBe(3);
      expect(n(total, "Interações no período")).toBe(4);
      expect(n(total, "Projetos e temas (principal)")).toBe(2);
      const somaDasLinhas = linhas.slice(0, -1).reduce((s, l) => s + n(l, "Ações da versão vigente"), 0);
      expect(somaDasLinhas).toBe(7);
    });

    test("painel e arquivo dão os mesmos totais, em cada perfil que exporta", async () => {
      for (const id of [u.gestorA, u.colaboradorA, u.colabAleitorB, u.gestorB, u.gestorAcolabB]) {
        const banco = como(id);
        const escopo = await escopoDeExportacao(banco);
        const dados = await carregarDadosDoPainel(banco, hoje);
        const limite = escopo.projetos === "todos" ? undefined : escopo.projetos;
        const { total } = calcularPanorama(dados, projetosNoEscopo(dados, {}, limite), {}, hoje);
        const { abas } = await exportar(id, "R1");
        const [cabecalho, ...linhas] = abas.get("Panorama") ?? [];
        const final = linhas.at(-1) as string[];
        const n = (nome: string) => Number(final[cabecalho.indexOf(nome)]);
        expect(n("Iniciativas em curso")).toBe(total.iniciativasEmCurso);
        expect(n("Interações no período")).toBe(total.interacoesNoPeriodo);
        expect(n("Compromissos pendentes")).toBe(total.compromissosPendentes);
        expect(n("Compromissos vencidos")).toBe(total.compromissosVencidos);
        expect(n("Ações da versão vigente")).toBe(total.acoesVigentes);
        expect(n("Marcos previstos")).toBe(total.marcosPrevistos);
        expect(n("Avaliações de stakeholders")).toBe(total.stakeholdersAvaliados);
        expect(n("Stakeholders sem avaliação")).toBe(total.stakeholdersSemAvaliacao);
      }
    });

    test("R2: ausência de prazo e situação do prazo aparecem por escrito", async () => {
      const { abas } = await exportar(u.gestorA, "R2");
      const [cabecalho, ...linhas] = abas.get("Compromissos") ?? [];
      expect(linhas).toHaveLength(3);
      const compartilhado = linhas.find((l) => l[0] === `Compromisso compartilhado ${sufixo}`)!;
      expect(compartilhado[cabecalho.indexOf("Prazo")]).toBe("Sem prazo");
      expect(compartilhado[cabecalho.indexOf("Situação do prazo")]).toBe("Sem prazo");
      expect(compartilhado[cabecalho.indexOf("Tipo de responsável")]).toBe("Externo");
      expect(compartilhado[cabecalho.indexOf("Projetos e temas")]).toBe(NOME_A);
      const vencido = linhas.find((l) => l[0] === `Compromisso A vencido ${sufixo}`)!;
      expect(vencido[cabecalho.indexOf("Situação do prazo")]).toBe("Prazo vencido");
    });

    test("R3: só a versão vigente nas ações e nos marcos; rascunho em aba própria; sem situação por escrito", async () => {
      const { abas, texto } = await exportar(u.gestorA, "R3");
      const [cabecalho, ...acoes] = abas.get("Ações") ?? [];
      expect(acoes).toHaveLength(3);
      expect(texto).not.toContain(`Ação só no rascunho ${sufixo}`);
      expect(abas.get("Marcos")).toHaveLength(2);
      const versoes = abas.get("Versões não aprovadas") ?? [];
      expect(versoes.slice(1).map((l) => l.slice(2))).toEqual([["2", "Em elaboração (rascunho)", "4", "1"]]);
      const concluida = acoes.find((l) => l[4] === `Ação A concluída ${sufixo}`)!;
      expect(concluida[cabecalho.indexOf("Concluída em")]).toBe("10/03/2020");
      expect(concluida[cabecalho.indexOf("Percentual informado")]).toBe("100");
      const semPrazo = acoes.find((l) => l[4] === `'+1+1 Ação sem prazo ${sufixo}`)!;
      expect(semPrazo[cabecalho.indexOf("Situação")]).toBe("Sem situação registrada");
      expect(semPrazo[cabecalho.indexOf("Fim previsto")]).toBe("Sem prazo");
      expect(semPrazo[cabecalho.indexOf("Percentual informado")]).toBe("");
      // D-089 (V-02): responsável da equipe e responsável externo em colunas próprias, sem perda.
      expect(cabecalho).toContain("Responsável da equipe");
      expect(cabecalho).toContain("Responsável externo");
      expect(cabecalho).not.toContain("Responsável");
      expect(semPrazo[cabecalho.indexOf("Responsável da equipe")]).toBe("Sem responsável da equipe");
      expect(semPrazo[cabecalho.indexOf("Responsável externo")]).toBe(AVALIADO_A);
      const atrasada = acoes.find((l) => l[4] === `Ação A atrasada ${sufixo}`)!;
      expect(atrasada[cabecalho.indexOf("Responsável da equipe")]).not.toBe("Sem responsável da equipe");
      expect(atrasada[cabecalho.indexOf("Responsável externo")]).toBe("Sem responsável externo");
    });

    test("R4: inerente e residual em pontos e faixas, sem percentuais, e P-049 identificada", async () => {
      const { abas, texto } = await exportar(u.gestorA, "R4");
      expect(texto).not.toContain("%");
      const [cabecalho, ...linhas] = abas.get("Riscos") ?? [];
      expect(cabecalho).toContain("A reavaliar (regra provisória P-049)");
      const residual = linhas.find((l) => l[2] === `Risco A residual ${sufixo}`)!;
      expect(residual[cabecalho.indexOf("Inerente: criticidade")]).toBe("25");
      expect(residual[cabecalho.indexOf("Inerente: faixa")]).toBe("Crítico");
      expect(residual[cabecalho.indexOf("Residual: criticidade")]).toBe("8");
      expect(residual[cabecalho.indexOf("Residual: faixa")]).toBe("Moderado");
      expect(residual[cabecalho.indexOf("Diferença em pontos (residual − inerente)")]).toBe("-17");
      expect(residual[cabecalho.indexOf("Mudou de faixa")]).toBe("Sim");
      const inerente = linhas.find((l) => l[2] === `Risco A inerente ${sufixo}`)!;
      expect(inerente[cabecalho.indexOf("Residual: faixa")]).toBe("Sem avaliação residual");
      expect(inerente[cabecalho.indexOf("Dono")]).toBe("Sem dono");
      expect(inerente[cabecalho.indexOf("Próxima revisão")]).toBe("Sem data de revisão");
    });
  });
}
