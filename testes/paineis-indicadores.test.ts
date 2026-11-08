// @vitest-environment node
/**
 * Regras de cálculo dos painéis (D-079), sobre dados fictícios montados à mão: ausências não viram
 * outro valor, só a versão vigente conta na execução, cada indicador diz a data usada, período usa a
 * data efetiva e projeto em mais de um comitê conta uma vez no total.
 */
import ExcelJS from "exceljs";
import { describe, expect, test } from "vitest";
import type { AcaoDoPainel, CompromissoDoPainel, DadosDoPainel, IniciativaDoPainel, InteracaoDoPainel, PlanoDoPainel, ProjetoDoPainel, RiscoDoPainel } from "@/modulos/paineis/dados";
import { dentroDoPeriodo, type FiltrosPainel, lerFiltros, parametrosDosFiltros } from "@/modulos/paineis/filtros";
import { type Bloco, calcularBlocos, calcularPanorama, calcularPorProjeto, projetosNoEscopo } from "@/modulos/paineis/indicadores";
import { gerarXlsx } from "@/modulos/paineis/xlsx";

const HOJE = "2026-06-15";
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const C1 = ID(1);
const C2 = ID(2);
const P1 = ID(11);
const P2 = ID(12);
const U1 = ID(21);

const projeto = (id: string, comiteId: string, participantes: string[] = []): ProjetoDoPainel => ({
  id,
  nome: `Projeto ${id.slice(-2)}`,
  tipo: "projeto",
  situacao: "ativo",
  comiteId,
  comiteNome: comiteId === C1 ? "Comitê 1" : "Comitê 2",
  participantes,
});

const iniciativa = (n: number, extra: Partial<IniciativaDoPainel> = {}): IniciativaDoPainel => ({
  id: ID(100 + n),
  titulo: `Iniciativa ${n}`,
  tipo: "demanda",
  situacao: "em_andamento",
  prioridade: "alta",
  responsavelId: U1,
  dataAbertura: "2026-01-10",
  dataPrevistaConclusao: "2026-12-01",
  dataConclusao: null,
  projetos: [P1],
  ...extra,
});

const interacao = (n: number, extra: Partial<InteracaoDoPainel> = {}): InteracaoDoPainel => ({
  id: ID(200 + n),
  tipo: "email",
  situacao: "realizada",
  data: "2026-03-10",
  projetos: [P1],
  participantesInternos: [U1],
  ...extra,
});

const compromisso = (n: number, extra: Partial<CompromissoDoPainel> = {}): CompromissoDoPainel => ({
  id: ID(300 + n),
  descricao: `Compromisso ${n}`,
  situacao: "aberto",
  prazo: "2026-12-01",
  concluidoEm: null,
  responsavelUsuarioId: U1,
  responsavelNome: "Pessoa da equipe",
  responsavelExterno: false,
  origem: "interacao",
  projetos: [P1],
  ...extra,
});

const acao = (n: number, extra: Partial<AcaoDoPainel> = {}): AcaoDoPainel =>
  ({
    acaoId: ID(400 + n),
    codigo: `A-${n}`,
    titulo: `Ação ${n}`,
    responsavelUsuarioId: U1,
    responsavelStakeholderId: null,
    fimPrevisto: "2026-12-01",
    inicioPrevisto: null,
    andamento: { situacao: "em_andamento", percentual: null, data: "2026-02-01" },
    atrasada: false,
    marcos: [],
    dataConclusao: null,
    ...extra,
  }) as AcaoDoPainel;

const plano = (n: number, extra: Partial<PlanoDoPainel> = {}): PlanoDoPainel => ({
  id: ID(500 + n),
  titulo: `Plano ${n}`,
  projetoTemaId: P1,
  vigente: { id: ID(600 + n), numeroVersao: 1 },
  acoes: [],
  naoAprovadas: [],
  ...extra,
});

