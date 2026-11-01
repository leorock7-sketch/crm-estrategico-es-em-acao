# Metodologia de Avaliação de Stakeholders

| Versão | Data | Situação |
|---|---|---|
| 0.1 | 31/10/2026 | Estrutura para revisão. Critérios, escalas e pesos **não definidos**. |

Legenda: ✅ Aprovado · 🔧 Proposta técnica · ⏳ Pendente.

> **Importante.** Os seis critérios históricos de poder e interesse estão em revisão. Este documento **não** define critérios, escalas nem pesos. Ele descreve apenas como o sistema registrará as avaliações e quais decisões precisam ser tomadas. ✅

## 1. Conceitos

| Termo | Significado |
|---|---|
| **Stakeholder** | Pessoa ou instituição que influencia ou é afetada pelos projetos e temas do ES em Ação. Pessoas e instituições são cadastradas separadamente no Cadastro Mestre. ✅ |
| **Contexto** | Projeto ou tema estratégico em que o stakeholder é avaliado. ✅ |
| **Avaliação** | Conjunto de avaliações de um stakeholder em um contexto, ao longo do tempo. |
| **Versão da avaliação** | Uma avaliação completa feita em determinada data. Reavaliar cria nova versão; as anteriores ficam no histórico. ✅ |
| **Metodologia** | Conjunto de critérios, escalas e pesos usados nas avaliações. Cada versão da metodologia é registrada, para que avaliações antigas continuem interpretáveis. 🔧 |

## 2. Princípios aprovados ✅

1. **O mesmo stakeholder pode ter posicionamento, influência e interesse diferentes em cada projeto ou tema.** Por exemplo, uma federação empresarial pode ser grande apoiadora de um projeto de infraestrutura e neutra em um tema de inovação.
2. **Avaliações são independentes.** Avaliar um stakeholder no projeto A não altera nada no projeto B.
3. **Avaliações são versionadas.** Nenhuma avaliação é sobrescrita; o histórico mostra como a percepção evoluiu.
4. **A visibilidade é restrita ao contexto.** Só quem tem permissão no projeto ou tema vê as avaliações daquele contexto.
5. **O Cadastro Mestre é global.** Os dados cadastrais (nome, instituição, cargo) são únicos e compartilhados; as avaliações, não.

## 3. Elementos de cada avaliação ✅

Cada versão de avaliação registra:

| Elemento | Descrição | Definições pendentes |
|---|---|---|
| **Poder** | Capacidade do stakeholder de influenciar o projeto ou tema. | Critérios, escala e pesos ⏳ |
| **Interesse** | Grau em que o stakeholder é afetado ou se mobiliza pelo projeto ou tema. | Critérios, escala e pesos ⏳ |
| **Posicionamento** | Postura em relação ao projeto ou tema. | Categorias ⏳ |
| **Grau de confiança** | Ver questão Q-03 abaixo. | Significado e categorias ⏳ |
| **Justificativa** | Texto explicando por que a avaliação foi feita dessa forma. | — |
| **Evidências** | Documentos, links, observações ou interações já registradas que fundamentam a avaliação. | — |
| **Histórico** | Todas as versões anteriores, com data, avaliador e metodologia usada. | — |

## 4. Como o sistema registrará os critérios 🔧

Para não impor critérios antes da revisão, o sistema terá uma estrutura **configurável**:

1. **Versão da metodologia**: um registro com nome, descrição e período de vigência.
2. **Critérios** ligados a essa versão, cada um com dimensão (poder ou interesse), nome, orientação ao avaliador, escala e peso (opcional).
3. Em cada versão de avaliação, uma **nota por critério**, com justificativa opcional.
4. Os valores consolidados de **poder** e **interesse** são calculados a partir das notas, ou informados diretamente enquanto não houver metodologia aprovada.

Quando os critérios forem revistos, basta cadastrar uma nova versão da metodologia. As avaliações antigas continuam associadas à metodologia com que foram feitas.

Enquanto não houver metodologia aprovada, as avaliações poderão registrar justificativa, evidências e posicionamento, com poder e interesse em campo provisório. ⏳ Confirmar se isso é desejado ou se as avaliações devem aguardar a metodologia.

## 5. Matriz de poder × interesse

| Item | Situação |
|---|---|
| A matriz é uma funcionalidade prevista. | ✅ |
| Cada projeto ou tema terá sua própria matriz, usando a versão vigente da avaliação de cada stakeholder naquele contexto. | ✅ (decorre de RN-01) / 🔧 |
| Modelo de referência: o modelo clássico de quatro quadrantes (Mendelow), apresentado abaixo apenas como referência. | 🔧 |
| Nomes dos quadrantes, pontos de corte entre "alto" e "baixo" e tratamento de cada quadrante. | ⏳ |

Modelo de referência (não aprovado):

| | Interesse baixo | Interesse alto |
|---|---|---|
| **Poder alto** | Manter satisfeito | Gerenciar de perto |
| **Poder baixo** | Monitorar | Manter informado |

Sugestões técnicas para a visualização 🔧: cor do ponto conforme o posicionamento; tamanho ou transparência conforme o grau de confiança; possibilidade de comparar duas datas para ver o movimento dos stakeholders.

## 6. Fluxo de avaliação 🔧

1. O avaliador seleciona o projeto ou tema e o stakeholder.
2. Se não existir avaliação daquele stakeholder naquele contexto, o sistema cria a ficha.
3. O avaliador preenche a nova versão: poder, interesse, posicionamento, grau de confiança, justificativa e evidências.
4. Ao registrar, a nova versão passa a ser a vigente e a anterior fica marcada como substituída. Nada é apagado.
5. A matriz do contexto passa a refletir a versão vigente.

## 7. Questões pendentes ⏳

| ID | Questão | Opções a considerar (nenhuma decidida) |
|---|---|---|
| Q-01 | Quais são os critérios de poder e de interesse, após a revisão dos seis critérios históricos? | — |
| Q-02 | Qual escala será usada para poder e interesse? | Numérica (por exemplo, de 1 a 5) ou categórica (baixo, médio, alto) |
| Q-03 | O que significa "grau de confiança"? | (a) confiança na qualidade da própria avaliação, isto é, quão sólidas são as informações; ou (b) nível de confiança na relação institucional com o stakeholder |
| Q-04 | Quais categorias de posicionamento serão usadas? | Exemplo de partida: apoiador, neutro, opositor, desconhecido, com ou sem graduação de intensidade |
| Q-05 | Quais serão os pontos de corte e os nomes dos quadrantes da matriz? | — |
| Q-06 | Haverá pesos entre critérios? | — |
| Q-07 | Avaliações podem ser registradas antes da aprovação da metodologia? | — |
| Q-08 | Com que periodicidade as avaliações devem ser revistas? | Por calendário, por evento relevante ou ambos |

Essas questões estão consolidadas em [REGISTRO_DECISOES.md](REGISTRO_DECISOES.md).
