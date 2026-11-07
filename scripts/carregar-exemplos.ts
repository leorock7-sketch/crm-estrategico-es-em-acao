/**
 * Carrega pessoas, instituições, vínculos, contatos, projetos e temas FICTÍCIOS
 * no banco local, para testes e demonstração. Comando: npm run banco:exemplos
 *
 * Cada grupo só é carregado se ainda estiver vazio: pessoas e instituições,
 * se não houver nenhuma pessoa; projetos e temas, se não houver nenhum;
 * metodologias e avaliações, se não houver nenhuma metodologia; iniciativas,
 * interações e compromissos (Etapa 3), se não houver nenhuma iniciativa; plano de ação e
 * riscos (Etapa 4), se não houver nenhum plano. As metodologias
 * de DEMONSTRAÇÃO (0 a 100) ficam como histórico; a vigente é a V2.2, com as
 * rubricas homologadas (Q-66 1.0). Todas as avaliações são fictícias.
 *
 * Execute com a aplicação parada (o banco local aceita um processo por vez;
 * se estiver em uso, o script avisa e não grava nada). Nenhum dado aqui
 * corresponde a pessoa ou instituição real.
 */
import { type Banco, comoUsuario, diretorioDoBanco, fecharBanco, obterBancoBase } from "@/lib/banco/conexao";
import { isNull } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";
import { compromisso, iniciativa, instituicao, metodologiaVersao, pessoa, planoAcao, projetoTema, risco, usuario } from "@/lib/banco/esquema";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import {
  adicionarEvidencia,
  alterarSituacaoMetodologia,
  criarMetodologia,
  criteriosDaMetodologia,
  iniciarRascunho,
  type NovaMetodologia,
  publicarRascunho,
  salvarRascunho,
} from "@/modulos/avaliacoes/consultas";
import type { DadosRascunho } from "@/modulos/avaliacoes/esquemas";
import { METODOLOGIA_V22 } from "@/modulos/avaliacoes/rubricas-v22";
import { criarIniciativa, incluirStakeholderNaIniciativa } from "@/modulos/iniciativas/consultas";
import type { DadosNovaIniciativa } from "@/modulos/iniciativas/esquemas";
import type { PapelIniciativa } from "@/modulos/iniciativas/rotulos";
import { criarCompromisso, criarInteracao, incluirIniciativaNaInteracao, registrarAcompanhamento } from "@/modulos/interacoes/consultas";
import type { DadosAcompanhamento, DadosNovaInteracao } from "@/modulos/interacoes/esquemas";
import {
  atualizarAcaoPlanejada,
  atualizarEixo,
  converterCompromissoEmAcao,
  criarNovaVersao,
  criarPlano,
  decidirVersao,
  eixosDoPlano,
  enviarParaAprovacao,
  incluirAcaoNaVersao,
  incluirMarco,
  incluirStakeholderNaAcao,
  planejamentoDaVersao,
  registrarAcompanhamento as registrarAcompanhamentoDaAcao,
  versaoEmElaboracao,
} from "@/modulos/plano-acao/consultas";
import type { DadosAcaoPlanejada, DadosAcompanhamentoAcao } from "@/modulos/plano-acao/esquemas";
import {
  criarAssociacao,
  criarParticipacao,
  criarProjetoTema,
  encerrarParticipacao,
} from "@/modulos/projetos-temas/consultas";
import type { DadosAssociacao, DadosProjetoTema } from "@/modulos/projetos-temas/esquemas";
import {
  criarGatilho,
  criarResposta,
  criarRisco,
  eixosDoProjetoTema,
  gatilhosDoRisco,
  incluirStakeholderNoRisco,
  registrarAvaliacao,
  registrarOcorrenciaGatilho,
} from "@/modulos/riscos/consultas";
import type { DadosNovoRisco, DadosResposta } from "@/modulos/riscos/esquemas";
import {
  criarContato,
  criarInstituicao,
  criarPessoa,
  criarVinculo,
} from "@/modulos/stakeholders/consultas";
import type { DadosContato, DadosInstituicao, DadosPessoa } from "@/modulos/stakeholders/esquemas";

type ContatoExemplo = Pick<DadosContato, "tipo" | "valor" | "natureza"> & {
  principal?: boolean;
  /** Índice do vínculo da pessoa ao qual o contato funcional está ligado. */
  vinculo?: number;
};

const INSTITUICOES: (DadosInstituicao & { chave: string; superior?: string; contatos?: ContatoExemplo[] })[] = [
  { chave: "governo", nome: "Governo do Estado Exemplo", natureza: "orgao_publico", esfera: "estadual", uf: "ES" },
  { chave: "secretaria", superior: "governo", nome: "Secretaria Exemplo de Desenvolvimento", sigla: "SEXD", natureza: "orgao_publico", esfera: "estadual", uf: "ES", municipio: "Vitória",
    contatos: [{ tipo: "telefone", valor: "(27) 90000-1000", natureza: "institucional", principal: true }] },
  { chave: "prefeitura", nome: "Prefeitura Municipal de Vila Exemplo", natureza: "orgao_publico", esfera: "municipal", uf: "ES", municipio: "Vila Exemplo" },
  { chave: "federacao", nome: "Federação Exemplo da Indústria", sigla: "FEXI", natureza: "entidade_classe", esfera: "nao_se_aplica", uf: "ES" },
  { chave: "porto", nome: "Porto Modelo S.A.", natureza: "empresa", esfera: "nao_se_aplica", uf: "ES", cnpj: "12ABC34501DE35",
    contatos: [{ tipo: "site", valor: "https://porto.exemplo.org", natureza: "institucional", principal: true }] },
  // Subunidade que usa o CNPJ da empresa (decisão D-024: CNPJ repetido gera alerta, não bloqueio).
  { chave: "terminal", superior: "porto", nome: "Terminal de Cargas do Porto Modelo", natureza: "empresa", esfera: "nao_se_aplica", uf: "ES", cnpj: "12ABC34501DE35" },
  { chave: "universidade", nome: "Universidade Fictícia do Sudeste", sigla: "UFSE", natureza: "academia", esfera: "federal", uf: "ES" },
  { chave: "agencia", nome: "Agência Exemplo de Inovação", natureza: "terceiro_setor", esfera: "nao_se_aplica", uf: "ES" },
  { chave: "jornal", nome: "Jornal Diário Exemplo", natureza: "imprensa", esfera: "nao_se_aplica", uf: "ES" },
  // Instituição estrangeira, sem CNPJ e sem UF (correção C5).
  { chave: "estrangeira", nome: "Example Trade Agency", natureza: "orgao_publico", esfera: "nao_se_aplica", pais: "PT", municipio: "Lisboa" },
];

const PESSOAS: (DadosPessoa & {
  vinculos: { instituicao: string; cargo: string; inicio?: string; fim?: string; principal?: boolean }[];
  contatos?: ContatoExemplo[];
})[] = [
  { nomeCompleto: "Ana Exemplo Souza", nomeTratamento: "Secretária Ana",
    vinculos: [{ instituicao: "secretaria", cargo: "Secretária", inicio: "2025-01-02", principal: true }],
    contatos: [
      { tipo: "email", valor: "ana.souza@exemplo.org", natureza: "institucional", principal: true },
      { tipo: "telefone", valor: "(27) 90000-0001", natureza: "institucional", principal: true },
      // E-mail do gabinete, compartilhado com o subsecretário (decisão D-025).
      { tipo: "email", valor: "gabinete.sexd@exemplo.org", natureza: "funcional", vinculo: 0 },
    ] },
  { nomeCompleto: "Bruno Fictício Lima",
    vinculos: [{ instituicao: "secretaria", cargo: "Subsecretário de Investimentos", inicio: "2025-02-01", principal: true }],
    contatos: [
      { tipo: "email", valor: "bruno.lima@exemplo.org", natureza: "institucional", principal: true },
      { tipo: "email", valor: "gabinete.sexd@exemplo.org", natureza: "funcional", vinculo: 0 },
    ] },
  { nomeCompleto: "Carla Modelo Ribeiro", nomeTratamento: "Prefeita Carla",
    vinculos: [{ instituicao: "prefeitura", cargo: "Prefeita", inicio: "2025-01-01", principal: true }],
    contatos: [{ tipo: "email", valor: "carla.ribeiro@exemplo.org", natureza: "institucional", principal: true }] },
  { nomeCompleto: "Daniel Exemplo Rocha",
    vinculos: [{ instituicao: "federacao", cargo: "Presidente", inicio: "2024-03-15", principal: true }],
    contatos: [{ tipo: "email", valor: "daniel.rocha@exemplo.org", natureza: "institucional", principal: true }] },
  { nomeCompleto: "Eduarda Teste Martins",
    vinculos: [
      { instituicao: "porto", cargo: "Diretora de Relações Institucionais", inicio: "2026-02-01", principal: true },
      { instituicao: "secretaria", cargo: "Assessora Especial", inicio: "2023-01-10", fim: "2026-01-20" },
    ],
    contatos: [
      { tipo: "email", valor: "eduarda.martins@exemplo.org", natureza: "institucional", principal: true },
      { tipo: "celular", valor: "(27) 90000-0005", natureza: "pessoal", principal: true },
    ] },
  { nomeCompleto: "Fábio Fictício Alves",
    vinculos: [{ instituicao: "universidade", cargo: "Reitor", inicio: "2024-08-01", principal: true }],
    contatos: [{ tipo: "email", valor: "fabio.alves@exemplo.org", natureza: "institucional", principal: true }] },
  { nomeCompleto: "Gabriela Modelo Castro",
    vinculos: [{ instituicao: "agencia", cargo: "Diretora Executiva", inicio: "2025-06-01", principal: true }],
    contatos: [{ tipo: "email", valor: "gabriela.castro@exemplo.org", natureza: "institucional", principal: true }] },
  { nomeCompleto: "Henrique Exemplo Prado", observacoes: "Contato preferencial por e-mail.",
    vinculos: [{ instituicao: "jornal", cargo: "Editor de Economia", principal: true }],
    contatos: [{ tipo: "email", valor: "henrique.prado@exemplo.org", natureza: "institucional", principal: true }] },
  { nomeCompleto: "Isabela Teste Nunes", vinculos: [{ instituicao: "federacao", cargo: "Gerente de Infraestrutura", principal: true }] },
  { nomeCompleto: "João Fictício Moreira", vinculos: [],
    contatos: [{ tipo: "email", valor: "joao.moreira@exemplo.org", natureza: "pessoal", principal: true }] },
];