const risco = (n: number, extra: Partial<RiscoDoPainel> = {}): RiscoDoPainel =>
  ({
    id: ID(700 + n),
    codigo: `R-${n}`,
    titulo: `Risco ${n}`,
    projetoTemaId: P1,
    situacao: "aberto",
    responsavelId: U1,
    responsavelNome: "Pessoa da equipe",
    proximaRevisao: "2026-12-01",
    inerente: null,
    residual: null,
    vigente: null,
    reavaliacao: [],
    gatilhoOcorrido: false,
    gatilhosOcorridosEm: [],
    ...extra,
  }) as unknown as RiscoDoPainel;

const avaliacaoRisco = (classificacao: string, criticidade: number, dataAvaliacao = "2026-02-01") => ({
  dataAvaliacao,
  probabilidade: 3,
  impacto: 3,
  criticidade,
  classificacao,
});

const vigenteDaFicha = (extra: object = {}) => ({
  numeroVersao: 1,
  metodologiaId: ID(900),
  metodologiaNome: "V2.2",
  poder: null,
  interesse: null,
  nivelPoder: "alto" as const,
  nivelInteresse: "baixo" as const,
  posicionamento: "favoravel" as const,
  naturezaPosicionamento: "manifestacao_formal" as const,
  grauConfianca: null,
  situacaoRessalvas: "nao_identificadas" as const,
  dataReferencia: "2026-02-01",
  proximaRevisao: "2027-02-01",
  ...extra,
});

const ficha = (n: number, vigente: ReturnType<typeof vigenteDaFicha> | null) => ({
  stakeholderId: ID(800 + n),
  nome: `Stakeholder ${n}`,
  tipoStakeholder: "pessoa" as const,
  associado: true,
  temRascunho: false,
  vigente,
});

function dadosDe(parcial: Partial<DadosDoPainel> = {}): DadosDoPainel {
  return {
    comites: [
      { id: C1, nome: "Comitê 1" },
      { id: C2, nome: "Comitê 2" },
    ],
    projetos: [projeto(P1, C1, [C2]), projeto(P2, C2)],
    iniciativas: [],
    interacoes: [],
    compromissos: [],
    planos: [],
    riscos: [],
    fichas: [],
    metodologia: { id: ID(900), nome: "V2.2", ordinal: true },
    usuarios: [{ id: U1, nome: "Pessoa da equipe" }],
    ...parcial,
  };
}

function indicador(blocos: Bloco[], blocoId: string, rotulo: string, grupo?: string) {
  const bloco = blocos.find((b) => b.id === blocoId);
  const encontrados = (bloco?.grupos ?? [])
    .filter((g) => !grupo || g.titulo === grupo)
    .flatMap((g) => g.indicadores)
    .filter((i) => i.rotulo === rotulo);
  if (encontrados.length !== 1) throw new Error(`${encontrados.length} indicadores "${rotulo}" em ${blocoId}`);
  return encontrados[0];
}

function blocos(dados: DadosDoPainel, filtros: FiltrosPainel = {}) {
  return calcularBlocos(dados, projetosNoEscopo(dados, filtros), filtros, HOJE);
}

const valor = (b: Bloco[], blocoId: string, rotulo: string, grupo?: string) => indicador(b, blocoId, rotulo, grupo).valor;

