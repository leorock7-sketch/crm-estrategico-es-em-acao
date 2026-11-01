/**
 * Carrega pessoas, instituições e vínculos FICTÍCIOS no banco local, para
 * testes e demonstração. Comando: npm run banco:exemplos
 *
 * Execute com a aplicação parada (o banco local aceita um processo por vez).
 * Nenhum dado aqui corresponde a pessoa ou instituição real.
 */
import { comoUsuario, diretorioDoBanco, obterBanco } from "@/lib/banco/conexao";
import { pessoa } from "@/lib/banco/esquema";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { criarInstituicao, criarPessoa, criarVinculo } from "@/modulos/stakeholders/consultas";
import type { DadosInstituicao, DadosPessoa } from "@/modulos/stakeholders/esquemas";

const INSTITUICOES: (DadosInstituicao & { chave: string; superior?: string })[] = [
  { chave: "governo", nome: "Governo do Estado Exemplo", natureza: "orgao_publico", esfera: "estadual", uf: "ES" },
  { chave: "secretaria", superior: "governo", nome: "Secretaria Exemplo de Desenvolvimento", sigla: "SEXD", natureza: "orgao_publico", esfera: "estadual", uf: "ES", municipio: "Vitória" },
  { chave: "prefeitura", nome: "Prefeitura Municipal de Vila Exemplo", natureza: "orgao_publico", esfera: "municipal", uf: "ES", municipio: "Vila Exemplo" },
  { chave: "federacao", nome: "Federação Exemplo da Indústria", sigla: "FEXI", natureza: "entidade_classe", esfera: "nao_se_aplica", uf: "ES" },
  { chave: "porto", nome: "Porto Modelo S.A.", natureza: "empresa", esfera: "nao_se_aplica", uf: "ES", cnpj: "12ABC34501DE35", site: "https://porto.exemplo.org" },
  { chave: "universidade", nome: "Universidade Fictícia do Sudeste", sigla: "UFSE", natureza: "academia", esfera: "federal", uf: "ES" },
  { chave: "agencia", nome: "Agência Exemplo de Inovação", natureza: "terceiro_setor", esfera: "nao_se_aplica", uf: "ES" },
  { chave: "jornal", nome: "Jornal Diário Exemplo", natureza: "imprensa", esfera: "nao_se_aplica", uf: "ES" },
];

const PESSOAS: (DadosPessoa & {
  vinculos: { instituicao: string; cargo: string; inicio?: string; fim?: string; principal?: boolean }[];
})[] = [
  { nomeCompleto: "Ana Exemplo Souza", nomeTratamento: "Secretária Ana", email: "ana.souza@exemplo.org", telefone: "(27) 90000-0001", vinculos: [{ instituicao: "secretaria", cargo: "Secretária", inicio: "2025-01-02", principal: true }] },
  { nomeCompleto: "Bruno Fictício Lima", email: "bruno.lima@exemplo.org", vinculos: [{ instituicao: "secretaria", cargo: "Subsecretário de Investimentos", inicio: "2025-02-01", principal: true }] },
  { nomeCompleto: "Carla Modelo Ribeiro", nomeTratamento: "Prefeita Carla", email: "carla.ribeiro@exemplo.org", vinculos: [{ instituicao: "prefeitura", cargo: "Prefeita", inicio: "2025-01-01", principal: true }] },
  { nomeCompleto: "Daniel Exemplo Rocha", email: "daniel.rocha@exemplo.org", vinculos: [{ instituicao: "federacao", cargo: "Presidente", inicio: "2024-03-15", principal: true }] },
  { nomeCompleto: "Eduarda Teste Martins", email: "eduarda.martins@exemplo.org", telefone: "(27) 90000-0005", vinculos: [
    { instituicao: "porto", cargo: "Diretora de Relações Institucionais", inicio: "2026-02-01", principal: true },
    { instituicao: "secretaria", cargo: "Assessora Especial", inicio: "2023-01-10", fim: "2026-01-20" },
  ] },
  { nomeCompleto: "Fábio Fictício Alves", email: "fabio.alves@exemplo.org", vinculos: [{ instituicao: "universidade", cargo: "Reitor", inicio: "2024-08-01", principal: true }] },
  { nomeCompleto: "Gabriela Modelo Castro", email: "gabriela.castro@exemplo.org", vinculos: [{ instituicao: "agencia", cargo: "Diretora Executiva", inicio: "2025-06-01", principal: true }] },
  { nomeCompleto: "Henrique Exemplo Prado", email: "henrique.prado@exemplo.org", observacoes: "Contato preferencial por e-mail.", vinculos: [{ instituicao: "jornal", cargo: "Editor de Economia", principal: true }] },
  { nomeCompleto: "Isabela Teste Nunes", vinculos: [{ instituicao: "federacao", cargo: "Gerente de Infraestrutura", principal: true }] },
  { nomeCompleto: "João Fictício Moreira", email: "joao.moreira@exemplo.org", vinculos: [] },
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
    await comoUsuario(banco, usuario.id, async (tx) => {
      const ids = new Map<string, string>();
      for (const { chave, superior, ...dados } of INSTITUICOES) {
        const instituicaoSuperiorId = superior ? ids.get(superior) : undefined;
        ids.set(chave, await criarInstituicao(tx, { ...dados, instituicaoSuperiorId }));
      }
      for (const { vinculos, ...dados } of PESSOAS) {
        const pessoaId = await criarPessoa(tx, dados);
        for (const v of vinculos) {
          await criarVinculo(tx, {
            pessoaId,
            instituicaoId: ids.get(v.instituicao)!,
            cargo: v.cargo,
            dataInicio: v.inicio,
            dataFim: v.fim,
            principal: v.principal ?? false,
          });
        }
      }
    });
    console.log(`Carregados: ${INSTITUICOES.length} instituições e ${PESSOAS.length} pessoas fictícias.`);
  } finally {
    await banco.$client.close();
  }
}

principal().catch((erro) => {
  console.error("Falha ao carregar os exemplos:", erro?.cause ?? erro);
  process.exit(1);
});