/** Comitês carregados pela migração 0002 (identificadores fixos). */
const COMITES = {
  desenvolvimento: "0c000000-0000-4000-8000-000000000001",
  infraestrutura: "0c000000-0000-4000-8000-000000000002",
  investimentos: "0c000000-0000-4000-8000-000000000003",
  inovacao: "0c000000-0000-4000-8000-000000000004",
} as const;

type ChaveComite = keyof typeof COMITES;

/** Stakeholders são indicados pelo nome exato da pessoa ou da instituição fictícia. */
const PROJETOS_TEMAS: (Omit<DadosProjetoTema, "comiteId"> & {
  comite: ChaveComite;
  participantes: { comite: ChaveComite; inicio?: string; fim?: string; observacao?: string }[];
  stakeholders: { nome: string; tipoRelacao: DadosAssociacao["tipoRelacao"]; descricao?: string; inicio?: string }[];
})[] = [
  { tipo: "projeto", nome: "Ampliação do Porto Modelo", comite: "infraestrutura", situacao: "ativo", dataInicio: "2026-03-01",
    descricao: "Projeto fictício de expansão da área de cargas do Porto Modelo.",
    participantes: [{ comite: "investimentos", inicio: "2026-03-01", observacao: "Acompanha a captação de investidores." }],
    stakeholders: [
      { nome: "Porto Modelo S.A.", tipoRelacao: "executor", descricao: "Responsável pela obra de expansão." },
      { nome: "Secretaria Exemplo de Desenvolvimento", tipoRelacao: "orgao_competente", descricao: "Coordena as autorizações estaduais." },
      { nome: "Prefeitura Municipal de Vila Exemplo", tipoRelacao: "beneficiario", descricao: "Município onde fica a área de expansão." },
      { nome: "Eduarda Teste Martins", tipoRelacao: "executor", descricao: "Interlocutora pelo Porto Modelo." },
      { nome: "Federação Exemplo da Indústria", tipoRelacao: "representacao_setorial" },
    ] },
  { tipo: "projeto", nome: "Parque Tecnológico Exemplo", comite: "inovacao", situacao: "proposto",
    descricao: "Proposta fictícia de parque tecnológico junto à universidade.",
    participantes: [{ comite: "investimentos" }],
    stakeholders: [
      { nome: "Universidade Fictícia do Sudeste", tipoRelacao: "parceiro", descricao: "Cede a área e os laboratórios." },
      { nome: "Agência Exemplo de Inovação", tipoRelacao: "executor" },
      { nome: "Fábio Fictício Alves", tipoRelacao: "parceiro", descricao: "Articula a participação da universidade." },
      { nome: "Example Trade Agency", tipoRelacao: "financiador", descricao: "Possível investidor estrangeiro." },
    ] },
  { tipo: "tema", nome: "Logística e mobilidade de cargas", comite: "infraestrutura", situacao: "ativo", dataInicio: "2025-05-01",
    participantes: [{ comite: "inovacao", inicio: "2025-05-01", fim: "2026-06-30", observacao: "Participou da fase de diagnóstico." }],
    stakeholders: [
      { nome: "Federação Exemplo da Indústria", tipoRelacao: "representacao_setorial" },
      { nome: "Isabela Teste Nunes", tipoRelacao: "representacao_setorial", descricao: "Gerente de Infraestrutura da FEXI." },
      { nome: "Terminal de Cargas do Porto Modelo", tipoRelacao: "beneficiario" },
    ] },
  { tipo: "projeto", nome: "Corredor Logístico Exemplo", comite: "infraestrutura", situacao: "ativo", dataInicio: "2026-07-01",
    descricao: "Projeto fictício usado para demonstrar a matriz 3 × 3 da metodologia V2.2.",
    participantes: [{ comite: "investimentos", inicio: "2026-07-01" }],
    stakeholders: [
      { nome: "Governo do Estado Exemplo", tipoRelacao: "orgao_competente" },
      { nome: "Secretaria Exemplo de Desenvolvimento", tipoRelacao: "orgao_competente" },
      { nome: "Example Trade Agency", tipoRelacao: "financiador", descricao: "Possível financiador estrangeiro." },
      { nome: "Federação Exemplo da Indústria", tipoRelacao: "representacao_setorial" },
      { nome: "Prefeitura Municipal de Vila Exemplo", tipoRelacao: "beneficiario" },
      { nome: "Universidade Fictícia do Sudeste", tipoRelacao: "parceiro" },
      { nome: "Jornal Diário Exemplo", tipoRelacao: "outro" },
      { nome: "Terminal de Cargas do Porto Modelo", tipoRelacao: "beneficiario" },
      { nome: "Isabela Teste Nunes", tipoRelacao: "representacao_setorial" },
      { nome: "Agência Exemplo de Inovação", tipoRelacao: "parceiro" },
      { nome: "Daniel Exemplo Rocha", tipoRelacao: "representacao_setorial" },
      { nome: "Bruno Fictício Lima", tipoRelacao: "orgao_competente", descricao: "Ainda sem avaliação." },
    ] },
  { tipo: "tema", nome: "Ambiente de negócios", comite: "investimentos", situacao: "ativo", dataInicio: "2025-09-01",
    descricao: "Simplificação de procedimentos para novos empreendimentos (exemplo fictício).",
    participantes: [{ comite: "desenvolvimento", inicio: "2025-09-01" }],
    stakeholders: [
      { nome: "Secretaria Exemplo de Desenvolvimento", tipoRelacao: "orgao_competente" },
      { nome: "Bruno Fictício Lima", tipoRelacao: "orgao_competente", descricao: "Ponto focal na secretaria." },
      { nome: "Daniel Exemplo Rocha", tipoRelacao: "representacao_setorial" },
      { nome: "Jornal Diário Exemplo", tipoRelacao: "outro", descricao: "Cobertura do tema na imprensa econômica." },
    ] },
];

async function carregarStakeholders(tx: Executor) {
  let totalContatos = 0;
  const ids = new Map<string, string>();
  for (const { chave, superior, contatos = [], ...dados } of INSTITUICOES) {
    const instituicaoSuperiorId = superior ? ids.get(superior) : undefined;
    const instituicaoId = await criarInstituicao(tx, { ...dados, instituicaoSuperiorId });
    ids.set(chave, instituicaoId);
    for (const c of contatos) {
      await criarContato(tx, { stakeholderId: instituicaoId, ...c, principal: c.principal ?? false });
      totalContatos++;
    }
  }
  for (const { vinculos, contatos = [], ...dados } of PESSOAS) {
    const pessoaId = await criarPessoa(tx, dados);
    const idsVinculos: string[] = [];
    for (const v of vinculos) {
      idsVinculos.push(
        await criarVinculo(tx, {
          pessoaId,
          instituicaoId: ids.get(v.instituicao)!,
          cargo: v.cargo,
          dataInicio: v.inicio,
          dataFim: v.fim,
          principal: v.principal ?? false,
        }),
      );
    }
    for (const { vinculo, ...c } of contatos) {
      await criarContato(tx, {
        stakeholderId: pessoaId,
        ...c,
        vinculoId: vinculo === undefined ? undefined : idsVinculos[vinculo],
        principal: c.principal ?? false,
      });
      totalContatos++;
    }
  }
  return totalContatos;
}

/** Carrega projetos e temas; stakeholders não encontrados pelo nome são ignorados. */
async function carregarProjetosTemas(tx: Executor) {
  const ids = new Map<string, string>();
  const [pessoas, instituicoes] = await Promise.all([
    tx.select({ id: pessoa.id, nome: pessoa.nomeCompleto }).from(pessoa).where(isNull(pessoa.arquivadoEm)),
    tx.select({ id: instituicao.id, nome: instituicao.nome }).from(instituicao).where(isNull(instituicao.arquivadoEm)),
  ]);
  for (const { id, nome } of [...pessoas, ...instituicoes]) if (!ids.has(nome)) ids.set(nome, id);

  let associacoes = 0;
  const ignorados: string[] = [];
  for (const { comite, participantes, stakeholders, ...dados } of PROJETOS_TEMAS) {
    const projetoTemaId = await criarProjetoTema(tx, { ...dados, comiteId: COMITES[comite] });
    for (const p of participantes) {
      const participacaoId = await criarParticipacao(tx, {
        projetoTemaId,
        comiteId: COMITES[p.comite],
        dataInicio: p.inicio,
        observacao: p.observacao,
      });
      if (p.fim) await encerrarParticipacao(tx, participacaoId, p.fim);
    }
    for (const { nome, inicio, ...s } of stakeholders) {
      const stakeholderId = ids.get(nome);
      if (!stakeholderId) {
        ignorados.push(nome);
        continue;
      }
      await criarAssociacao(tx, { projetoTemaId, stakeholderId, ...s, dataInicio: inicio });
      associacoes++;
    }
  }
  return { associacoes, ignorados: [...new Set(ignorados)] };
}