describe("A. Ausência de dados não vira outro valor", () => {
  test("risco sem avaliação não é contado como baixo nem em nenhuma faixa", () => {
    const b = blocos(dadosDe({ riscos: [risco(1)] }));
    expect(valor(b, "riscos", "Sem avaliação")).toBe(1);
    for (const faixa of ["Baixo", "Moderado", "Alto", "Crítico"]) expect(valor(b, "riscos", faixa)).toBe(0);
  });

  test("stakeholder sem avaliação e eixo não avaliado nunca contam como nível baixo", () => {
    const b = blocos(
      dadosDe({
        fichas: [{ projetoTemaId: P1, fichas: [ficha(1, null), ficha(2, vigenteDaFicha({ nivelPoder: null, nivelInteresse: null, posicionamento: null, situacaoRessalvas: null, naturezaPosicionamento: null }))] }],
      }),
    );
    expect(valor(b, "stakeholders", "Associados sem avaliação publicada")).toBe(1);
    expect(valor(b, "stakeholders", "Avaliações na metodologia vigente")).toBe(1);
    expect(valor(b, "stakeholders", "Baixo", "Poder")).toBe(0);
    expect(valor(b, "stakeholders", "Não avaliado", "Poder")).toBe(1);
    expect(valor(b, "stakeholders", "Baixo", "Interesse")).toBe(0);
    expect(valor(b, "stakeholders", "Não avaliado", "Interesse")).toBe(1);
    expect(valor(b, "stakeholders", "Não avaliado", "Posicionamento")).toBe(1);
    expect(valor(b, "stakeholders", "Natureza não informada")).toBe(1);
    expect(valor(b, "stakeholders", "Ressalvas: não se aplica (sem manifestação identificada)")).toBe(1);
  });

  test("compromisso sem prazo não é vencido, nem a vencer, nem pontual, e sem responsável fica à parte", () => {
    const b = blocos(dadosDe({ compromissos: [compromisso(1, { prazo: null, responsavelNome: null, responsavelUsuarioId: null })] }));
    expect(valor(b, "compromissos", "Pendentes")).toBe(1);
    expect(valor(b, "compromissos", "Pendentes sem prazo")).toBe(1);
    expect(valor(b, "compromissos", "Pendentes sem responsável")).toBe(1);
    expect(valor(b, "compromissos", "Vencidos")).toBe(0);
    expect(valor(b, "compromissos", "A vencer em 30 dias")).toBe(0);
    expect(indicador(b, "compromissos", "Pendentes sem prazo").nota).toMatch(/não significa em dia/);
    expect(indicador(b, "compromissos", "A vencer em 30 dias").nota).toMatch(/provisória \(P-061\)/);
  });

  test("ação sem situação não é não iniciada, e ação sem fim previsto não é atrasada nem em dia", () => {
    const b = blocos(
      dadosDe({ planos: [plano(1, { acoes: [acao(1, { andamento: { situacao: null, percentual: null, data: null }, fimPrevisto: null })] })] }),
    );
    expect(valor(b, "planos", "Sem situação registrada")).toBe(1);
    expect(valor(b, "planos", "Não iniciada")).toBe(0);
    expect(valor(b, "planos", "Sem fim previsto")).toBe(1);
    expect(valor(b, "planos", "Atrasadas")).toBe(0);
  });

  test("D-090: 'Com responsável externo' conta toda ação com externo, inclusive com corresponsável da equipe, uma vez cada", () => {
    const S1 = ID(901);
    const S2 = ID(902);
    const acoes = [
      acao(1, { responsavelUsuarioId: U1, responsavelStakeholderId: null }), // só equipe: não conta
      acao(2, { responsavelUsuarioId: null, responsavelStakeholderId: S1 }), // só externo: conta
      acao(3, { responsavelUsuarioId: U1, responsavelStakeholderId: S2 }), // equipe e externo: conta uma vez
      acao(4, { responsavelUsuarioId: null, responsavelStakeholderId: null }), // sem responsável: não conta
    ];
    const dados = dadosDe({ planos: [plano(1, { acoes })] });
    const geral = blocos(dados);
    expect(valor(geral, "planos", "Com responsável externo")).toBe(2);
    expect(indicador(geral, "planos", "Com responsável externo").nota).toMatch(/também têm responsável da equipe/);
    // Os demais totais do bloco não mudam.
    expect(valor(geral, "planos", "Ações")).toBe(4);
    expect(valor(geral, "planos", "Em andamento")).toBe(4);
    expect(valor(geral, "planos", "Atrasadas")).toBe(0);
    // Painel geral filtrado pelo projeto e painel do projeto (mesmo escopo) dão o mesmo resultado.
    const filtrado = blocos(dados, { projetoTemaId: P1 });
    const doProjeto = calcularBlocos(dados, new Set([P1]), { projetoTemaId: P1 }, HOJE);
    expect(valor(filtrado, "planos", "Com responsável externo")).toBe(2);
    expect(valor(doProjeto, "planos", "Com responsável externo")).toBe(2);
  });

  test("iniciativa sem previsão, sem responsável e sem prioridade é contada à parte", () => {
    const b = blocos(dadosDe({ iniciativas: [iniciativa(1, { dataPrevistaConclusao: null, responsavelId: null, prioridade: null })] }));
    expect(valor(b, "iniciativas", "Em curso sem previsão de conclusão")).toBe(1);
    expect(valor(b, "iniciativas", "Em curso com previsão de conclusão vencida")).toBe(0);
    expect(valor(b, "iniciativas", "Sem responsável")).toBe(1);
    expect(valor(b, "iniciativas", "Sem prioridade informada")).toBe(1);
  });
});

