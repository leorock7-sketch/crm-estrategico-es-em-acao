# Acesso ao banco de dados

Banco de dados de **desenvolvimento** (decisão D-018): PGlite, um PostgreSQL completo executado dentro da própria aplicação, sem instalação de programas. Os dados ficam em `.dados/pglite` (ignorada pelo Git) e são exclusivamente fictícios.

| Arquivo | Conteúdo |
|---|---|
| `esquema.ts` | Estrutura das tabelas, chaves e regras de integridade (fonte única) |
| `migracoes/` | Scripts SQL versionados, aplicados automaticamente ao abrir o banco |
| `ambiente.ts` | Qual caminho de acesso vale: login real (Supabase) ou modo local (PGlite) |
| `conexao.ts` | Abertura do banco (PGlite ou PostgreSQL), proteção de produção (`CRM_BANCO`) e `comoUsuario()`, que registra o responsável por cada gravação |
| `identidade.ts` | `comIdentidade()`: toda operação do banco devolvido ocorre em transação com a identidade do usuário, sob as regras de acesso |
| `trava.ts` | Trava exclusiva da pasta de dados: impede que dois programas usem o banco local ao mesmo tempo |
| `requisicao.ts` | Acesso ao banco pelas telas e pelas operações, sempre com a identidade da sessão |
| `erros.ts` | Localização do erro original do PostgreSQL |

Regras:

- endereços e chaves de acesso ficam **apenas** em variáveis de ambiente (arquivo `.env.local`, que o Git ignora), nunca no código;
- telas e operações usam só `bancoDaRequisicao()` e `bancoDaSessao()`: a conexão-base (`obterBancoBase`) não passa por nenhuma regra de identidade e um teste impede o seu uso fora de `requisicao.ts` e `sessao.ts`;
- tabela nova precisa de regras de acesso: um teste falha se surgir tabela sem RLS forçado e sem regra;
- toda gravação passa por `comoUsuario()`, para que a trilha de auditoria registre o responsável;
- para alterar a estrutura, edite `esquema.ts` e execute `npm run banco:gerar`; gatilhos e cargas de dados ficam em scripts SQL próprios dentro de `migracoes/`;
- scripts já publicados não devem ser alterados: cada mudança gera um novo script.

As regras de acesso estão em `migracoes/0009_identidade_rls.sql` e valem nos dois bancos, porque usam só PostgreSQL padrão.

O modelo de dados está em [docs/MODELO_DADOS.md](../../../docs/MODELO_DADOS.md).