/**
 * Metodologias de DEMONSTRAÇÃO: critérios, escalas e pesos inventados apenas
 * para testar o funcionamento. Não representam os seis critérios originais
 * nem qualquer proposta de revisão (D-034).
 */
const METODOLOGIAS_DEMONSTRACAO: NovaMetodologia[] = [
  {
    nome: "Demonstração 0.1 (fictícia, encerrada)",
    descricao: "Metodologia fictícia, já encerrada, para exibir avaliações históricas. Não homologada.",
    criterios: [
      { dimensao: "poder", nome: "Critério fictício A", escalaMinima: 1, escalaMaxima: 5 },
      { dimensao: "interesse", nome: "Critério fictício B", escalaMinima: 1, escalaMaxima: 5 },
    ],
  },
  {
    nome: "Demonstração 0.2 (fictícia)",
    descricao: "Metodologia fictícia vigente, somente para testar fichas e matriz. Não homologada.",
    criterios: [
      { dimensao: "poder", nome: "Critério fictício P1", descricao: "Texto de exemplo.", escalaMinima: 1, escalaMaxima: 5, peso: 2 },
      { dimensao: "poder", nome: "Critério fictício P2", descricao: "Texto de exemplo.", escalaMinima: 1, escalaMaxima: 5, peso: 1 },
      { dimensao: "interesse", nome: "Critério fictício I1", descricao: "Texto de exemplo.", escalaMinima: 1, escalaMaxima: 5, peso: 1 },
      { dimensao: "interesse", nome: "Critério fictício I2", descricao: "Texto de exemplo.", escalaMinima: 1, escalaMaxima: 5, peso: 1 },
    ],
  },
];

type AvaliacaoExemplo = {
  projeto: string;
  stakeholder: string;
  /** Notas na ordem dos critérios da metodologia vigente no momento. */
  notas: number[];
  dados: Omit<DadosRascunho, "versaoId">;
  /** Se falso, fica como rascunho em andamento. */
  publicar?: boolean;
};

const EVIDENCIA_FICTICIA = {
  tipo: "observacao" as const,
  descricao: "Registro fictício de reunião de demonstração.",
  fonte: "Dados de exemplo",
  dataEvidencia: "2026-09-15",
};

const AVALIACOES_ANTIGAS: AvaliacaoExemplo[] = [
  {
    projeto: "Ampliação do Porto Modelo",
    stakeholder: "Porto Modelo S.A.",
    notas: [5, 4],
    dados: {
      posicionamento: "favoravel",
      grauConfianca: "medio",
      justificativaConfianca: "Exemplo fictício.",
      justificativa: "Avaliação fictícia feita com a metodologia de demonstração anterior.",
      validacaoInstitucional: "Exemplo fictício de validação institucional.",
      dataReferencia: "2026-03-10",
    },
  },
  {
    projeto: "Ampliação do Porto Modelo",
    stakeholder: "Secretaria Exemplo de Desenvolvimento",
    notas: [4, 3],
    dados: {
      posicionamento: "neutro",
      justificativa: "Primeira avaliação fictícia, com a metodologia anterior.",
      validacaoInstitucional: "Exemplo fictício de validação institucional.",
      dataReferencia: "2026-03-12",
    },
  },
];

const AVALIACOES_ATUAIS: AvaliacaoExemplo[] = [
  {
    projeto: "Ampliação do Porto Modelo",
    stakeholder: "Secretaria Exemplo de Desenvolvimento",
    notas: [5, 4, 4, 5],
    dados: {
      posicionamento: "parcialmente_favoravel",
      grauConfianca: "alto",
      justificativaConfianca: "Exemplo fictício: fontes diretas e recentes.",
      justificativa: "Segunda avaliação fictícia, já com a metodologia de demonstração vigente.",
      validacaoInstitucional: "Exemplo fictício de validação institucional.",
      dataReferencia: "2026-10-05",
    },
  },
  {
    projeto: "Ampliação do Porto Modelo",
    stakeholder: "Eduarda Teste Martins",
    notas: [3, 3, 5, 4],
    dados: {
      posicionamento: "favoravel",
      grauConfianca: "baixo",
      justificativaConfianca: "Exemplo fictício: uma única fonte indireta.",
      justificativa: "Avaliação fictícia antiga, com revisão anual vencida.",
      dataReferencia: "2025-06-10",
    },
  },
  {
    projeto: "Ampliação do Porto Modelo",
    stakeholder: "Federação Exemplo da Indústria",
    notas: [2, 3, 3, 2],
    dados: {
      justificativa: "Avaliação fictícia de poder e interesse, ainda sem base para o posicionamento.",
      dataReferencia: "2026-09-20",
    },
  },
  {
    projeto: "Ampliação do Porto Modelo",
    stakeholder: "Prefeitura Municipal de Vila Exemplo",
    notas: [2, 2, 5, 5],
    dados: {
      posicionamento: "parcialmente_contrario",
      grauConfianca: "medio",
      justificativaConfianca: "Exemplo fictício.",
      justificativa: "Avaliação fictícia de demonstração.",
      validacaoInstitucional: "Exemplo fictício de validação institucional.",
      dataReferencia: "2026-10-01",
    },
  },
  {
    projeto: "Ampliação do Porto Modelo",
    stakeholder: "Porto Modelo S.A.",
    notas: [5, 5, 4],
    dados: { posicionamento: "favoravel", justificativa: "Reavaliação fictícia em andamento." },
    publicar: false,
  },
  {
    projeto: "Parque Tecnológico Exemplo",
    stakeholder: "Universidade Fictícia do Sudeste",
    notas: [4, 3, 5, 5],
    dados: {
      posicionamento: "neutro",
      grauConfianca: "medio",
      justificativaConfianca: "Exemplo fictício.",
      justificativa: "Avaliação fictícia em outro contexto: cada projeto ou tema tem avaliações independentes.",
      validacaoInstitucional: "Exemplo fictício de validação institucional.",
      dataReferencia: "2026-10-10",
    },
  },
];

type AvaliacaoV22 = {
  projeto: string;
  stakeholder: string;
  dados: Omit<DadosRascunho, "versaoId">;
  /** Evidências são opcionais na V2.2 (D-067). */
  comEvidencia?: boolean;
};

const ORIGEM_FICTICIA = "Exemplo fictício.";