describe("Stakeholders: complemento H5 e filtro de responsável", () => {
  test("posicionamento não avaliado com manifestação registrada é situação específica, em grupo próprio", () => {
    const b = blocos(
      dadosDe({
        fichas: [
          {
            projetoTemaId: P1,
            fichas: [
              ficha(1, vigenteDaFicha({ posicionamento: null, situacaoRessalvas: "ha_ressalvas", naturezaPosicionamento: null })),
              ficha(2, vigenteDaFicha({ posicionamento: null, situacaoRessalvas: null, naturezaPosicionamento: "manifestacao_formal" })),
              ficha(3, vigenteDaFicha({ posicionamento: null, situacaoRessalvas: null, naturezaPosicionamento: "percepcao_consultor" })),
              ficha(4, vigenteDaFicha({ posicionamento: null, situacaoRessalvas: null, naturezaPosicionamento: null })),
              ficha(5, vigenteDaFicha()),
            ],
          },
        ],
      }),
    );
    expect(valor(b, "stakeholders", "Não avaliado", "Posicionamento")).toBe(4);
    const rotulo = "Posicionamento não avaliado, com manifestação registrada";
    expect(valor(b, "stakeholders", rotulo, "Situação específica (não é classificação de stakeholder)")).toBe(2);
    expect(indicador(b, "stakeholders", rotulo).nota).toMatch(/Não é nível, posicionamento nem quarta categoria/);
    // Não entra no grupo de classificação: os números de Posicionamento continuam somando o total.
    const posicionamento = b.find((x) => x.id === "stakeholders")?.grupos.find((g) => g.titulo === "Posicionamento")?.indicadores ?? [];
    expect(posicionamento.map((i) => i.rotulo)).toEqual(["Favorável", "Neutro", "Contrário", "Não avaliado"]);
    expect(posicionamento.reduce((s, i) => s + Number(i.valor), 0)).toBe(5);
    expect(valor(b, "stakeholders", "Favorável")).toBe(1);
  });

  test("filtro de responsável: só as avaliações registradas pela pessoa; sem avaliação sai da contagem", () => {
    const dados = dadosDe({
      fichas: [{ projetoTemaId: P1, fichas: [ficha(1, vigenteDaFicha({ avaliadorId: U1 })), ficha(2, vigenteDaFicha({ avaliadorId: ID(22) })), ficha(3, null)] }],
    });
    const semFiltro = blocos(dados);
    expect(valor(semFiltro, "stakeholders", "Avaliações na metodologia vigente")).toBe(2);
    expect(valor(semFiltro, "stakeholders", "Associados sem avaliação publicada")).toBe(1);
    const comFiltro = blocos(dados, { responsavelId: U1 });
    expect(valor(comFiltro, "stakeholders", "Avaliações na metodologia vigente")).toBe(1);
    expect(valor(comFiltro, "stakeholders", "Associados sem avaliação publicada")).toBe(0);
    expect(comFiltro.find((x) => x.id === "stakeholders")?.descricao).toMatch(/Com filtro de responsável/);
  });
});

