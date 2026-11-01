# Testes automatizados

Os testes conferem, de forma automática e repetível, se o sistema se comporta como esperado. Eles são executados com o comando `npm test`.

| Arquivo | O que verifica |
|---|---|
| `pagina-inicial.test.tsx` | A página inicial exibe o nome do sistema e informa que está em desenvolvimento. |
| `validacao-comuns.test.ts` | Regras genéricas de validação: texto obrigatório, e-mail e identificador. |
| `validacao-cadastro-mestre.test.ts` | Validações do Cadastro Mestre, contatos, países, CNPJ numérico e alfanumérico e normalização de textos. |
| `banco-cadastro-mestre.test.ts` | Regras do banco de dados em um PGlite real na memória: comitês, auditoria, proibição de exclusão, contatos compartilhados e encerrados com o vínculo, CNPJ repetido com alerta, país, vínculo principal, ciclos de hierarquia, busca e duplicidade. |
| `trava-banco.test.ts` | Trava do banco local (inclusive com um segundo processo real) e proteção contra uso em produção. |
| `historico.test.ts` | Descrição legível do histórico (inclusive contatos e país), datas no padrão brasileiro e verificação de duplicidade na edição. |
| `formulario-pessoa.test.tsx` | Formulário de pessoa: campos mínimos e alerta de possível duplicidade. |
| `formulario-instituicao.test.tsx` | Formulário de instituição: mantém o que foi digitado após um erro; UF e CNPJ desativados para instituição estrangeira. |
| `banco-projetos-temas.test.ts` | Regras do banco de projetos, temas e contextos: nome normalizado, nome repetido no mesmo comitê, datas, proibição de exclusão, comitê principal que não é participante (nos dois sentidos), participações e associações vigentes únicas, filtro por comitê, ausência de campos de poder ou interesse e histórico. |
| `validacao-projetos-temas.test.ts` | Validações de projeto ou tema, participação e associação; nomes legíveis no histórico; listas da tela iguais às do banco. |
| `normalizacao.test.ts` | Regra única de normalização (acentos, maiúsculas, pontuação, apóstrofos e acentos usados como apóstrofo); busca e duplicidade de projetos e temas com essas variações; realinhamento de valores gravados pela regra antiga, inclusive ao reabrir um banco existente, de forma idempotente e auditada. |
| `formulario-projeto-tema.test.tsx` | Formulário de projeto ou tema com alerta de nome parecido; formulário de associação com a lista neutra de tipos de relação. |

Ferramentas: [Vitest](https://vitest.dev) e [Testing Library](https://testing-library.com).

Regras:

- Os testes usam **apenas dados fictícios** e um banco criado na memória, que não afeta o banco local.
- Cada nova funcionalidade deve vir acompanhada de seus testes.
- Os nomes dos arquivos terminam em `.test.ts` ou `.test.tsx`.