/** Avaliações fictícias na escala V2.2: as nove células, Neutro, "não avaliado", preliminares e alertas mantidos. */
const AVALIACOES_V22: AvaliacaoV22[] = [
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Governo do Estado Exemplo", comEvidencia: true,
    dados: { nivelPoder: "alto", justificativaPoder: "Aprova a licença estadual do corredor (norma fictícia).",
      nivelInteresse: "alto", justificativaInteresse: "O corredor consta do plano estadual fictício de logística.",
      posicionamento: "favoravel", naturezaPosicionamento: "manifestacao_formal", validacaoInstitucional: "Ofício fictício do gabinete.",
      situacaoRessalvas: "nao_identificadas", justificativaPosicionamento: "Apoio formal, sem condições (exemplo).",
      grauConfianca: "alto", justificativaConfianca: "Documento oficial recente (exemplo).",
      justificativa: "Avaliação fictícia: apoio formal de quem decide.", dataReferencia: "2026-10-20" } },
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Secretaria Exemplo de Desenvolvimento",
    dados: { nivelPoder: "alto", justificativaPoder: "Coordena as autorizações do programa (exemplo).",
      nivelInteresse: "alto", justificativaInteresse: "Prioridade do programa estadual (exemplo).",
      posicionamento: "favoravel", naturezaPosicionamento: "informacao_informal",
      validacaoInstitucional: "Conversa com o diretor responsável pelo programa (exemplo fictício).",
      situacaoRessalvas: "nao_identificadas", justificativaPosicionamento: "O diretor relatou apoio da área; ainda sem posição oficial.",
      grauConfianca: "medio", justificativaConfianca: "Informação informal, de fonte direta (exemplo).",
      justificativa: "Avaliação preliminar fictícia, a confirmar com manifestação formal.", dataReferencia: "2026-10-21" } },
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Example Trade Agency",
    dados: { nivelPoder: "alto", justificativaPoder: "Avaliação prospectiva: o aporte seria decisivo para a viabilidade (exemplo fictício).",
      nivelInteresse: "baixo", justificativaInteresse: "O corredor é marginal na carteira da agência (exemplo).",
      grauConfianca: "baixo", justificativaConfianca: "Sem precedente; avaliação prospectiva (exemplo).",
      justificativa: "Posicionamento ainda não avaliado: sem manifestação.", dataReferencia: "2026-10-22" } },
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Federação Exemplo da Indústria",
    dados: { nivelPoder: "alto", justificativaPoder: "As cartas de demanda que coordena condicionam o financiamento (exemplo).",
      nivelInteresse: "medio", justificativaInteresse: "Tema relevante, mas não central no plano de trabalho (exemplo).",
      posicionamento: "favoravel", naturezaPosicionamento: "manifestacao_formal", validacaoInstitucional: "Ofício fictício da diretoria.",
      situacaoRessalvas: "ha_ressalvas", descricaoRessalvas: "Apoio condicionado a compromisso de contratação de fornecedores locais.",
      justificativaPosicionamento: "Apoio condicionado, com orientação predominantemente favorável (D1).",
      grauConfianca: "medio", justificativaConfianca: "Documento formal; condição ainda em negociação (exemplo).",
      justificativa: "Avaliação fictícia de apoio condicionado.", dataReferencia: "2026-10-22" } },
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Prefeitura Municipal de Vila Exemplo", comEvidencia: true,
    dados: { nivelPoder: "medio", justificativaPoder: "Emite licenças urbanísticas acessórias, sem veto (exemplo).",
      nivelInteresse: "alto", justificativaInteresse: "O tráfego de caminhões afeta diretamente o município (estudo fictício).",
      posicionamento: "contrario", naturezaPosicionamento: "manifestacao_formal", validacaoInstitucional: "Ofício fictício do prefeito.",
      situacaoRessalvas: "ha_ressalvas", descricaoRessalvas: "Exige transferir o pátio de caminhões para fora da área urbana.",
      justificativaPosicionamento: "Oposição declarada ao traçado atual (exemplo).",
      grauConfianca: "alto", justificativaConfianca: "Manifestação formal e recente (exemplo).",
      justificativa: "Avaliação fictícia: oposição com condição relevante.", dataReferencia: "2026-10-23" } },
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Universidade Fictícia do Sudeste", comEvidencia: true,
    dados: { nivelPoder: "medio", justificativaPoder: "Integra o conselho consultivo do programa; suas notas técnicas são consideradas (exemplo).",
      nivelInteresse: "medio", justificativaInteresse: "Benefício indireto a uma linha de pesquisa (exemplo).",
      posicionamento: "neutro", naturezaPosicionamento: "manifestacao_formal",
      validacaoInstitucional: "Nota oficial fictícia: não se posiciona sobre o projeto.",
      situacaoRessalvas: "nao_identificadas", justificativaPosicionamento: "Declaração expressa de neutralidade (exemplo).",
      grauConfianca: "alto", justificativaConfianca: "Nota oficial (exemplo).",
      justificativa: "Avaliação fictícia com neutralidade declarada.", dataReferencia: "2026-10-23" } },
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Jornal Diário Exemplo",
    dados: { nivelPoder: "medio", justificativaPoder: "A cobertura pode influenciar a percepção pública do projeto (exemplo).",
      nivelInteresse: "baixo", justificativaInteresse: "O tema é pontual na pauta do jornal (exemplo).",
      grauConfianca: "baixo", justificativaConfianca: "Avaliação indireta (exemplo).",
      justificativa: "Sem manifestação sobre o projeto.", dataReferencia: "2026-10-24" } },
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Terminal de Cargas do Porto Modelo",
    dados: { nivelPoder: "baixo", justificativaPoder: "Sem competência nem recurso relevante para o corredor (verificação fictícia).",
      nivelInteresse: "alto", justificativaInteresse: "O corredor muda o acesso às suas operações (exemplo).",
      posicionamento: "favoravel", naturezaPosicionamento: "manifestacao_formal", validacaoInstitucional: "Carta fictícia da direção.",
      situacaoRessalvas: "nao_identificadas", justificativaPosicionamento: "Apoio formal (exemplo).",
      justificativa: "Avaliação fictícia.", dataReferencia: "2026-10-24" } },
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Isabela Teste Nunes",
    dados: { nivelPoder: "baixo", justificativaPoder: "Influência indireta, pela federação (exemplo).",
      nivelInteresse: "medio", justificativaInteresse: "Acompanha o tema pela gerência de infraestrutura (exemplo).",
      posicionamento: "favoravel", naturezaPosicionamento: "informacao_informal", validacaoInstitucional: "Declaração em reunião de trabalho (exemplo fictício).",
      situacaoRessalvas: "nao_identificadas", justificativaPosicionamento: "Apoio declarado em reunião (exemplo).",
      grauConfianca: "medio", justificativaConfianca: ORIGEM_FICTICIA,
      justificativa: "Avaliação preliminar fictícia de pessoa.", dataReferencia: "2026-10-25" } },
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Agência Exemplo de Inovação",
    dados: { nivelPoder: "baixo", justificativaPoder: "Sem papel nas decisões do corredor (exemplo).",
      nivelInteresse: "baixo", justificativaInteresse: "O corredor é remoto em relação à sua missão (exemplo).",
      posicionamento: "neutro", naturezaPosicionamento: "percepcao_consultor",
      justificativaPosicionamento: "Percepção do consultor: a agência tende a se manter equidistante. Mantido Neutro, com confiança baixa, apesar do alerta.",
      grauConfianca: "baixo", justificativaConfianca: "Percepção, sem manifestação (exemplo).",
      justificativa: "Avaliação fictícia com alerta mantido pelo consultor.", dataReferencia: "2026-10-25" } },
  { projeto: "Corredor Logístico Exemplo", stakeholder: "Daniel Exemplo Rocha",
    dados: { nivelInteresse: "medio", justificativaInteresse: "Representa um setor parcialmente afetado (exemplo).",
      situacaoRessalvas: "informacao_insuficiente",
      justificativaPosicionamento: "Manifestação inconclusiva em reunião: apoio a parte do traçado e objeções a outra, com peso equivalente.",
      justificativa: "Poder ainda não avaliado: informações insuficientes.", dataReferencia: "2026-10-26" } },
  // Reavaliações na V2.2 de quem tinha avaliação de demonstração: tendência "não comparável" (T-6).
  { projeto: "Ampliação do Porto Modelo", stakeholder: "Prefeitura Municipal de Vila Exemplo",
    dados: { nivelPoder: "medio", justificativaPoder: "Licenças urbanísticas acessórias, sem veto (exemplo).",
      nivelInteresse: "alto", justificativaInteresse: "A obra altera o tráfego urbano do município (estudo fictício).",
      posicionamento: "favoravel", naturezaPosicionamento: "manifestacao_formal",
      validacaoInstitucional: "Ofício fictício: o município apoiará se houver plano de mobilidade.",
      situacaoRessalvas: "ha_ressalvas", descricaoRessalvas: "Plano de mobilidade urbana para o entorno.",
      justificativaPosicionamento: "Apoio condicionado a medida compatível com a proposta: Favorável com ressalva (D1).",
      grauConfianca: "medio", justificativaConfianca: ORIGEM_FICTICIA,
      justificativa: "Reavaliação fictícia na metodologia V2.2.", dataReferencia: "2026-10-28" } },
  { projeto: "Ampliação do Porto Modelo", stakeholder: "Secretaria Exemplo de Desenvolvimento",
    dados: { nivelPoder: "alto", justificativaPoder: "Coordena as autorizações estaduais (exemplo).",
      nivelInteresse: "alto", justificativaInteresse: "Projeto prioritário do programa (exemplo).",
      posicionamento: "favoravel", naturezaPosicionamento: "informacao_informal",
      validacaoInstitucional: "Declaração do secretário em reunião (exemplo fictício).",
      situacaoRessalvas: "nao_identificadas", justificativaPosicionamento: "Apoio declarado em reunião; sem ato formal (exemplo).",
      grauConfianca: "alto", justificativaConfianca: "Fonte direta; alerta de confiança alta mantido (exemplo).",
      justificativa: "Reavaliação fictícia na metodologia V2.2.", dataReferencia: "2026-10-28" } },
];

/** Carrega as metodologias e avaliações de demonstração (somente dados fictícios). */
async function carregarAvaliacoes(tx: Executor) {
  const [projetos, pessoas, instituicoes] = await Promise.all([
    tx.select({ id: projetoTema.id, nome: projetoTema.nome }).from(projetoTema).where(isNull(projetoTema.arquivadoEm)),
    tx.select({ id: pessoa.id, nome: pessoa.nomeCompleto }).from(pessoa).where(isNull(pessoa.arquivadoEm)),
    tx.select({ id: instituicao.id, nome: instituicao.nome }).from(instituicao).where(isNull(instituicao.arquivadoEm)),
  ]);
  const idProjeto = new Map(projetos.map((p) => [p.nome, p.id]));
  const idStakeholder = new Map([...pessoas, ...instituicoes].map((s) => [s.nome, s.id]));
  let publicadas = 0;
  const ignoradas: string[] = [];

  async function avaliar(lista: AvaliacaoExemplo[], metodologiaId: string) {
    const criterios = await criteriosDaMetodologia(tx, metodologiaId);
    for (const exemplo of lista) {
      const projetoTemaId = idProjeto.get(exemplo.projeto);
      const stakeholderId = idStakeholder.get(exemplo.stakeholder);
      if (!projetoTemaId || !stakeholderId) {
        ignoradas.push(`${exemplo.stakeholder} (${exemplo.projeto})`);
        continue;
      }
      const versaoId = await iniciarRascunho(tx, projetoTemaId, stakeholderId);
      const notas = new Map(exemplo.notas.map((valor, indice) => [criterios[indice].id, valor]));
      await salvarRascunho(tx, { versaoId, ...exemplo.dados }, notas);
      await adicionarEvidencia(tx, { versaoId, ...EVIDENCIA_FICTICIA });
      if (exemplo.publicar !== false) {
        await publicarRascunho(tx, versaoId);
        publicadas++;
      }
    }
  }

  const [antiga, atual] = METODOLOGIAS_DEMONSTRACAO;
  const antigaId = await criarMetodologia(tx, antiga);
  await alterarSituacaoMetodologia(tx, antigaId, "vigente");
  await avaliar(AVALIACOES_ANTIGAS, antigaId);
  await alterarSituacaoMetodologia(tx, antigaId, "encerrada");
  const atualId = await criarMetodologia(tx, atual);
  await alterarSituacaoMetodologia(tx, atualId, "vigente");
  await avaliar(AVALIACOES_ATUAIS, atualId);

  // Metodologia V2.2 (Etapa 2B): substitui a de demonstração, por mudança substantiva (D-064).
  await alterarSituacaoMetodologia(tx, atualId, "encerrada");
  const v22Id = await criarMetodologia(tx, {
    ...METODOLOGIA_V22,
    metodologiaAnteriorId: atualId,
    naturezaAlteracao: "substantiva",
    justificativaNatureza:
      "Mudança de escala (0 a 100 e cinco categorias para Baixo, Médio e Alto e três categorias) e adoção das rubricas da Q-66 1.0 (D-058, D-059, D-068).",
  });
  await alterarSituacaoMetodologia(tx, v22Id, "vigente");
  for (const exemplo of AVALIACOES_V22) {
    const projetoTemaId = idProjeto.get(exemplo.projeto);
    const stakeholderId = idStakeholder.get(exemplo.stakeholder);
    if (!projetoTemaId || !stakeholderId) {
      ignoradas.push(`${exemplo.stakeholder} (${exemplo.projeto})`);
      continue;
    }
    const versaoId = await iniciarRascunho(tx, projetoTemaId, stakeholderId);
    await salvarRascunho(tx, { versaoId, ...exemplo.dados }, new Map());
    if (exemplo.comEvidencia) await adicionarEvidencia(tx, { versaoId, ...EVIDENCIA_FICTICIA });
    await publicarRascunho(tx, versaoId);
    publicadas++;
  }
  return { publicadas, ignoradas };
}