describe("B. Só a versão vigente conta na execução", () => {
  test("versões em elaboração e em aprovação aparecem à parte, sem dupla contagem", () => {
    const b = blocos(
      dadosDe({
        planos: [
          plano(1, {
            acoes: [acao(1), acao(2, { atrasada: true })],
            naoAprovadas: [
              { numeroVersao: 2, situacao: "em_aprovacao", acoes: 3, marcos: 2 },
              { numeroVersao: 3, situacao: "rascunho", acoes: 4, marcos: 1 },
            ],
          }),
          plano(2, { vigente: null, projetoTemaId: P2, naoAprovadas: [{ numeroVersao: 1, situacao: "rascunho", acoes: 5, marcos: 0 }] }),
        ],
      }),
    );
    expect(valor(b, "planos", "Ações")).toBe(2);
    expect(valor(b, "planos", "Atrasadas")).toBe(1);
    expect(valor(b, "planos", "Com versão vigente")).toBe(1);
    expect(valor(b, "planos", "Sem versão vigente")).toBe(1);
    expect(valor(b, "planos", "Em elaboração (rascunho)")).toBe(2);
    expect(valor(b, "planos", "Em aprovação")).toBe(1);
    expect(valor(b, "planos", "Ações nessas versões")).toBe(12);
    expect(valor(b, "planos", "Marcos nessas versões")).toBe(3);
    expect(b.find((x) => x.id === "planos")?.grupos.at(-1)?.titulo).toMatch(/não somadas/);
  });
});

describe("C. Períodos", () => {
  const filtros: FiltrosPainel = { de: "2026-03-01", ate: "2026-03-31" };

  test("conclusão no período usa a data efetiva, não o prazo", () => {
    const b = blocos(
      dadosDe({
        iniciativas: [
          iniciativa(1, { situacao: "concluida", dataConclusao: "2026-03-10", dataPrevistaConclusao: "2026-05-01" }),
          iniciativa(2, { situacao: "concluida", dataConclusao: "2026-05-10", dataPrevistaConclusao: "2026-03-10" }),
        ],
        compromissos: [
          compromisso(1, { situacao: "concluido", concluidoEm: "2026-03-20", prazo: "2026-01-01" }),
          compromisso(2, { situacao: "concluido", concluidoEm: "2026-01-20", prazo: "2026-03-20" }),
        ],
        planos: [
          plano(1, {
            acoes: [
              acao(1, { andamento: { situacao: "concluida", percentual: null, data: "2026-03-05" }, dataConclusao: "2026-03-05", fimPrevisto: "2026-01-01" }),
              acao(2, { andamento: { situacao: "concluida", percentual: null, data: "2026-05-05" }, dataConclusao: "2026-05-05", fimPrevisto: "2026-03-05" }),
            ],
          }),
        ],
      }),
      filtros,
    );
    expect(valor(b, "iniciativas", "Concluídas no período")).toBe(1);
    expect(indicador(b, "iniciativas", "Concluídas no período").dataUsada).toBe("Data efetiva de conclusão");
    expect(valor(b, "compromissos", "Concluídos no período")).toBe(1);
    expect(indicador(b, "compromissos", "Concluídos no período").dataUsada).toBe("Data efetiva de conclusão");
    expect(valor(b, "planos", "Concluídas no período")).toBe(1);
    expect(valor(b, "compromissos", "Com prazo no período")).toBe(1);
    expect(valor(b, "planos", "Fim previsto no período")).toBe(1);
  });

  test("concluído sem data não entra em período algum: a limitação fica informada", () => {
    const dados = dadosDe({
      iniciativas: [iniciativa(1, { situacao: "concluida", dataConclusao: null, dataPrevistaConclusao: "2026-03-10" })],
      compromissos: [compromisso(1, { situacao: "concluido", concluidoEm: null, prazo: "2026-03-10" })],
      planos: [plano(1, { acoes: [acao(1, { andamento: { situacao: "concluida", percentual: null, data: null }, dataConclusao: null, fimPrevisto: "2026-03-10" })] })],
    });
    for (const f of [filtros, {}]) {
      const b = blocos(dados, f);
      const sufixo = f === filtros ? "no período" : "(todo o histórico)";
      expect(valor(b, "iniciativas", `Concluídas ${sufixo}`)).toBe(0);
      expect(valor(b, "compromissos", `Concluídos ${sufixo}`)).toBe(0);
      expect(valor(b, "planos", `Concluídas ${sufixo}`)).toBe(0);
      expect(valor(b, "iniciativas", "Concluídas sem data registrada")).toBe(1);
      expect(valor(b, "compromissos", "Concluídos sem data registrada")).toBe(1);
      expect(valor(b, "planos", "Concluídas sem data registrada")).toBe(1);
      expect(indicador(b, "iniciativas", "Concluídas sem data registrada").nota).toMatch(/Não contadas/);
    }
  });

  test("todo indicador informa a data usada, e situação atual não muda com o período", () => {
    const dados = dadosDe({
      iniciativas: [iniciativa(1)],
      interacoes: [interacao(1)],
      compromissos: [compromisso(1, { prazo: "2020-01-01" })],
      planos: [plano(1, { acoes: [acao(1)] })],
      riscos: [risco(1)],
      fichas: [{ projetoTemaId: P1, fichas: [ficha(1, vigenteDaFicha())] }],
    });
    const comPeriodo = blocos(dados, { de: "2031-01-01", ate: "2031-12-31" });
    for (const bloco of comPeriodo) {
      for (const i of bloco.grupos.flatMap((g) => g.indicadores)) expect(i.dataUsada, i.rotulo).not.toBe("");
    }
    expect(valor(comPeriodo, "compromissos", "Pendentes")).toBe(1);
    expect(valor(comPeriodo, "compromissos", "Vencidos")).toBe(1);
    expect(valor(comPeriodo, "iniciativas", "Em curso")).toBe(1);
    expect(valor(comPeriodo, "iniciativas", "Abertas no período")).toBe(0);
  });

  test("interação entra no período pela data de início; sem período, todo o histórico", () => {
    const dados = dadosDe({ interacoes: [interacao(1, { data: "2026-03-10" }), interacao(2, { data: "2026-04-10" }), interacao(3, { data: "2026-03-11", situacao: "agendada" })] });
    const noPeriodo = blocos(dados, filtros);
    expect(valor(noPeriodo, "interacoes", "Realizada", "Situação no período")).toBe(1);
    expect(valor(noPeriodo, "interacoes", "Agendada", "Situação no período")).toBe(1);
    expect(indicador(noPeriodo, "interacoes", "Realizada", "Situação no período").dataUsada).toBe("Data de início da interação");
    expect(valor(blocos(dados), "interacoes", "Realizada", "Situação (todo o histórico)")).toBe(2);
    expect(valor(blocos(dados), "interacoes", "Última interação realizada")).toBe("10/04/2026");
  });

  test("sem data nunca entra; só um limite do período também funciona", () => {
    expect(dentroDoPeriodo(null, {})).toBe(false);
    expect(dentroDoPeriodo("2026-03-01", {})).toBe(true);
    expect(dentroDoPeriodo("2026-03-01", { de: "2026-03-01" })).toBe(true);
    expect(dentroDoPeriodo("2026-02-28", { de: "2026-03-01" })).toBe(false);
    expect(dentroDoPeriodo("2026-03-31", { ate: "2026-03-31" })).toBe(true);
    expect(dentroDoPeriodo("2026-04-01", { ate: "2026-03-31" })).toBe(false);
  });
});

