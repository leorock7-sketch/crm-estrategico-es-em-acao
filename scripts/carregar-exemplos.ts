/**
 * Carrega pessoas, instituições, vínculos e contatos FICTÍCIOS no banco local,
 * para testes e demonstração. Comando: npm run banco:exemplos
 *
 * Execute com a aplicação parada (o banco local aceita um processo por vez;
 * se estiver em uso, o script avisa e não grava nada). Nenhum dado aqui
 * corresponde a pessoa ou instituição real.
 */
import { comoUsuario, diretorioDoBanco, fecharBanco, obterBanco } from "@/lib/banco/conexao";
import { pessoa } from "@/lib/banco/esquema";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
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

async function principal() {
  console.log(`Banco local: ${diretorioDoBanco()}`);
  const banco = await obterBanco();
  try {
    const existentes = await banco.$count(pessoa);
    if (existentes > 0) {
      console.log(`O banco já tem ${existentes} pessoa(s). Nada foi carregado.`);
      console.log('Para recomeçar do zero: "npm run banco:reiniciar" e depois "npm run banco:exemplos".');
      return;
    }

    const usuario = await obterUsuarioAtual(banco);
    let totalContatos = 0;
    await comoUsuario(banco, usuario.id, async (tx) => {
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
    });
    console.log(
      `Carregados: ${INSTITUICOES.length} instituições, ${PESSOAS.length} pessoas e ${totalContatos} contatos fictícios.`,
    );
  } finally {
    await fecharBanco(banco);
  }
}

principal().catch((erro) => {
  console.error("Falha ao carregar os exemplos:", erro?.message ?? erro?.cause ?? erro);
  process.exit(1);
});
