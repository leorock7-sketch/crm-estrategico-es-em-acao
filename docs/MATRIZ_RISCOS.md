# Matriz de Riscos

| Versão | Data | Situação |
|---|---|---|
| 0.1 | 31/10/2026 | Rascunho para revisão |
| 0.2 | 03/11/2026 | Etapa 4 aprovada e implementada (D-072), aguardando homologação: matriz 5 × 5 original do Comitê de Infraestrutura, riscos inerente e residual, gatilhos com acompanhamento e respostas ligadas ao Plano de Ação; Q-40 e Q-41 resolvidas |

Legenda: ✅ Aprovado · 🔧 Proposta técnica · ⏳ Pendente.

## 1. Escopo aprovado ✅

O módulo registra **riscos**, sua **criticidade**, os **gatilhos** que sinalizam sua aproximação e as **medidas de resposta** (D-072). Mantém-se a **matriz de riscos 5 × 5 originalmente aprovada pelo Comitê de Infraestrutura**: os parâmetros abaixo foram conferidos no instrumento original; nenhum intervalo, fórmula ou classificação foi criado pelo sistema.

## 2. Conceitos

| Termo | Significado |
|---|---|
| **Risco** | Evento incerto que, se ocorrer, afeta um projeto ou tema. |
| **Probabilidade** | Chance de o risco ocorrer, de 1 a 5 ✅. |
| **Impacto** | Tamanho do efeito, caso ocorra, de 1 a 5 ✅. |
| **Criticidade** | Probabilidade × impacto, de 1 a 25, usada para priorizar ✅. |
| **Risco inerente** | Avaliação do risco antes de considerar os controles e as medidas de mitigação ✅ (D-072). |
| **Risco residual** | Avaliação do risco remanescente depois de considerar os controles efetivamente implementados e a sua eficácia ✅ (D-072). Medidas apenas planejadas não contam como controles eficazes. |
| **Gatilho** | Sinal observável de que o risco está se aproximando ou se materializando ✅. |
| **Medida de resposta** | O que será feito para tratar o risco ✅. |

O instrumento original descreve o risco residual considerando também as ações de mitigação propostas; o CRM adota a definição do gestor (D-072): somente controles efetivamente implementados.

## 3. Parâmetros da matriz 5 × 5 (instrumento original do Comitê de Infraestrutura) ✅

### Probabilidade

| Nível | Probabilidade | Critério |
|---|---|---|
| 1 | Remota | Sem sinais concretos e sem precedentes recentes. |
| 2 | Baixa | Possível, mas pouco provável no ciclo atual. |
| 3 | Média | Há sinais ou antecedentes relevantes. |
| 4 | Alta | Risco recorrente ou com forte indício de ocorrência. |
| 5 | Muito alta | Risco já em curso ou muito provável no curto prazo. |

### Impacto

| Nível | Impacto | Critério |
|---|---|---|
| 1 | Muito baixo | Afeta atividade pontual, sem prejuízo relevante ao objetivo. |
| 2 | Baixo | Gera pequeno atraso ou retrabalho pontual. |
| 3 | Médio | Compromete parcialmente uma ação ou reduz sua qualidade. |
| 4 | Alto | Compromete agenda relevante, ator crítico ou marco importante. |
| 5 | Muito alto | Compromete legitimidade, governança ou capacidade de influência do comitê. |

### Criticidade, classificação e prioridade de tratamento

Criticidade = probabilidade × impacto.

| Criticidade | Classificação | Cor | Prioridade de tratamento |
|---|---|---|---|
| 1 a 4 | Baixo | `#E2F0D9` (verde-claro) | Manter controles |
| 5 a 9 | Moderado | `#FFF2CC` (amarelo-claro) | Monitorar com controles e revisão periódica |
| 10 a 16 | Alto | `#FCE4D6` (laranja-claro) | Mitigar com roteiro de atuação |
| 17 a 25 | Crítico | `#F4CCCC` (vermelho-claro) | Escalonar imediatamente |

O banco de dados calcula a criticidade e a classificação de cada avaliação com essas faixas; um teste automatizado confere se o cálculo do banco e o das telas coincidem nas 25 combinações.

### Status do risco

| Status | Significado |
|---|---|
| Aberto | O risco foi identificado, mas ainda não possui tratamento estruturado implementado. |
| Em mitigação | Existem ações concretas em andamento para reduzir probabilidade e/ou impacto. |
| Monitorado | O risco está sob controle, sem necessidade de novas ações no momento, mas exige vigilância. |
| Mitigado | O risco foi reduzido a um nível baixo ou aceitável, com baixa probabilidade de impacto relevante. |
| Escalonado | O risco ultrapassou a capacidade de gestão do nível atual e precisa de decisão ou intervenção superior. |