describe("Janela de a vencer (parâmetro provisório P-061)", () => {
  test("conta do dia de hoje até 30 dias depois; vencido e prazo posterior ficam fora", () => {
    const b = blocos(
      dadosDe({
        compromissos: [
          compromisso(1, { prazo: HOJE }),
          compromisso(2, { prazo: "2026-07-15" }),
          compromisso(3, { prazo: "2026-07-16" }),
          compromisso(4, { prazo: "2026-06-14" }),
          compromisso(5, { prazo: "2026-07-01", situacao: "concluido", concluidoEm: "2026-06-01" }),
        ],
      }),
    );
    expect(valor(b, "compromissos", "A vencer em 30 dias")).toBe(2);
    expect(valor(b, "compromissos", "Vencidos")).toBe(1);
    expect(valor(b, "compromissos", "Pendentes")).toBe(4);
  });
});

describe("D. Mais de um comitê e registros compartilhados", () => {
  const dados = dadosDe({
    iniciativas: [iniciativa(1, { projetos: [P1, P2] }), iniciativa(2, { projetos: [P2] })],
    interacoes: [interacao(1, { projetos: [P1, P2] })],
    compromissos: [compromisso(1, { projetos: [P1, P2], prazo: "2020-01-01" })],
    planos: [plano(1, { acoes: [acao(1)] })],
    riscos: [risco(1, { vigente: avaliacaoRisco("alto", 15), inerente: avaliacaoRisco("alto", 15) } as never)],
    fichas: [{ projetoTemaId: P1, fichas: [ficha(1, vigenteDaFicha())] }, { projetoTemaId: P2, fichas: [ficha(1, null)] }],
  });

  test("o projeto aparece em cada comitê, mas conta uma vez no total", () => {
    const { linhas, total } = calcularPanorama(dados, projetosNoEscopo(dados, {}), {}, HOJE);
    const [c1, c2] = linhas;
    expect([c1.projetosPrincipais, c1.projetosParticipantes]).toEqual([1, 0]);
    expect([c2.projetosPrincipais, c2.projetosParticipantes]).toEqual([1, 1]);
    expect(total.projetosPrincipais).toBe(2);
    // O risco é do projeto ligado aos dois comitês: está nas duas linhas, uma vez no total.
    expect(c1.riscosPorClassificacao.alto).toBe(1);
    expect(c2.riscosPorClassificacao.alto).toBe(1);
    expect(total.riscosPorClassificacao.alto).toBe(1);
    expect(total.acoesVigentes).toBe(1);
    expect(c1.acoesVigentes + c2.acoesVigentes).toBe(2);
  });

  test("registro ligado a dois projetos conta uma vez no total e uma vez em cada projeto", () => {
    const escopo = projetosNoEscopo(dados, {});
    const { total } = calcularPanorama(dados, escopo, {}, HOJE);
    expect(total.iniciativasEmCurso).toBe(2);
    expect(total.interacoesNoPeriodo).toBe(1);
    expect(total.compromissosPendentes).toBe(1);
    expect(total.compromissosVencidos).toBe(1);
    const porProjeto = calcularPorProjeto(dados, escopo, {}, HOJE);
    expect(porProjeto.map((l) => l.compromissosPendentes)).toEqual([1, 1]);
    expect(porProjeto.map((l) => l.iniciativasEmCurso)).toEqual([1, 2]);
    // O mesmo stakeholder em dois contextos: uma avaliação e um "sem avaliação", sem se somarem.
    expect([total.stakeholdersAvaliados, total.stakeholdersSemAvaliacao]).toEqual([1, 1]);
  });

  test("filtro de comitê considera principal e participante; o total só recalcula o escopo", () => {
    expect([...projetosNoEscopo(dados, { comiteId: C1 })]).toEqual([P1]);
    expect([...projetosNoEscopo(dados, { comiteId: C2 })].sort()).toEqual([P1, P2]);
    const filtro = { comiteId: C1 };
    const { linhas, total } = calcularPanorama(dados, projetosNoEscopo(dados, filtro), filtro, HOJE);
    expect(linhas.map((l) => l.comiteId)).toEqual([C1]);
    expect(total.iniciativasEmCurso).toBe(1);
  });

  test("o limite de projetos corta o escopo, qualquer que seja o filtro pedido", () => {
    expect([...projetosNoEscopo(dados, {}, new Set([P1]))]).toEqual([P1]);
    expect([...projetosNoEscopo(dados, { projetoTemaId: P2 }, new Set([P1]))]).toEqual([]);
  });

  test("filtro de responsável vale para quem tem responsável; externos e ausentes ficam fora", () => {
    const comOutros = dadosDe({
      compromissos: [compromisso(1), compromisso(2, { responsavelUsuarioId: ID(22) }), compromisso(3, { responsavelUsuarioId: null, responsavelExterno: true })],
      planos: [plano(1, { acoes: [acao(1), acao(2, { responsavelUsuarioId: ID(22) })] })],
      riscos: [risco(1), risco(2, { responsavelId: null } as never)],
    });
    const b = blocos(comOutros, { responsavelId: U1 });
    expect(valor(b, "compromissos", "Pendentes")).toBe(1);
    expect(valor(b, "planos", "Ações")).toBe(1);
    expect(valor(b, "riscos", "Riscos")).toBe(1);
  });
});

