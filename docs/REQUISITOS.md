# Requisitos — CRM Estratégico ES em Ação

| Versão | Data | Situação |
|---|---|---|
| 0.1 | 31/10/2026 | Rascunho para revisão do gestor do projeto |
| 0.2 | 01/11/2026 | Etapa 1.1: comitês participantes e associação de stakeholders aos contextos (D-023, D-030) |
| 0.3 | 01/11/2026 | Etapa 2A: estrutura de avaliações com metodologia de demonstração (D-034) |

## Como ler este documento

Cada item recebe uma das três classificações abaixo, usadas em toda a documentação:

| Marca | Significado |
|---|---|
| ✅ **Aprovado** | Requisito ou decisão já estabelecida pelo gestor do projeto (no README ou nas instruções da Etapa 0). |
| 🔧 **Proposta técnica** | Sugestão da equipe técnica para atender a um requisito. Depende de validação antes de ser considerada definitiva. |
| ⏳ **Pendente** | Decisão ainda não tomada. Não deve ser implementada até que seja deliberada. |

> **Fonte dos requisitos.** Este documento foi elaborado a partir do README e das instruções da Etapa 0. O Manual de Especificação V2.0 e o Guia de Implantação, citados no README, não foram disponibilizados no repositório. Quando forem, este documento deverá ser conferido com eles; em caso de divergência, prevalecem o Manual e as decisões registradas em [REGISTRO_DECISOES.md](REGISTRO_DECISOES.md).

## 1. Objetivo

Sistema próprio de gestão estratégica de relacionamentos institucionais (CRM) do ES em Ação, para acompanhar stakeholders, projetos, iniciativas, interações, planos de ação e riscos estratégicos. ✅

## 2. Escopo institucional

| ID | Requisito | Situação |
|---|---|---|
| RI-01 | O sistema atende ao Comitê de Desenvolvimento e a três comitês temáticos a ele subordinados: Infraestrutura, Atração de Investimentos e Inovação. | ✅ |
| RI-02 | A estrutura de comitês deve ser cadastrável, para permitir a inclusão futura de outros comitês sem alteração de código. | 🔧 |

## 3. Usuários

| ID | Requisito | Situação |
|---|---|---|
| RU-01 | Inicialmente, o sistema será operado por um único administrador. | ✅ |
| RU-02 | O sistema deve permitir expansão para vários usuários, com permissões por projeto ou tema. | ✅ |
| RU-03 | Perfis de acesso propostos: Administrador, Gestor de contexto, Colaborador e Leitor (ver [GOVERNANCA.md](GOVERNANCA.md)). | 🔧 (estrutura e testes na Etapa 2A) |
| RU-04 | Definição de quem pode ver o Cadastro Mestre (todos os usuários autenticados ou apenas perfis específicos). | ⏳ |

## 4. Requisitos funcionais

### 4.1 Cadastro Mestre de Stakeholders

| ID | Requisito | Situação |
|---|---|---|
| RF-01 | Cadastro Mestre único e global de stakeholders. | ✅ |
| RF-02 | Pessoas e instituições cadastradas separadamente. | ✅ |
| RF-03 | Registro de vínculos entre pessoas e instituições (cargo, área, período), preservando o histórico de vínculos anteriores. | ✅ |
| RF-04 | Histórico de alterações dos cadastros (quem alterou, quando e o que mudou). | ✅ |
| RF-05 | Alerta de possível duplicidade ao cadastrar pessoa ou instituição com nome, e-mail ou CNPJ semelhante a um já existente, sem bloquear situações institucionais legítimas. | ✅ (D-024, D-025) |
| RF-06 | Hierarquia entre instituições (por exemplo, secretaria vinculada a um governo). | 🔧 |
| RF-07 | Contatos de pessoas e instituições com natureza (pessoal, institucional, funcional), período, vínculo opcional com o cargo e histórico; o mesmo contato pode ser compartilhado ou passar ao sucessor. | ✅ (D-025) |
| RF-08 | Instituições estrangeiras, com país, sem CNPJ e sem UF. | ✅ (D-024) |

### 4.2 Projetos e temas estratégicos

