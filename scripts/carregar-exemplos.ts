/**
 * Carrega pessoas, instituições, vínculos, contatos, projetos e temas FICTÍCIOS
 * no banco local, para testes e demonstração. Comando: npm run banco:exemplos
 *
 * Cada grupo só é carregado se ainda estiver vazio: pessoas e instituições,
 * se não houver nenhuma pessoa; projetos e temas, se não houver nenhum.
 *
 * Execute com a aplicação parada (o banco local aceita um processo por vez;
 * se estiver em uso, o script avisa e não grava nada). Nenhum dado aqui
 * corresponde a pessoa ou instituição real.
 */
import { comoUsuario, diretorioDoBanco, fecharBanco, obterBanco } from "@/lib/banco/conexao";
import { isNull } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";
import { instituicao, pessoa, projetoTema } from "@/lib/banco/esquema";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import {
  criarAssociacao,
  criarParticipacao,
  criarProjetoTema,
  encerrarParticipacao,
} from "@/modulos/projetos-temas/consultas";
import type { DadosAssociacao, DadosProjetoTema } from "@/modulos/projetos-temas/esquemas";
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

async function principal() {
  console.log(`Banco local: ${diretorioDoBanco()}`);
  const banco = await obterBanco();
  try {
    const [pessoasExistentes, projetosExistentes] = await Promise.all([
      banco.$count(pessoa),
      banco.$count(projetoTema),
    ]);
    if (pessoasExistentes > 0 && projetosExistentes > 0) {
      console.log(
        `O banco já tem ${pessoasExistentes} pessoa(s) e ${projetosExistentes} projeto(s) ou tema(s). Nada foi carregado.`,
      );
      console.log('Para recomeçar do zero: "npm run banco:reiniciar" e depois "npm run banco:exemplos".');
      return;
    }

    const usuario = await obterUsuarioAtual(banco);
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
    });
  } finally {
    await fecharBanco(banco);
  }
}

principal().catch((erro) => {
  console.error("Falha ao carregar os exemplos:", erro?.message ?? erro?.cause ?? erro);
  process.exit(1);
});
