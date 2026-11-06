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
| `banco-avaliacoes.test.ts` | Regras do banco da avaliação estratégica: ficha só para stakeholder associado, exigências da publicação, cálculo gravado, "não avaliado" nunca é zero, validação institucional, versões imutáveis, histórico e independência entre contextos, rascunho único, metodologias e notas. Na escala V2.2: rubricas para entrar em vigor, níveis sem cálculo, categorias parciais recusadas, "não avaliado", evidência e validação institucional opcionais, justificativas por dimensão e natureza do posicionamento, alertas mantidos gravados, metodologia vigente obrigatória, escala binária histórica, nova versão (T-4) e natureza da alteração da metodologia (D-064). |
| `permissoes.test.ts` | Autorização por contexto com usuários fictícios: administrador, gestor, colaborador, leitor, sem permissão, permissão vencida ou arquivada e usuário inativo. |
| `calculo-avaliacoes.test.ts` | Cálculo de demonstração, tendência, classificação da matriz (vigente, histórica, reavaliação, sem pontuação, não avaliados), validações e listas iguais às do banco; comparabilidade entre metodologias (T-6), grade 3 × 3 (T17 a T19), alertas orientativos e validação conforme a escala. |
| `formulario-rascunho.test.tsx` | Formulário de avaliação: "não avaliado" e "sem nota" como padrão, validação institucional para instituições e valores mantidos após recusa; na escala V2.2, três posições, níveis e ressalvas começando como "não avaliado" e "não se aplica" e alertas que não impedem publicar. |
| `matriz-tres-por-tres.test.tsx` | Grade 3 × 3: nove células nomeadas, quantidade e nomes por célula, posicionamento por símbolo, selo "preliminar", revisão vencida, tabela equivalente e nenhuma conduta (T18). |
| `migracao-escalas-v2-2.test.ts` | Atualização de um banco da Etapa 2A para a escala V2.2: cópia de segurança antes de atualizar, todas as linhas anteriores preservadas campo a campo, valores das colunas novas, nenhuma atualização se a cópia falhar e nenhuma cópia em banco novo (T-1, T20, T24). |
| `banco-iniciativas-interacoes.test.ts` | Regras do banco da Etapa 3: iniciativa com vários projetos e stakeholders (inclusive dois papéis), contexto obrigatório, retirada de ligação no histórico e recusa da última, datas e conclusão datada, ligações únicas e imutáveis, proibição de excluir; reunião registrada uma única vez para várias iniciativas, alerta de repetição, origem externa única, participantes e presença, agenda; compromissos com responsáveis, prazos vencidos, filtros por responsável e projeto, pertencimento à iniciativa e acompanhamento preservado; visibilidade por projeto e auditoria. |
| `validacao-iniciativas-interacoes.test.ts` | Validações no servidor de iniciativas, interações, participantes, compromissos e acompanhamento; situação do prazo; data e hora no horário de Brasília; leitura de seleção múltipla; listas das telas iguais às do banco. |
| `telas-iniciativas-interacoes.test.tsx` | Registro de interação com várias iniciativas e a de origem já marcada; alerta de possível reunião repetida, com confirmação; nova iniciativa com o erro de projeto obrigatório; lista de compromissos com prazo vencido em destaque. |
| `migracao-etapa-3.test.ts` | Atualização de um banco da Etapa 2B para a Etapa 3 (migrações até a `0007`): cópia de segurança antes, todas as tabelas anteriores idênticas linha a linha e tabelas novas vazias. |
| `banco-plano-acao-riscos.test.ts` | Regras do banco da Etapa 4: um plano por projeto ou tema, pilares de referência opcionais, fluxo de aprovação (envio, devolução, aprovação com parecer, quem decidiu e quando, rejeição), versões decididas imutáveis, nova versão como cópia com códigos permanentes e substituição da anterior, comparação entre versões, acompanhamento sem aprovação (percentual opcional, marcos, atraso, registros preservados, só na versão vigente), histórico e visibilidade; matriz 5 × 5 com classificação igual no banco e nas telas, avaliação inerente obrigatória, teste específico de inerente × residual (medida e gatilho não reduzem o risco; reavaliação fundamentada; histórico preservado), filtros, pilar do mesmo projeto, stakeholders; conversão de compromisso em ação sem duplicidade. |
| `validacao-plano-acao-riscos.test.ts` | Parâmetros da matriz original (escalas, faixas, cores, prioridades e as 25 células), avaliação vigente, comparação sem percentual, sinais de reavaliação, validações de plano, ação, acompanhamento, decisão, risco, avaliação, gatilho e resposta, atraso, códigos, comparação entre versões e listas das telas iguais às do banco. |
| `telas-plano-acao-riscos.test.tsx` | Matriz 5 × 5 com as cores institucionais e a contagem por célula, selo da classificação, comparação inerente × residual sem percentual, cálculo da criticidade no formulário de avaliação, diferenças entre versões, pilares de referência no novo plano e formulário de acompanhamento com percentual opcional e marco. |
| `migracao-etapa-4.test.ts` | Atualização de um banco da Etapa 3 para a Etapa 4: cópia de segurança antes, todas as tabelas anteriores idênticas linha a linha (o compromisso ganha só a coluna `acao_id`, vazia) e tabelas novas vazias. |
| `seguranca-etapa-5.test.ts` | Plano executável dos testes de autenticação e segurança da Etapa 5 (D-074): itens pendentes, que não contam como aprovados até serem implementados e executados. |
| `formulario-projeto-tema.test.tsx` | Formulário de projeto ou tema com alerta de nome parecido; formulário de associação com a lista neutra de tipos de relação. |

Ferramentas: [Vitest](https://vitest.dev) e [Testing Library](https://testing-library.com).

Regras:

- Os testes usam **apenas dados fictícios** e um banco criado na memória ou em pasta temporária, que não afeta o banco local.
- Cada nova funcionalidade deve vir acompanhada de seus testes.
- Os nomes dos arquivos terminam em `.test.ts` ou `.test.tsx`.