| ID | Requisito | Situação |
|---|---|---|
| RF-10 | Cadastro de projetos e temas estratégicos. | ✅ |
| RF-11 | Cada projeto ou tema vinculado a um comitê responsável. | 🔧 |
| RF-12 | Um projeto ou tema tem um comitê principal e pode ter comitês participantes. | ✅ (D-023; implementado na Etapa 1.1) |
| RF-13 | Possibilidade de agrupar projetos dentro de temas (hierarquia). | Não adotado (D-020) |
| RF-14 | Associação de pessoas e instituições a projetos e temas, com tipo de relação de uma lista neutra e descrição livre, sem avaliação de poder ou interesse. | ✅ (D-030; implementado na Etapa 1.1) |
| RF-15 | Consulta dos comitês, com a hierarquia e os projetos e temas em que cada um é principal ou participante. Alteração de comitês fora do escopo atual. | ✅ (D-030) |

### 4.3 Avaliação de stakeholders

| ID | Requisito | Situação |
|---|---|---|
| RF-20 | Avaliação de stakeholders por projeto ou tema. | ✅ (estrutura na Etapa 2A, dados fictícios) |
| RF-21 | Cada avaliação registra poder, interesse, posicionamento (cinco níveis e "não avaliado"), grau de confiança (alto, médio, baixo), justificativas e evidências; justificativa e evidência são obrigatórias para publicar. | ✅ (Manual V2.0, D-034) |
| RF-22 | Avaliações independentes: a avaliação de um stakeholder em um projeto não altera sua avaliação em outro. | ✅ |
| RF-23 | Avaliações versionadas: uma reavaliação cria nova versão e preserva as anteriores, com suas metodologias, no histórico. | ✅ (implementado na Etapa 2A) |
| RF-24 | Visibilidade das avaliações restrita ao contexto (projeto ou tema) a que pertencem. | ✅ (estrutura e testes na Etapa 2A; segurança multiusuário não homologada) |
| RF-25 | Matriz de poder × interesse por projeto ou tema, distinguindo metodologia vigente, avaliações históricas e situações que exigem reavaliação. | ✅ (demonstração na Etapa 2A, sem pontos de corte) |
| RF-26 | Critérios de avaliação de poder e interesse configuráveis, associados a uma versão da metodologia. | 🔧 (estrutura implementada na Etapa 2A) |
| RF-27 | Os seis critérios históricos de poder e interesse, suas escalas e pesos. | ⏳ Em revisão — não definidos (Q-01, Q-60) |

Detalhes em [METODOLOGIA_STAKEHOLDERS.md](METODOLOGIA_STAKEHOLDERS.md).

### 4.4 Matriz de Iniciativas

| ID | Requisito | Situação |
|---|---|---|
| RF-30 | Registro de iniciativas dos tipos demanda, reunião relevante e frente de atuação. | ✅ |
| RF-31 | Cadastro manual das iniciativas. | ✅ |
| RF-32 | Uma iniciativa pode envolver vários stakeholders e vários projetos. | ✅ |
| RF-33 | Papel de cada stakeholder na iniciativa (demandante, apoiador, decisor etc.). | 🔧 |
| RF-34 | Forma de apresentação da matriz (o que aparece nas linhas e colunas). | ⏳ |

Detalhes em [MATRIZ_INICIATIVAS.md](MATRIZ_INICIATIVAS.md).

### 4.5 Interações e compromissos

| ID | Requisito | Situação |
|---|---|---|
| RF-40 | Registro de interações: reuniões, contatos e outros encontros. | ✅ |
| RF-41 | Registro de encaminhamentos e compromissos, com responsáveis e prazos. | ✅ |
| RF-42 | Uma interação pode contribuir para uma ou mais iniciativas. | ✅ |
| RF-43 | Reuniões não podem ser registradas em duplicidade: cada reunião existe uma única vez e é ligada às iniciativas, projetos e participantes pertinentes. | ✅ |
| RF-44 | Controle de agenda (interações futuras) e alerta de prazos de compromissos. | 🔧 |

### 4.6 Plano de Ação

| ID | Requisito | Situação |
|---|---|---|
| RF-50 | Registro de ações, responsáveis e marcos. | ✅ |
| RF-51 | Versionamento do plano de ação. | ✅ |
| RF-52 | Aprovação de alterações do plano antes de entrarem em vigor. | ✅ |
| RF-53 | Atualização de andamento (percentual, situação) sem necessidade de nova aprovação. | 🔧 |
| RF-54 | Quem aprova as alterações do plano em cenário multiusuário. | ⏳ |

Detalhes em [PLANO_ACAO.md](PLANO_ACAO.md).

### 4.7 Matriz de Riscos