describe("E. Riscos e indicadores sem metodologia aprovada", () => {
  const dados = dadosDe({
    riscos: [
      risco(1, { inerente: avaliacaoRisco("critico", 25), residual: avaliacaoRisco("moderado", 8), vigente: avaliacaoRisco("moderado", 8), reavaliacao: ["revisao_vencida"], proximaRevisao: "2020-01-01" } as never),
      risco(2, { inerente: avaliacaoRisco("alto", 15), residual: avaliacaoRisco("alto", 12), vigente: avaliacaoRisco("alto", 12) } as never),
      risco(3, { inerente: avaliacaoRisco("baixo", 2), vigente: avaliacaoRisco("baixo", 2), gatilhosOcorridosEm: ["2026-03-05"], gatilhoOcorrido: true } as never),
    ],
  });

  test("classificação vigente, faixas comparadas e a regra provisória P-049 identificada", () => {
    const b = blocos(dados);
    expect(valor(b, "riscos", "Moderado")).toBe(1);
    expect(valor(b, "riscos", "Alto")).toBe(1);
    expect(valor(b, "riscos", "Baixo")).toBe(1);
    expect(valor(b, "riscos", "Com avaliação residual")).toBe(2);
    expect(valor(b, "riscos", "Só com avaliação inerente")).toBe(1);
    expect(valor(b, "riscos", "Mudaram de faixa")).toBe(1);
    expect(valor(b, "riscos", "Mantiveram a faixa")).toBe(1);
    expect(valor(b, "riscos", "A reavaliar")).toBe(1);
    expect(indicador(b, "riscos", "A reavaliar").nota).toMatch(/provisória P-049/);
    expect(valor(b, "riscos", "Revisão vencida")).toBe(1);
    expect(valor(b, "riscos", "Com gatilho ocorrido (todo o histórico)")).toBe(1);
  });

  test("nenhum percentual, índice, ranking ou indicador de saúde em qualquer bloco", () => {
    for (const bloco of blocos(dados)) {
      for (const i of bloco.grupos.flatMap((g) => g.indicadores)) {
        expect(String(i.valor)).not.toContain("%");
        expect(i.rotulo).not.toMatch(/índice|ranking|saúde|%|redução/i);
      }
    }
  });
});