### Ocorrência de gatilho

| Ocorreu? | Significado |
|---|---|
| Sim | O risco está se materializando ou se aproximando de um nível crítico: reavaliação e ação imediata. |
| Não | O risco permanece com o mesmo status. |

## 4. Informações de cada risco ✅

| Informação | Obrigatória | Observação |
|---|---|---|
| Projeto ou tema | Sim | Define quem pode ver o risco |
| Código | Sim | R-01, R-02… por projeto ou tema (P-048) |
| Risco (título), descrição, causa e consequência | Título obrigatório | |
| Controles existentes | Não | Já implementados |
| Pilar ou eixo | Não | Do plano de ação do mesmo projeto ou tema (P-053), como a coluna "Pilar" do instrumento original |
| Iniciativa e stakeholders relacionados | Não | |
| Dono do risco | Não | Da equipe |
| Status | Sim | Seção 3 |
| Próxima revisão | Não | |
| Avaliações | Sim: a inerente, ao registrar o risco | Histórico preservado |
| Gatilhos e respostas | Não | Um ou mais |

## 5. Avaliação inerente e residual ✅ (D-072, item 3.1)

- Cada avaliação registra **probabilidade, impacto, criticidade, data, responsável e justificativa**. Reavaliar cria um novo registro; as avaliações anteriores não são alteradas.
- Todo risco nasce com a avaliação inerente. A residual é registrada quando houver controles efetivamente implementados, com justificativa.
- **Não há redução automática**: registrar uma medida de resposta ou a ocorrência de um gatilho não altera probabilidade, impacto nem criticidade.
- A avaliação **vigente** é a residual mais recente, se houver; senão, a inerente (P-049). Filtros por criticidade e resumos usam a vigente.
- O sistema sinaliza a necessidade de reavaliação quando um gatilho ocorre depois da última avaliação ou a data de revisão vence (P-049).
- A comparação entre inerente e residual mostra a mudança de faixa e de pontos do índice (por exemplo, "20 → 8, −12 pontos; de crítico para moderado"). O índice é ordinal: **não** representa uma redução percentual da exposição real ao risco, e o sistema não mostra percentuais.

## 6. Gatilhos e respostas ✅ (D-072, itens 3.3 e 3.4)

Cada gatilho tem descrição e acompanhamento ao longo do tempo (data, se ocorreu e observação); a última ocorrência registrada indica a situação do gatilho.

Medidas de resposta:

| Estratégia | Significado |
|---|---|
| Evitar | Mudar o plano para eliminar o risco. |
| Mitigar | Reduzir a probabilidade ou o impacto. |
| Transferir | Passar o efeito para terceiros (contratos, seguros, parcerias). |
| Aceitar | Conviver com o risco, monitorando-o e preparando um plano de contingência. |

Cada medida tem descrição, responsável (da equipe e/ou externo), prazo e situação (planejada, em execução, concluída ou cancelada — P-050). Quando a medida já for uma ação do Plano de Ação, ela aponta para essa ação, sem duplicá-la; a página da ação mostra os riscos a que ela responde.

## 7. Visualização ✅ (D-072, item 3.5)

- Matrizes 5 × 5 do risco inerente e do residual, com as cores institucionais e a quantidade de riscos em cada célula (clicar na célula lista os riscos).
- Lista filtrável por projeto ou tema, criticidade vigente, status, dono do risco e ocorrência de gatilho, com inerente, residual e comparação lado a lado.
- Ficha do risco com o histórico das avaliações, a posição nas duas matrizes, gatilhos, respostas, stakeholders e o histórico de alterações.
- Resumo por classificação na página do projeto ou tema; riscos nas páginas de iniciativa, pessoa, instituição e ação.

## 8. Questões ⏳

| ID | Questão | Situação |
|---|---|---|
| Q-40 | Escalas de probabilidade e de impacto. | ✅ Resolvida (D-072): escalas de 1 a 5 da matriz original |
| Q-41 | Fórmula e faixas de criticidade. | ✅ Resolvida (D-072): probabilidade × impacto e faixas da matriz original |
| Q-42 | Lista de categorias de risco. | ⏳ Pendente; por ora, o risco é classificado pelo pilar ou eixo (P-053) |
| Q-43 | Riscos podem existir fora de um projeto ou tema (riscos institucionais gerais)? | ⏳ Pendente; hoje, todo risco pertence a um projeto ou tema |
| Q-44 | O registro de oportunidades (riscos positivos) é desejado? | ⏳ Pendente |