// --- Iniciativas, interações e compromissos (Etapa 3) ------------------------

/** Equipe interna fictícia (responsáveis e participantes internos). */
const EQUIPE = [
  { chave: "helena", nome: "Helena Equipe Exemplo", email: "helena.equipe@exemplo.invalid" },
  { chave: "marcos", nome: "Marcos Equipe Fictício", email: "marcos.equipe@exemplo.invalid" },
  { chave: "paula", nome: "Paula Equipe Teste", email: "paula.equipe@exemplo.invalid" },
] as const;
type MembroEquipe = (typeof EQUIPE)[number]["chave"];

/** Data relativa a hoje (AAAA-MM-DD), para que os prazos vencidos e a agenda façam sentido em qualquer dia. */
function diaRelativo(deslocamento: number): string {
  const data = new Date(`${hojeEmBrasilia()}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + deslocamento);
  return data.toISOString().slice(0, 10);
}

type IniciativaExemplo = {
  chave: string;
  dados: Omit<DadosNovaIniciativa, "projetos" | "responsavelId" | "dataAbertura" | "dataConclusao" | "dataPrevistaConclusao">;
  projetos: string[];
  responsavel: MembroEquipe;
  abertura: number;
  previsao?: number;
  conclusao?: number;
  stakeholders: { nome: string; papel: PapelIniciativa; observacao?: string }[];
};

const INICIATIVAS: IniciativaExemplo[] = [
  { chave: "licenciamento", projetos: ["Corredor Logístico Exemplo"], responsavel: "helena", abertura: -60, previsao: 120,
    dados: { tipo: "frente_atuacao", titulo: "Articulação do licenciamento do Corredor Logístico Exemplo", situacao: "em_andamento", prioridade: "alta",
      origem: "Plano de trabalho do Comitê de Infraestrutura (exemplo fictício).",
      descricao: "Frente contínua de articulação com os órgãos competentes para o licenciamento do corredor (exemplo fictício)." },
    stakeholders: [
      { nome: "Governo do Estado Exemplo", papel: "decisor" },
      { nome: "Secretaria Exemplo de Desenvolvimento", papel: "executor", observacao: "Coordena as autorizações estaduais." },
      { nome: "Prefeitura Municipal de Vila Exemplo", papel: "afetado" },
    ] },
  { chave: "patio", projetos: ["Corredor Logístico Exemplo"], responsavel: "marcos", abertura: -35, previsao: 30,
    dados: { tipo: "demanda", titulo: "Pedido da Prefeitura de Vila Exemplo sobre o pátio de caminhões", situacao: "em_analise", prioridade: "media",
      origem: "Ofício fictício da prefeitura.",
      descricao: "A prefeitura pede alternativas para retirar o pátio de caminhões da área urbana (exemplo fictício)." },
    stakeholders: [
      { nome: "Prefeitura Municipal de Vila Exemplo", papel: "demandante" },
      { nome: "Terminal de Cargas do Porto Modelo", papel: "afetado" },
    ] },
  { chave: "financiadores", projetos: ["Corredor Logístico Exemplo", "Ampliação do Porto Modelo"], responsavel: "paula", abertura: -25, previsao: 60,
    dados: { tipo: "reuniao_relevante", titulo: "Rodada fictícia com financiadores de infraestrutura", situacao: "em_andamento", prioridade: "alta",
      descricao: "Assunto acompanhado em uma série de encontros com possíveis financiadores; cada encontro é uma interação (exemplo fictício)." },
    stakeholders: [
      { nome: "Example Trade Agency", papel: "apoiador" },
      { nome: "Federação Exemplo da Indústria", papel: "apoiador" },
    ] },
  { chave: "universidade", projetos: ["Parque Tecnológico Exemplo"], responsavel: "helena", abertura: -40, conclusao: -5,
    dados: { tipo: "demanda", titulo: "Apoio da universidade ao Parque Tecnológico Exemplo", situacao: "concluida", prioridade: "baixa",
      origem: "Solicitação fictícia da reitoria." },
    stakeholders: [
      { nome: "Universidade Fictícia do Sudeste", papel: "demandante" },
      { nome: "Agência Exemplo de Inovação", papel: "executor" },
    ] },
];

type CompromissoExemplo = {
  descricao: string;
  responsavel?: MembroEquipe;
  responsavelExterno?: string;
  prazo: number;
  iniciativa?: string;
  acompanhamentos?: { dia: number; registro: string; situacao?: DadosAcompanhamento["situacao"] }[];
};

type InteracaoExemplo = {
  dados: Pick<DadosNovaInteracao, "tipo" | "assunto" | "situacao" | "local" | "resumo">;
  dia: number;
  hora: string;
  horaFim?: string;
  projetos: string[];
  /** Iniciativas para as quais a interação contribuiu, com a contribuição de cada uma. */
  iniciativas: { chave: string; contribuicao?: string }[];
  externos: string[];
  internos: MembroEquipe[];
  compromissos?: CompromissoExemplo[];
};

const INTERACOES: InteracaoExemplo[] = [
  { dia: -20, hora: "10:00", horaFim: "11:30", projetos: ["Corredor Logístico Exemplo"],
    dados: { tipo: "reuniao_presencial", assunto: "Reunião de alinhamento do corredor com governo e prefeitura", situacao: "realizada",
      local: "Sala de reuniões fictícia",
      resumo: "Reunião fictícia: apresentado o cronograma do licenciamento; a prefeitura reiterou o pedido sobre o pátio de caminhões." },
    // Uma só reunião, duas iniciativas: registrada uma única vez (RF-43).
    iniciativas: [
      { chave: "licenciamento", contribuicao: "Cronograma do licenciamento apresentado aos órgãos." },
      { chave: "patio", contribuicao: "Pedido da prefeitura discutido com o governo." },
    ],
    externos: ["Governo do Estado Exemplo", "Secretaria Exemplo de Desenvolvimento", "Prefeitura Municipal de Vila Exemplo"],
    internos: ["helena", "marcos"],
    compromissos: [
      { descricao: "Enviar à prefeitura a minuta fictícia de alternativas para o pátio de caminhões.", responsavel: "marcos", prazo: -3, iniciativa: "patio" },
      { descricao: "Consolidar o cronograma de licenciamento com a Secretaria.", responsavel: "helena", prazo: 10, iniciativa: "licenciamento",
        acompanhamentos: [{ dia: -2, registro: "Cronograma preliminar recebido da Secretaria (exemplo).", situacao: "em_andamento" }] },
      { descricao: "Apresentar o estudo de tráfego do entorno (exemplo fictício).", responsavelExterno: "Prefeitura Municipal de Vila Exemplo", prazo: 5, iniciativa: "patio" },
    ] },
  { dia: -10, hora: "15:00", horaFim: "16:00", projetos: [],
    dados: { tipo: "reuniao_virtual", assunto: "Primeira rodada com financiadores", situacao: "realizada", local: "Videoconferência (link fictício)",
      resumo: "Encontro fictício: interesse preliminar na carteira do corredor e do porto." },
    iniciativas: [{ chave: "financiadores", contribuicao: "Primeiro encontro da rodada." }],
    externos: ["Example Trade Agency", "Federação Exemplo da Indústria"],
    internos: ["paula"],
    compromissos: [
      { descricao: "Enviar a apresentação do corredor e do porto aos financiadores.", responsavel: "paula", prazo: -6, iniciativa: "financiadores",
        acompanhamentos: [{ dia: -7, registro: "Apresentação enviada por e-mail (exemplo).", situacao: "concluido" }] },
      { descricao: "Indicar empresas associadas interessadas (exemplo fictício).", responsavelExterno: "Federação Exemplo da Indústria", prazo: 15, iniciativa: "financiadores" },
    ] },
  { dia: -4, hora: "09:30", projetos: [],
    dados: { tipo: "ligacao", assunto: "Ligação com a Secretaria sobre o licenciamento", situacao: "realizada",
      resumo: "Contato fictício para confirmar documentos pendentes." },
    iniciativas: [{ chave: "licenciamento" }],
    externos: ["Secretaria Exemplo de Desenvolvimento"],
    internos: ["helena"] },
  { dia: 7, hora: "14:00", horaFim: "15:30", projetos: [],
    dados: { tipo: "reuniao_presencial", assunto: "Segunda rodada com financiadores", situacao: "agendada", local: "Auditório fictício" },
    iniciativas: [{ chave: "financiadores", contribuicao: "Segundo encontro da rodada (agendado)." }],
    externos: ["Example Trade Agency"],
    internos: ["paula", "marcos"] },
  { dia: -15, hora: "10:00", horaFim: "12:00", projetos: ["Parque Tecnológico Exemplo"],
    dados: { tipo: "visita", assunto: "Visita técnica fictícia ao parque tecnológico", situacao: "realizada", local: "Campus fictício",
      resumo: "Visita fictícia às áreas propostas para o parque." },
    iniciativas: [{ chave: "universidade" }],
    externos: ["Universidade Fictícia do Sudeste", "Agência Exemplo de Inovação"],
    internos: ["helena"],
    compromissos: [
      { descricao: "Registrar o parecer da visita técnica.", responsavel: "helena", prazo: -10, iniciativa: "universidade",
        acompanhamentos: [{ dia: -12, registro: "Parecer registrado e enviado à reitoria (exemplo).", situacao: "concluido" }] },
    ] },
];

/** Carrega a equipe fictícia, as iniciativas, as interações (cada uma uma única vez) e os compromissos com acompanhamento. */
async function carregarAtividades(tx: Executor) {
  await tx.insert(usuario).values(EQUIPE.map(({ nome, email }) => ({ nome, email }))).onConflictDoNothing();
  const membros = await tx.select({ id: usuario.id, email: usuario.email }).from(usuario);
  const idMembro = new Map(EQUIPE.map((m) => [m.chave, membros.find((u) => u.email === m.email)?.id]));
  const [projetos, pessoas, instituicoes] = await Promise.all([
    tx.select({ id: projetoTema.id, nome: projetoTema.nome }).from(projetoTema).where(isNull(projetoTema.arquivadoEm)),
    tx.select({ id: pessoa.id, nome: pessoa.nomeCompleto }).from(pessoa).where(isNull(pessoa.arquivadoEm)),
    tx.select({ id: instituicao.id, nome: instituicao.nome }).from(instituicao).where(isNull(instituicao.arquivadoEm)),
  ]);
  const idProjeto = new Map(projetos.map((p) => [p.nome, p.id]));
  const idStakeholder = new Map([...pessoas, ...instituicoes].map((s) => [s.nome, s.id]));
  const ids = (nomes: string[], mapa: Map<string, string>) =>
    nomes.map((nome) => mapa.get(nome)).filter((id): id is string => id !== undefined);

  const idIniciativa = new Map<string, string>();
  for (const exemplo of INICIATIVAS) {
    const projetosDaIniciativa = ids(exemplo.projetos, idProjeto);
    if (projetosDaIniciativa.length === 0) continue;
    const id = await criarIniciativa(tx, {
      ...exemplo.dados,
      projetos: projetosDaIniciativa,
      responsavelId: idMembro.get(exemplo.responsavel),
      dataAbertura: diaRelativo(exemplo.abertura),
      dataPrevistaConclusao: exemplo.previsao === undefined ? undefined : diaRelativo(exemplo.previsao),
      dataConclusao: exemplo.conclusao === undefined ? undefined : diaRelativo(exemplo.conclusao),
    });
    idIniciativa.set(exemplo.chave, id);
    for (const s of exemplo.stakeholders) {
      const stakeholderId = idStakeholder.get(s.nome);
      if (stakeholderId) await incluirStakeholderNaIniciativa(tx, { iniciativaId: id, stakeholderId, papel: s.papel, observacao: s.observacao });
    }
  }

  let totalInteracoes = 0;
  let totalCompromissos = 0;
  for (const exemplo of INTERACOES) {
    const iniciativasDaInteracao = exemplo.iniciativas.filter((i) => idIniciativa.has(i.chave));
    const projetosDaInteracao = ids(exemplo.projetos, idProjeto);
    if (projetosDaInteracao.length === 0 && iniciativasDaInteracao.length === 0) continue;
    const interacaoId = await criarInteracao(tx, {
      ...exemplo.dados,
      inicio: `${diaRelativo(exemplo.dia)}T${exemplo.hora}`,
      fim: exemplo.horaFim ? `${diaRelativo(exemplo.dia)}T${exemplo.horaFim}` : undefined,
      projetos: projetosDaInteracao,
      iniciativas: [],
      participantesExternos: ids(exemplo.externos, idStakeholder),
      participantesInternos: exemplo.internos.map((m) => idMembro.get(m)).filter((id): id is string => id !== undefined),
    });
    for (const i of iniciativasDaInteracao) {
      await incluirIniciativaNaInteracao(tx, { interacaoId, iniciativaId: idIniciativa.get(i.chave) as string, contribuicao: i.contribuicao });
    }
    totalInteracoes++;
    for (const c of exemplo.compromissos ?? []) {
      const compromissoId = await criarCompromisso(tx, {
        descricao: c.descricao,
        interacaoId,
        iniciativaId: c.iniciativa ? idIniciativa.get(c.iniciativa) : undefined,
        responsavelUsuarioId: c.responsavel ? idMembro.get(c.responsavel) : undefined,
        responsavelStakeholderId: c.responsavelExterno ? idStakeholder.get(c.responsavelExterno) : undefined,
        prazo: diaRelativo(c.prazo),
      });
      for (const a of c.acompanhamentos ?? []) {
        await registrarAcompanhamento(tx, { compromissoId, data: diaRelativo(a.dia), registro: a.registro, situacao: a.situacao });
      }
      totalCompromissos++;
    }
  }
  return { iniciativas: idIniciativa.size, interacoes: totalInteracoes, compromissos: totalCompromissos };
}

// --- Plano de Ação e Matriz de Riscos (Etapa 4) ------------------------------

/** Ação fictícia da versão 1 do plano do Corredor; o eixo é o código do pilar de referência. */
type AcaoExemplo = {
  chave: string;
  eixo: string;
  titulo: string;
  descricao?: string;
  justificativa?: string;
  responsavel?: MembroEquipe;
  responsavelExterno?: string;
  inicio?: number;
  fim?: number;
  periodicidade?: DadosAcaoPlanejada["periodicidade"];
  iniciativa?: string;
  stakeholders?: string[];
  marcos: { descricao: string; prazo?: number; alcancadoEm?: number }[];
  acompanhamentos?: { dia: number; situacao?: DadosAcompanhamentoAcao["situacao"]; percentual?: number; observacao?: string }[];
};

const OBJETIVOS_PILARES: Record<string, string> = {
  P1: "Estabelecer a governança do corredor entre os órgãos envolvidos (exemplo fictício).",
  P2: "Conduzir as licenças e autorizações no prazo planejado (exemplo fictício).",
  P4: "Preparar a operação indireta e o entorno para a implantação (exemplo fictício).",
  P5: "Manter a comunidade e os parceiros informados (exemplo fictício).",
};

const ACOES_CORREDOR: AcaoExemplo[] = [
  { chave: "governanca", eixo: "P1", titulo: "Instituir grupo de trabalho fictício de governança do corredor", responsavel: "helena",
    inicio: -50, fim: -10, periodicidade: "mensal",
    justificativa: "Sem instância de coordenação, as decisões ficam dispersas (exemplo fictício).",
    marcos: [
      { descricao: "Ato fictício de instituição do grupo publicado", prazo: -30, alcancadoEm: -28 },
      { descricao: "Primeira reunião do grupo realizada", prazo: -15, alcancadoEm: -14 },
    ],
    acompanhamentos: [
      { dia: -28, situacao: "em_andamento", observacao: "Ato fictício publicado." },
      { dia: -12, situacao: "concluida", percentual: 100, observacao: "Grupo instituído e em funcionamento (exemplo)." },
    ] },
  { chave: "licencas", eixo: "P2", titulo: "Mapear as licenças e autorizações necessárias ao corredor", responsavel: "helena",
    responsavelExterno: "Secretaria Exemplo de Desenvolvimento", inicio: -40, fim: 30, periodicidade: "mensal", iniciativa: "licenciamento",
    descricao: "Levantar licenças, órgãos responsáveis, prazos legais e documentos (exemplo fictício).",
    marcos: [
      { descricao: "Matriz fictícia de licenças elaborada", prazo: -10, alcancadoEm: -8 },
      { descricao: "Matriz validada com a Secretaria", prazo: 20 },
    ],
    acompanhamentos: [{ dia: -8, situacao: "em_andamento", percentual: 50, observacao: "Matriz preliminar concluída (exemplo)." }] },
  { chave: "patio", eixo: "P4", titulo: "Definir alternativas para o pátio de caminhões de Vila Exemplo", responsavel: "marcos",
    inicio: -30, fim: -5, iniciativa: "patio", stakeholders: ["Prefeitura Municipal de Vila Exemplo", "Terminal de Cargas do Porto Modelo"],
    marcos: [
      { descricao: "Levantamento fictício de áreas candidatas", prazo: -20, alcancadoEm: -18 },
      { descricao: "Minuta de alternativas enviada à prefeitura", prazo: -3 },
    ],
    acompanhamentos: [{ dia: -6, situacao: "em_andamento", percentual: 60, observacao: "Aguardando dados de tráfego da prefeitura (exemplo)." }] },
  { chave: "comunicacao", eixo: "P5", titulo: "Plano de comunicação com a comunidade de Vila Exemplo", responsavel: "paula",
    responsavelExterno: "Prefeitura Municipal de Vila Exemplo", inicio: 5, fim: 45, periodicidade: "bimestral",
    stakeholders: ["Jornal Diário Exemplo"],
    marcos: [{ descricao: "Plano fictício de comunicação aprovado no grupo de trabalho", prazo: 30 }] },
];

type RiscoExemplo = {
  projeto: string;
  eixo?: string;
  titulo: string;
  causa?: string;
  consequencia?: string;
  controles?: string;
  responsavel: MembroEquipe;
  situacao: DadosNovoRisco["situacao"];
  proximaRevisao?: number;
  iniciativa?: string;
  inerente: { dia: number; p: number; i: number; por: MembroEquipe; justificativa: string };
  residual?: { dia: number; p: number; i: number; por: MembroEquipe; justificativa: string };
  respostas?: { estrategia: DadosResposta["estrategia"]; descricao: string; situacao: DadosResposta["situacao"]; responsavel?: MembroEquipe; responsavelExterno?: string; prazo?: number; acao?: string }[];
  gatilhos?: { descricao: string; registros: { dia: number; ocorrido: boolean; observacao?: string }[] }[];
  stakeholders?: string[];
};

const RISCOS: RiscoExemplo[] = [
  { projeto: "Corredor Logístico Exemplo", eixo: "P2", titulo: "Atraso na emissão da licença prévia fictícia do corredor",
    causa: "Complementações de estudos e fila de análise no órgão (exemplo fictício).",
    consequencia: "Adiamento do cronograma de implantação (exemplo fictício).",
    controles: "Reuniões quinzenais com o órgão licenciador (exemplo).", responsavel: "helena", situacao: "em_mitigacao", proximaRevisao: 25,
    iniciativa: "licenciamento",
    inerente: { dia: -40, p: 4, i: 5, por: "helena", justificativa: "Histórico fictício de complementações em processos semelhantes." },
    residual: { dia: -5, p: 3, i: 4, por: "helena", justificativa: "Grupo de trabalho instituído e reuniões com o órgão efetivamente realizadas (exemplo)." },
    respostas: [{ estrategia: "mitigar", descricao: "Acompanhar o processo e antecipar os documentos pedidos.", situacao: "em_execucao", responsavel: "helena", acao: "licencas" }],
    gatilhos: [{ descricao: "Pedido formal de complementação de estudos (exemplo).", registros: [
      { dia: -20, ocorrido: false, observacao: "Sem pedido até a data (exemplo)." },
      { dia: -2, ocorrido: true, observacao: "Pedido fictício recebido; reavaliar o risco." },
    ] }],
    stakeholders: ["Secretaria Exemplo de Desenvolvimento"] },
  { projeto: "Corredor Logístico Exemplo", eixo: "P5", titulo: "Resistência da comunidade ao pátio de caminhões",
    causa: "Incômodo com tráfego pesado na área urbana (exemplo fictício).", responsavel: "marcos", situacao: "aberto", proximaRevisao: 15,
    iniciativa: "patio",
    inerente: { dia: -25, p: 3, i: 4, por: "marcos", justificativa: "Reclamações fictícias registradas pela prefeitura." },
    // Medida apenas planejada: não há avaliação residual (não reduz o risco automaticamente).
    respostas: [{ estrategia: "mitigar", descricao: "Executar o plano de comunicação com a comunidade.", situacao: "planejada", responsavel: "paula", acao: "comunicacao" }],
    stakeholders: ["Prefeitura Municipal de Vila Exemplo"] },
  { projeto: "Corredor Logístico Exemplo", eixo: "P1", titulo: "Mudança de prioridade do governo estadual",
    responsavel: "paula", situacao: "monitorado", proximaRevisao: 60,
    inerente: { dia: -45, p: 2, i: 5, por: "paula", justificativa: "Ciclo político fictício e revisão do plano plurianual." },
    residual: { dia: -10, p: 2, i: 3, por: "paula", justificativa: "Projeto incluído na carteira prioritária fictícia; acompanhamento mensal." },
    respostas: [{ estrategia: "aceitar", descricao: "Monitorar a agenda do governo nas reuniões do grupo.", situacao: "em_execucao", responsavel: "paula" }] },
  { projeto: "Corredor Logístico Exemplo", eixo: "P3", titulo: "Indisponibilidade de dados de tráfego do entorno",
    responsavel: "marcos", situacao: "mitigado", proximaRevisao: 90,
    inerente: { dia: -30, p: 2, i: 2, por: "marcos", justificativa: "Base fictícia desatualizada." },
    residual: { dia: -7, p: 1, i: 2, por: "marcos", justificativa: "Contagem fictícia de tráfego contratada e entregue." } },
  { projeto: "Ampliação do Porto Modelo", titulo: "Baixa adesão de financiadores à carteira do porto",
    responsavel: "paula", situacao: "escalonado", proximaRevisao: -1, iniciativa: "financiadores",
    inerente: { dia: -15, p: 5, i: 4, por: "paula", justificativa: "Primeira rodada fictícia sem manifestação formal de interesse." },
    respostas: [{ estrategia: "transferir", descricao: "Apoio da agência na prospecção de financiadores.", situacao: "planejada", responsavelExterno: "Example Trade Agency", prazo: 20 }],
    gatilhos: [{ descricao: "Nenhuma carta de interesse até a segunda rodada (exemplo).", registros: [] }] },
];

/** Carrega o plano de ação do Corredor (v1 aprovada, v2 em aprovação) e os riscos fictícios. */
async function carregarPlanosERiscos(tx: Executor) {
  const membros = await tx.select({ id: usuario.id, email: usuario.email }).from(usuario);
  const idMembro = new Map(EQUIPE.map((m) => [m.chave, membros.find((u) => u.email === m.email)?.id]));
  const [projetos, pessoas, instituicoes, iniciativas, compromissos] = await Promise.all([
    tx.select({ id: projetoTema.id, nome: projetoTema.nome }).from(projetoTema).where(isNull(projetoTema.arquivadoEm)),
    tx.select({ id: pessoa.id, nome: pessoa.nomeCompleto }).from(pessoa).where(isNull(pessoa.arquivadoEm)),
    tx.select({ id: instituicao.id, nome: instituicao.nome }).from(instituicao).where(isNull(instituicao.arquivadoEm)),
    tx.select({ id: iniciativa.id, titulo: iniciativa.titulo }).from(iniciativa),
    tx.select({ id: compromisso.id, descricao: compromisso.descricao }).from(compromisso),
  ]);
  const idProjeto = new Map(projetos.map((p) => [p.nome, p.id]));
  const idStakeholder = new Map([...pessoas, ...instituicoes].map((s) => [s.nome, s.id]));
  const tituloIniciativa = new Map(INICIATIVAS.map((i) => [i.chave, i.dados.titulo]));
  const idIniciativa = (chave?: string) => (chave ? iniciativas.find((i) => i.titulo === tituloIniciativa.get(chave))?.id : undefined);
  const membro = (chave?: MembroEquipe) => (chave ? idMembro.get(chave) : undefined);

  let totalAcoes = 0;
  const idAcao = new Map<string, string>();
  const corredor = idProjeto.get("Corredor Logístico Exemplo");
  if (corredor) {
    const planoId = await criarPlano(tx, {
      projetoTemaId: corredor,
      titulo: "Plano de ação fictício do Corredor Logístico Exemplo",
      objetivo: "Viabilizar a implantação do corredor com governança, licenças, prontidão e comunicação (exemplo fictício).",
      responsavelId: membro("helena"),
      usarPilaresReferencia: true,
    });
    const eixos = await eixosDoPlano(tx, planoId);
    const idEixo = new Map(eixos.map((e) => [e.codigo, e.id]));
    for (const e of eixos) {
      if (OBJETIVOS_PILARES[e.codigo]) await atualizarEixo(tx, e.id, { nome: e.nome, objetivo: OBJETIVOS_PILARES[e.codigo] });
    }
    const v1 = (await versaoEmElaboracao(tx, planoId))!.id;
    for (const a of ACOES_CORREDOR) {
      const acaoId = await incluirAcaoNaVersao(tx, {
        versaoId: v1,
        eixoId: idEixo.get(a.eixo),
        titulo: a.titulo,
        descricao: a.descricao,
        justificativa: a.justificativa,
        responsavelUsuarioId: membro(a.responsavel),
        responsavelStakeholderId: a.responsavelExterno ? idStakeholder.get(a.responsavelExterno) : undefined,
        inicioPrevisto: a.inicio === undefined ? undefined : diaRelativo(a.inicio),
        fimPrevisto: a.fim === undefined ? undefined : diaRelativo(a.fim),
        periodicidade: a.periodicidade,
        iniciativaId: idIniciativa(a.iniciativa),
      });
      idAcao.set(a.chave, acaoId);
      for (const m of a.marcos) {
        await incluirMarco(tx, { versaoId: v1, acaoId, descricao: m.descricao, prazoPrevisto: m.prazo === undefined ? undefined : diaRelativo(m.prazo) });
      }
      for (const nome of a.stakeholders ?? []) {
        const stakeholderId = idStakeholder.get(nome);
        if (stakeholderId) await incluirStakeholderNaAcao(tx, { acaoId, stakeholderId });
      }
      totalAcoes++;
    }
    await enviarParaAprovacao(tx, v1, undefined);
    await decidirVersao(tx, v1, "aprovada", "Versão inicial fictícia aprovada para demonstração.");

    // Acompanhamento da versão vigente: situação, percentual e marcos alcançados.
    const planejadas = await planejamentoDaVersao(tx, v1);
    for (const a of ACOES_CORREDOR) {
      const acaoId = idAcao.get(a.chave)!;
      for (const r of a.acompanhamentos ?? []) {
        await registrarAcompanhamentoDaAcao(tx, { acaoId, data: diaRelativo(r.dia), situacao: r.situacao, percentual: r.percentual, observacao: r.observacao });
      }
      const marcos = planejadas.find((p) => p.acaoId === acaoId)?.marcos ?? [];
      for (const [indice, m] of a.marcos.entries()) {
        if (m.alcancadoEm !== undefined && marcos[indice]) {
          await registrarAcompanhamentoDaAcao(tx, { acaoId, data: diaRelativo(m.alcancadoEm), marcoId: marcos[indice].marcoId, marcoAlcancado: true });
        }
      }
    }

    // Versão 2 em aprovação: compromisso convertido em ação e prazo do pátio repactuado.
    const origem = compromissos.find((c) => c.descricao === "Consolidar o cronograma de licenciamento com a Secretaria.");
    let v2: string | undefined;
    if (origem) {
      const convertido = await converterCompromissoEmAcao(tx, origem.id, planoId, idEixo.get("P2"));
      v2 = convertido.versaoId;
      totalAcoes++;
    } else {
      v2 = await criarNovaVersao(tx, planoId);
    }
    const patio = (await planejamentoDaVersao(tx, v2)).find((p) => p.acaoId === idAcao.get("patio"));
    if (patio) {
      await atualizarAcaoPlanejada(tx, patio.id, {
        eixoId: patio.eixoId ?? undefined,
        titulo: patio.titulo,
        descricao: patio.descricao ?? undefined,
        justificativa: patio.justificativa ?? undefined,
        responsavelUsuarioId: patio.responsavelUsuarioId ?? undefined,
        responsavelStakeholderId: patio.responsavelStakeholderId ?? undefined,
        inicioPrevisto: patio.inicioPrevisto ?? undefined,
        fimPrevisto: diaRelativo(15),
        periodicidade: patio.periodicidade ?? undefined,
      });
    }
    await enviarParaAprovacao(tx, v2, "Repactuação fictícia do prazo do pátio e inclusão do compromisso de cronograma convertido em ação.");
  }

  let totalRiscos = 0;
  for (const r of RISCOS) {
    const projetoTemaId = idProjeto.get(r.projeto);
    if (!projetoTemaId) continue;
    const eixos = await eixosDoProjetoTema(tx, projetoTemaId);
    const riscoId = await criarRisco(tx, {
      projetoTemaId,
      titulo: r.titulo,
      causa: r.causa,
      consequencia: r.consequencia,
      controlesExistentes: r.controles,
      eixoId: r.eixo ? eixos.find((e) => e.codigo === r.eixo)?.id : undefined,
      iniciativaId: idIniciativa(r.iniciativa),
      responsavelId: membro(r.responsavel),
      situacao: r.situacao,
      proximaRevisao: r.proximaRevisao === undefined ? undefined : diaRelativo(r.proximaRevisao),
      dataAvaliacao: diaRelativo(r.inerente.dia),
      probabilidade: r.inerente.p,
      impacto: r.inerente.i,
      justificativa: r.inerente.justificativa,
      avaliadoPor: membro(r.inerente.por)!,
    });
    if (r.residual) {
      await registrarAvaliacao(tx, {
        riscoId,
        tipo: "residual",
        dataAvaliacao: diaRelativo(r.residual.dia),
        probabilidade: r.residual.p,
        impacto: r.residual.i,
        justificativa: r.residual.justificativa,
        avaliadoPor: membro(r.residual.por)!,
      });
    }
    for (const resposta of r.respostas ?? []) {
      await criarResposta(tx, {
        riscoId,
        estrategia: resposta.estrategia,
        descricao: resposta.descricao,
        situacao: resposta.situacao,
        responsavelUsuarioId: membro(resposta.responsavel),
        responsavelStakeholderId: resposta.responsavelExterno ? idStakeholder.get(resposta.responsavelExterno) : undefined,
        prazo: resposta.prazo === undefined ? undefined : diaRelativo(resposta.prazo),
        acaoId: resposta.acao ? idAcao.get(resposta.acao) : undefined,
      });
    }
    for (const g of r.gatilhos ?? []) {
      await criarGatilho(tx, riscoId, g.descricao);
      const [gatilho] = (await gatilhosDoRisco(tx, riscoId)).filter((x) => x.descricao === g.descricao);
      for (const registro of g.registros) {
        await registrarOcorrenciaGatilho(tx, { gatilhoId: gatilho.id, data: diaRelativo(registro.dia), ocorrido: registro.ocorrido, observacao: registro.observacao });
      }
    }
    for (const nome of r.stakeholders ?? []) {
      const stakeholderId = idStakeholder.get(nome);
      if (stakeholderId) await incluirStakeholderNoRisco(tx, { riscoId, stakeholderId });
    }
    totalRiscos++;
  }
  return { acoes: totalAcoes, riscos: totalRiscos, plano: corredor !== undefined };
}

/** Carrega o que faltar, em nome do usuário informado (com a conexão-base, sem regras de acesso). */
export async function carregarExemplos(banco: Banco, usuario: { id: string }) {
  {
    const [pessoasExistentes, projetosExistentes, metodologiasExistentes, iniciativasExistentes, planosExistentes, riscosExistentes] =
      await Promise.all([
        banco.$count(pessoa),
        banco.$count(projetoTema),
        banco.$count(metodologiaVersao),
        banco.$count(iniciativa),
        banco.$count(planoAcao),
        banco.$count(risco),
      ]);
    const etapa4Existente = planosExistentes > 0 || riscosExistentes > 0;
    if (pessoasExistentes > 0 && projetosExistentes > 0 && metodologiasExistentes > 0 && iniciativasExistentes > 0 && etapa4Existente) {
      console.log(
        `O banco já tem ${pessoasExistentes} pessoa(s), ${projetosExistentes} projeto(s) ou tema(s), ${metodologiasExistentes} metodologia(s), ${iniciativasExistentes} iniciativa(s) e ${planosExistentes} plano(s) de ação. Nada foi carregado.`,
      );
      console.log('Para recomeçar do zero: "npm run banco:reiniciar" e depois "npm run banco:exemplos".');
      return;
    }

    await comoUsuario(banco, usuario.id, async (tx) => {
      if (pessoasExistentes === 0) {
        const totalContatos = await carregarStakeholders(tx);
        console.log(
          `Carregados: ${INSTITUICOES.length} instituições, ${PESSOAS.length} pessoas e ${totalContatos} contatos fictícios.`,
        );
      } else {
        console.log(`Pessoas e instituições: o banco já tem ${pessoasExistentes} pessoa(s); mantidas como estão.`);
      }
      if (projetosExistentes === 0) {
        const { associacoes, ignorados } = await carregarProjetosTemas(tx);
        console.log(
          `Carregados: ${PROJETOS_TEMAS.length} projetos e temas fictícios, com ${associacoes} associações de stakeholders.`,
        );
        if (ignorados.length > 0) {
          console.log(`Não encontrados (arquivados ou renomeados), associação ignorada: ${ignorados.join(", ")}.`);
        }
      } else {
        console.log(`Projetos e temas: o banco já tem ${projetosExistentes}; mantidos como estão.`);
      }
      if (metodologiasExistentes === 0) {
        const { publicadas, ignoradas } = await carregarAvaliacoes(tx);
        console.log(
          `Carregadas: ${METODOLOGIAS_DEMONSTRACAO.length} metodologias de demonstração (histórico), a metodologia V2.2 vigente e ${publicadas} avaliações fictícias publicadas.`,
        );
        if (ignoradas.length > 0) console.log(`Não encontrados, avaliação ignorada: ${ignoradas.join(", ")}.`);
      } else {
        console.log(`Metodologias: o banco já tem ${metodologiasExistentes}; avaliações mantidas como estão.`);
      }
      if (iniciativasExistentes === 0) {
        const atividades = await carregarAtividades(tx);
        console.log(
          `Carregados: equipe fictícia (${EQUIPE.length} pessoas), ${atividades.iniciativas} iniciativas, ${atividades.interacoes} interações e ${atividades.compromissos} compromissos fictícios.`,
        );
      } else {
        console.log(`Iniciativas: o banco já tem ${iniciativasExistentes}; mantidas como estão.`);
      }
      if (!etapa4Existente) {
        const etapa4 = await carregarPlanosERiscos(tx);
        console.log(
          `Carregados: ${etapa4.plano ? "1 plano de ação (versão 1 aprovada, versão 2 em aprovação)" : "nenhum plano (projeto de exemplo ausente)"}, ${etapa4.acoes} ações e ${etapa4.riscos} riscos fictícios.`,
        );
      } else {
        console.log(`Planos e riscos: o banco já tem ${planosExistentes} plano(s) e ${riscosExistentes} risco(s); mantidos como estão.`);
      }
    });
  }
}

async function principal() {
  console.log(`Banco local: ${diretorioDoBanco()}`);
  const banco = await obterBancoBase();
  try {
    await carregarExemplos(banco, await obterUsuarioAtual(banco));
  } finally {
    await fecharBanco(banco);
  }
}

// Também é usado por scripts/supabase-preparar.ts; sozinho, carrega o banco local.
if (process.argv[1]?.includes("carregar-exemplos")) {
  principal().catch((erro) => {
    console.error("Falha ao carregar os exemplos:", erro?.message ?? erro?.cause ?? erro);
    process.exit(1);
  });
}