describe("Legibilidade do arquivo", () => {
  test("a coluna acompanha o conteúdo, com limite; título longo não alarga coluna de números", async () => {
    const conteudo = await gerarXlsx({
      nomeArquivo: "teste.xlsx",
      abas: [
        {
          nome: "Teste",
          cabecalho: ["Valor", "Título muito longo de uma coluna que só tem números", "Curto"],
          linhas: [["texto ".repeat(40), 1, "abc"], ["curto", 2, null]],
        },
      ],
    });
    const pasta = new ExcelJS.Workbook();
    await pasta.xlsx.load(conteudo as never);
    const larguras = (pasta.getWorksheet("Teste")?.columns ?? []).map((c) => c.width);
    expect(larguras).toEqual([60, 20, 10]);
  });
});

describe("Filtros no endereço", () => {
  test("valores inválidos são ignorados e o período invertido é avisado, sem aplicar", () => {
    expect(lerFiltros({ comite: "abc", projeto: ID(1), de: "ontem", ate: "2026-13-40" })).toEqual({
      filtros: { comiteId: undefined, projetoTemaId: ID(1), responsavelId: undefined, de: undefined, ate: undefined },
      periodoInvertido: false,
    });
    const invertido = lerFiltros({ de: "2026-05-01", ate: "2026-01-01" });
    expect(invertido.periodoInvertido).toBe(true);
    expect(invertido.filtros.de).toBeUndefined();
    expect(invertido.filtros.ate).toBeUndefined();
  });

  test("o endereço ida e volta mantém os filtros", () => {
    const filtros = { comiteId: C1, projetoTemaId: P1, responsavelId: U1, de: "2026-01-01", ate: "2026-02-01" };
    const texto = parametrosDosFiltros(filtros);
    expect(lerFiltros(Object.fromEntries(new URLSearchParams(texto))).filtros).toEqual(filtros);
    expect(parametrosDosFiltros({})).toBe("");
  });
});