| ID | Requisito | Situação |
|---|---|---|
| RF-60 | Registro de riscos com criticidade, gatilhos e medidas de resposta. | ✅ |
| RF-61 | Criticidade calculada a partir de probabilidade e impacto. | 🔧 |
| RF-62 | Escalas de probabilidade e impacto e faixas de criticidade. | ⏳ |
| RF-63 | Histórico das reavaliações de cada risco. | 🔧 |

Detalhes em [MATRIZ_RISCOS.md](MATRIZ_RISCOS.md).

### 4.8 Painéis e relatórios

| ID | Requisito | Situação |
|---|---|---|
| RF-70 | Painéis e relatórios gerenciais. | ✅ |
| RF-71 | Indicadores e painéis executivos que comporão a primeira versão. | ⏳ |

### 4.9 Integrações futuras

| ID | Requisito | Situação |
|---|---|---|
| RF-80 | Integrações futuras com Outlook, calendário, SharePoint, OneDrive e IA assistiva. | ✅ Futuro — fora das etapas iniciais |
| RF-81 | Estrutura de dados preparada para receber reuniões importadas do calendário sem duplicidade (identificador de origem). | 🔧 |

## 5. Regras de negócio

| ID | Regra | Situação |
|---|---|---|
| RN-01 | O mesmo stakeholder pode ter posicionamento, influência e interesse diferentes em cada projeto ou tema. | ✅ |
| RN-02 | Avaliações são independentes entre contextos e versionadas. | ✅ |
| RN-03 | A visibilidade de uma avaliação é restrita ao seu contexto. | ✅ |
| RN-04 | O Cadastro Mestre é global: cada pessoa ou instituição existe uma única vez no sistema. | ✅ |
| RN-05 | Uma iniciativa pode envolver vários stakeholders e projetos; uma interação pode contribuir para uma ou mais iniciativas. | ✅ |
| RN-06 | Não duplicar registros de reuniões. | ✅ |
| RN-07 | Não definir critérios ou pesos de poder e interesse até a conclusão da revisão dos seis critérios históricos. | ✅ |
| RN-08 | Versões aprovadas (de avaliações e de planos) não são editadas; mudanças geram nova versão. | 🔧 |
| RN-09 | Registros não são apagados fisicamente: são arquivados, preservando o histórico. A exclusão definitiva de dados pessoais, quando exigida por lei, seguirá procedimento próprio. | 🔧 / ⏳ |

## 6. Requisitos não funcionais

| ID | Requisito | Situação |
|---|---|---|
| RNF-01 | Repositório público por decisão do gestor (D-033, que substitui a exigência de repositório privado), sem publicar dados reais, documentos internos, planilhas institucionais ou credenciais; verificação antes de cada envio ao GitHub. | ✅ |
| RNF-02 | Proibido armazenar senhas, tokens, chaves ou credenciais no código-fonte. | ✅ |
| RNF-03 | Alterações documentadas e testadas antes da implantação. | ✅ |
| RNF-04 | Somente dados fictícios em ambiente de testes até autorização formal para uso de dados reais. | ✅ |
| RNF-05 | Arquitetura de referência: Next.js, TypeScript, PostgreSQL (futuramente gerenciado pelo Supabase), Supabase Auth, Vercel e GitHub — sujeita a validação técnica e institucional. | ✅ |
| RNF-06 | Interface integralmente em português do Brasil. | 🔧 |
| RNF-07 | Adequação à LGPD (Lei 13.709/2018): base legal, finalidade, minimização, retenção e direitos dos titulares dos dados pessoais de stakeholders. | ⏳ Requer análise jurídica |
| RNF-08 | Trilha de auditoria de todas as operações de inclusão, alteração e arquivamento. | 🔧 |
| RNF-09 | Controle de acesso aplicado também no banco de dados (segurança em nível de linha), e não apenas na interface. | 🔧 |
| RNF-10 | Interface utilizável em computador e em celular, com atenção à acessibilidade. | 🔧 |
| RNF-11 | Cópias de segurança periódicas do banco de dados, com teste de restauração. | 🔧 |
| RNF-12 | Região de hospedagem dos dados (por exemplo, no Brasil). | ⏳ |

## 7. Fora do escopo da Etapa 0 ✅

- Cadastro Mestre e demais módulos operacionais.
- Banco de dados de produção.
- Autenticação real.
- Matrizes operacionais.
- Conexão com serviços externos, criação de contas ou contratação de serviços.
- Uso de dados institucionais reais.

## 8. Decisões pendentes

A lista consolidada de decisões pendentes, com identificador e responsável, está em [REGISTRO_DECISOES.md](REGISTRO_DECISOES.md#3-decisões-pendentes).
