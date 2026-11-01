# Validação de dados

Regras que verificam se os dados informados estão corretos antes de serem gravados, por exemplo: campo obrigatório preenchido, e-mail em formato válido, data final posterior à inicial.

As regras usam a biblioteca [Zod](https://zod.dev) e são escritas uma única vez, valendo tanto para os formulários quanto para o servidor. As mensagens de erro são em português.

- `comuns.ts`: regras genéricas reaproveitadas por todos os módulos (identificador, texto obrigatório, e-mail opcional).
- Regras específicas de cada módulo ficarão em `src/modulos/<modulo>/esquemas.ts`.
