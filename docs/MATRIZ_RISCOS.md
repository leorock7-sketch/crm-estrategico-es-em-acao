# Matriz de Riscos

| Versão | Data | Situação |
|---|---|---|
| 0.1 | 31/10/2026 | Rascunho para revisão |

Legenda: ✅ Aprovado · 🔧 Proposta técnica · ⏳ Pendente.

## 1. Escopo aprovado ✅

O módulo deve registrar **riscos**, sua **criticidade**, os **gatilhos** que sinalizam sua aproximação e as **medidas de resposta**.

## 2. Conceitos

| Termo | Significado |
|---|---|
| **Risco** | Evento incerto que, se ocorrer, afeta um projeto ou tema. |
| **Probabilidade** | Chance de o risco ocorrer. 🔧 |
| **Impacto** | Tamanho do efeito, caso ocorra. 🔧 |
| **Criticidade** | Combinação de probabilidade e impacto, usada para priorizar. ✅ (criticidade) / 🔧 (forma de cálculo) |
| **Gatilho** | Sinal observável de que o risco está se aproximando ou se materializando (por exemplo, "pauta incluída na Assembleia"). ✅ |
| **Medida de resposta** | O que será feito para tratar o risco. ✅ |

## 3. Informações de cada risco 🔧

| Informação | Obrigatória | Observação |
|---|---|---|
| Projeto ou tema | Sim | Define quem pode ver o risco |
| Código | Sim | Ex.: R-01 |
| Título, descrição, causa e consequência | Título obrigatório | |
| Categoria | Não | Lista ⏳ |
| Iniciativa e stakeholders relacionados | Não | |
| Responsável | Não | |
| Situação | Sim | Identificado, em monitoramento, materializado, encerrado |
| Avaliações (probabilidade, impacto, criticidade) | Sim, ao menos uma | Histórico preservado |
| Gatilhos | Não | Um ou mais |
| Medidas de resposta | Não | Uma ou mais |

## 4. Avaliação e criticidade 🔧 ⏳

- Cada avaliação do risco registra probabilidade, impacto, data, justificativa e avaliador. Reavaliar cria um novo registro; o histórico mostra a evolução. 🔧
- A criticidade é calculada automaticamente pelo sistema, a partir de probabilidade e impacto. 🔧
- **Escalas, fórmula e faixas de criticidade estão pendentes.** ⏳

Exemplo meramente ilustrativo, **não aprovado**, de uma convenção comum (escalas de 1 a 5 e criticidade = probabilidade × impacto):

| Criticidade (exemplo) | Faixa |
|---|---|
| 1 a 4 | Baixa |
| 5 a 9 | Moderada |
| 10 a 16 | Alta |
| 20 a 25 | Muito alta |

## 5. Medidas de resposta 🔧

Estratégias de referência, comuns em gestão de riscos:

| Estratégia | Significado |
|---|---|
| Evitar | Mudar o plano para eliminar o risco. |
| Mitigar | Reduzir a probabilidade ou o impacto. |
| Transferir | Passar o efeito para terceiros (contratos, seguros, parcerias). |
| Aceitar | Conviver com o risco, monitorando-o e preparando um plano de contingência. |

Cada medida tem descrição, responsável, prazo e situação. Quando a medida já for uma ação do Plano de Ação, ela aponta para essa ação, sem duplicá-la.

## 6. Visualização prevista 🔧

- Mapa de calor probabilidade × impacto por projeto ou tema.
- Lista de riscos ordenada por criticidade, com destaque para gatilhos ativos.
- Evolução da criticidade ao longo do tempo.

## 7. Questões pendentes ⏳

| ID | Questão |
|---|---|
| Q-40 | Escalas de probabilidade e de impacto. |
| Q-41 | Fórmula e faixas de criticidade. |
| Q-42 | Lista de categorias de risco (por exemplo: político, institucional, reputacional, jurídico, financeiro, cronograma, técnico). |
| Q-43 | Riscos podem existir fora de um projeto ou tema (riscos institucionais gerais)? |
| Q-44 | O registro de oportunidades (riscos positivos) é desejado? |
