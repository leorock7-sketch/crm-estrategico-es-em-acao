# Acesso ao banco de dados

Local reservado para a conexão futura com o PostgreSQL (gerenciado pelo Supabase). **Na Etapa 0 não há banco de dados nem conexão.**

Quando o banco for criado (Etapa 1, sujeita a aprovação):

- a conexão será configurada aqui, em um único lugar, e usada pelos módulos em `src/modulos/`;
- endereços e chaves de acesso ficarão **apenas** em variáveis de ambiente (arquivo `.env.local`, que o Git ignora), nunca no código;
- os scripts de criação e alteração das tabelas (*migrations*) serão versionados em pasta própria;
- o controle de acesso por projeto ou tema será aplicado no próprio banco (Row Level Security).

O modelo de dados previsto está em [docs/MODELO_DADOS.md](../../../docs/MODELO_DADOS.md).
