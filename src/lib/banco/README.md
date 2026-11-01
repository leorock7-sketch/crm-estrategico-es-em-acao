# Acesso ao banco de dados

Banco de dados de **desenvolvimento** (decisão D-018): PGlite, um PostgreSQL completo executado dentro da própria aplicação, sem instalação de programas. Os dados ficam em `.dados/pglite` (ignorada pelo Git) e são exclusivamente fictícios.

| Arquivo | Conteúdo |
|---|---|
| `esquema.ts` | Estrutura das tabelas, chaves e regras de integridade (fonte única) |
| `migracoes/` | Scripts SQL versionados, aplicados automaticamente ao abrir o banco |
| `conexao.ts` | Abertura do banco e `comoUsuario()`, que registra o responsável por cada gravação |
| `requisicao.ts` | Acesso ao banco pelas telas, lendo dados a cada acesso |
| `erros.ts` | Localização do erro original do PostgreSQL |

Regras:

- endereços e chaves de acesso ficarão **apenas** em variáveis de ambiente (arquivo `.env.local`, que o Git ignora), nunca no código;
- toda gravação passa por `comoUsuario()`, para que a trilha de auditoria registre o responsável;
- para alterar a estrutura, edite `esquema.ts` e execute `npm run banco:gerar`; gatilhos e cargas de dados ficam em scripts SQL próprios dentro de `migracoes/`;
- scripts já publicados não devem ser alterados: cada mudança gera um novo script.

Na etapa de hospedagem, a conexão será trocada pela do Supabase, reaproveitando os mesmos scripts. O controle de acesso por projeto ou tema será aplicado no próprio banco (Row Level Security).

O modelo de dados está em [docs/MODELO_DADOS.md](../../../docs/MODELO_DADOS.md).
