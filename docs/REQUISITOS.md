# Requisitos — CRM Estratégico ES em Ação

| Versão | Data | Situação |
|---|---|---|
| 0.1 | 31/10/2026 | Rascunho para revisão do gestor do projeto |
| 0.2 | 01/11/2026 | Etapa 1.1: comitês participantes e associação de stakeholders aos contextos (D-023, D-030) |
| 0.3 | 01/11/2026 | Etapa 2A: estrutura de avaliações com metodologia de demonstração (D-034) |
| 0.4 | 01/11/2026 | Grau de confiança (D-036), metodologia comum (D-037) e Conduta do ES em Ação como requisito futuro (D-038) |
| 0.5 | 01/11/2026 | Escalas V2.2 (D-057 a D-060): RF-21, RF-25, RF-27 e RF-28 atualizados; novos RF-29 e RF-30 |
| 0.6 | 01/11/2026 | Diretrizes das rubricas (D-061): RF-27 e RF-30 atualizados; novo RF-31 |
| 0.7 | 02/11/2026 | **Correção de numeração:** os requisitos RF-30 e RF-31 criados na seção 4.3 nas versões 0.5 e 0.6 repetiam números da seção 4.4 (Matriz de Iniciativas); passam a RF-29.1 e RF-29.2. RF-27 e RF-29.2 atualizados conforme a D-063. |
| 0.8 | 02/11/2026 | Correção RF-29.1/RF-29.2 aprovada pelo gestor (D-064); novo RF-29.3 (controle das alterações metodológicas). |
| 0.9 | 02/11/2026 | Discricionariedade fundamentada (D-067): RF-29.1 e RF-29.2 atualizados; novo RF-29.4 (avaliações profissionais com alertas orientativos). |
| 0.10 | 02/11/2026 | Versões finais da Q-66 e da Q-67 (D-068): RF-27, RF-29.2 e RF-29.4 atualizados. |
| 0.11 | 02/11/2026 | Etapa 2B implementada (D-069), aguardando homologação: RF-21, RF-25, RF-27 e RF-29.2 a RF-29.4 atualizados. |
| 0.12 | 03/11/2026 | Etapa 3 implementada (D-070), aguardando homologação: RF-30 a RF-34, RF-40 a RF-44, RN-05 e RN-06 atualizados. |
| 0.13 | 03/11/2026 | Etapa 4 aprovada e implementada (D-072), aguardando homologação: RF-50 a RF-54 e RF-60 a RF-63 atualizados; novos RF-55 a RF-57 e RF-64 a RF-66. |
| 0.14 | 06/11/2026 | Roteiro da Etapa 5 validado (D-074): RU-03 e RU-04 atualizados. |
| 0.15 | 06/11/2026 | Etapa 5 implementada, aguardando homologação: RU-03. |
| 0.16 | 06/11/2026 | Etapa 5 homologada para desenvolvimento (D-078): RU-03. Conteúdo inicial dos painéis definido pelo gestor (RF-71, Q-55). |
| 0.17 | 06/11/2026 | Etapa 6 validada e implementada, aguardando homologação (D-079): RF-70 e RF-71. |

## Como ler este documento

Cada item recebe uma das três classificações abaixo, usadas em toda a documentação:

| Marca | Significado |
|---|---|
| ✅ **Aprovado** | Requisito ou decisão já estabelecida pelo gestor do projeto (no README ou nas instruções da Etapa 0). |
| 🔧 **Proposta técnica** | Sugestão da equipe técnica para atender a um requisito. Depende de validação antes de ser considerada definitiva. |
| ⏳ **Pendente** | Decisão ainda não tomada. Não deve ser implementada até que seja deliberada. |

> **Fonte dos requisitos.** Este documento foi elaborado a partir do README e das instruções da Etapa 0 e conferido, para a avaliação de stakeholders, com o Manual de Especificação e Operação V2.2, o Guia de Implantação V2.2 e a Nota de Decisões Metodológicas V2.2 (01/11/2026), mantidos fora do repositório (D-057). Em caso de divergência, prevalecem o Manual e as decisões registradas em [REGISTRO_DECISOES.md](REGISTRO_DECISOES.md).

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
| RU-03 | Perfis de acesso: Administrador, Gestor, Colaborador e Leitor (ver [GOVERNANCA.md](GOVERNANCA.md)). | ✅ (D-074; implementado na Etapa 5 e homologado para desenvolvimento, D-078) |
| RU-04 | Cadastro Mestre: todos os usuários ativos e autenticados consultam o diretório básico; dados pessoais de contato, observações internas e informações vinculadas a projetos respeitam critérios de necessidade e autorização. | ✅ (D-074; a implementar na Etapa 5) |

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
| RF-21 | Cada avaliação registra poder e interesse (Baixo, Médio, Alto ou "não avaliado"), posicionamento (Favorável, Neutro, Contrário ou "não avaliado"), grau de confiança (Baixa, Média, Alta), justificativas e evidências; a justificativa é obrigatória para publicar e as evidências são opcionais (D-067). | ✅ (Manual V2.2, D-058 a D-060, D-067); implementado na Etapa 2B 🔧 (D-069, aguardando homologação); as metodologias de demonstração anteriores ficam como histórico |
| RF-22 | Avaliações independentes: a avaliação de um stakeholder em um projeto não altera sua avaliação em outro. | ✅ |
| RF-23 | Avaliações versionadas: uma reavaliação cria nova versão e preserva as anteriores, com suas metodologias, no histórico. | ✅ (implementado na Etapa 2A) |
| RF-24 | Visibilidade das avaliações restrita ao contexto (projeto ou tema) a que pertencem. | ✅ (estrutura e testes na Etapa 2A; segurança multiusuário não homologada) |
| RF-25 | Matriz de poder × interesse por projeto ou tema, em grade ordinal 3 × 3, distinguindo metodologia vigente, avaliações históricas e situações que exigem reavaliação; a célula é leitura, sem conduta automática. | ✅ (D-058); implementado na Etapa 2B 🔧 (D-069, aguardando homologação) |
| RF-26 | Critérios de avaliação de poder e interesse configuráveis, associados a uma versão da metodologia. Inicialmente uma metodologia institucional comum; a arquitetura deve permitir metodologias específicas por comitê ou contexto, aprovadas e fundamentadas, sem comparabilidade automática. | ✅ (D-037; estrutura implementada na Etapa 2A) |
| RF-27 | Rubricas observáveis dos níveis de poder, interesse e posicionamento, a partir da revisão dos critérios históricos; orientativas, sem pesos, fórmulas ou pontos de corte. | ✅ Versão final homologada (Q-66 1.0, D-068); escala definida (D-058); implementada na Etapa 2B 🔧 (D-069) |
| RF-28 | Dimensão "Conduta do ES em Ação", registrada separadamente de poder, interesse e posicionamento, sem derivação automática da matriz. | ⏳ Requisito futuro (D-038, Q-64) |
| RF-29 | Preservação do histórico: avaliações publicadas em escalas anteriores (Alto/Baixo; cinco categorias de posicionamento; demonstração de 0 a 100) permanecem intactas e identificadas pela metodologia, sem conversão automática nem recálculo. | ✅ (D-058, D-059) |
| RF-29.1 | "Neutro" pressupõe manifestação efetivamente neutra ou equidistante, formal ou informal, com justificativa; "não avaliado" é ausência de classificação — inclusive quando a manifestação não permite determinar posição predominante —, nunca neutralidade, e não há quarta categoria. O interesse independe de participação: presença e ausência são sinais de relacionamento, que não determinam o interesse; engajamento e conhecimento do projeto são dimensões distintas, com forma de registro a definir. | ✅ (D-059, D-060, D-061, D-067); registro de engajamento ⏳ (Q-65.3) |
| RF-29.2 | Ressalvas relevantes do posicionamento em campo próprio, com tratamentos preferenciais: sem manifestação identificada, não se aplica; manifestação sem condições identificadas, não identificadas; manifestação com informações insuficientes sobre condições, informação insuficiente; condição materialmente relevante, há ressalvas (com descrição). Percepções ainda não manifestadas ficam nas observações, não como ressalvas. Condição já prevista no projeto é relevante quando material para o posicionamento. Justificativa por dimensão classificada; documentos e evidências opcionais; Poder Baixo fundamentado pela indicação do que foi examinado ou considerado. | ✅ diretriz (D-063, D-067, D-068); implementada na Etapa 2B 🔧 (D-069), com a orientação sobre Poder Baixo como lembrete fixo no formulário |
| RF-29.3 | Controle das alterações metodológicas: cada nova versão da metodologia é classificada como substantiva ou editorial, com justificativa e aprovação; a mudança substantiva exige revalidação (nenhuma classificação herdada como válida) e só admite tendência com equivalência demonstrada; alterações estruturais não podem ser classificadas como editoriais. | ✅ diretriz (D-064); implementada na Etapa 2B 🔧 (D-069) |
| RF-29.4 | Avaliações profissionais com discricionariedade fundamentada: rubricas orientativas; avaliações preliminares admitidas; registro de responsável, data, justificativa, natureza da informação e grau de confiança; distinção entre avaliação preliminar e manifestação institucional confirmada (natureza do posicionamento e selo "preliminar"); alertas orientativos diante de possíveis inconsistências, sem impedir gravar, publicar ou continuar iniciativas; classificação mantida diante de alerta mediante justificativa, com os alertas mantidos gravados; sugestões automáticas de preenchimento, sem bloqueio; só bloqueios técnicos de integridade; histórico integral preservado; sem fluxos adicionais de aprovação nem novas categorias. | ✅ diretriz (D-067, D-068); implementada na Etapa 2B 🔧 (D-069) |

Detalhes em [METODOLOGIA_STAKEHOLDERS.md](METODOLOGIA_STAKEHOLDERS.md).

### 4.4 Matriz de Iniciativas

| ID | Requisito | Situação |
|---|---|---|
| RF-30 | Registro de iniciativas dos tipos demanda, reunião relevante e frente de atuação. | ✅ (implementado na Etapa 3) |
| RF-31 | Cadastro manual das iniciativas. | ✅ (implementado na Etapa 3) |
| RF-32 | Uma iniciativa pode envolver vários stakeholders e vários projetos. | ✅ (implementado na Etapa 3) |
| RF-33 | Papel de cada stakeholder na iniciativa (demandante, apoiador, decisor etc.). | 🔧 implementado com a lista provisória (P-042) |
| RF-34 | Forma de apresentação da matriz (o que aparece nas linhas e colunas). | ⏳ solução provisória em uso: lista filtrável (P-040) |

Detalhes em [MATRIZ_INICIATIVAS.md](MATRIZ_INICIATIVAS.md).

### 4.5 Interações e compromissos

| ID | Requisito | Situação |
|---|---|---|
| RF-40 | Registro de interações: reuniões, contatos e outros encontros. | ✅ (implementado na Etapa 3) |
| RF-41 | Registro de encaminhamentos e compromissos, com responsáveis e prazos. | ✅ (implementado na Etapa 3, com acompanhamento) |
| RF-42 | Uma interação pode contribuir para uma ou mais iniciativas. | ✅ (implementado na Etapa 3) |
| RF-43 | Reuniões não podem ser registradas em duplicidade: cada reunião existe uma única vez e é ligada às iniciativas, projetos e participantes pertinentes. | ✅ (implementado na Etapa 3, com alerta de possível repetição) |
| RF-44 | Controle de agenda (interações futuras) e alerta de prazos de compromissos. | 🔧 implementado na Etapa 3: agenda a partir de hoje e compromissos com prazo vencido em destaque, sem notificações |

### 4.6 Plano de Ação

| ID | Requisito | Situação |
|---|---|---|
| RF-50 | Registro de ações, responsáveis e marcos. | ✅ (implementado na Etapa 4: marcos como entregas verificáveis de cada ação, P-047) |
| RF-51 | Versionamento do plano de ação: um plano por projeto ou tema, com versões rascunho, em aprovação, aprovada, rejeitada ou devolvida para ajustes, e substituída (D-072). | ✅ (implementado na Etapa 4) |
| RF-52 | Aprovação de alterações do plano antes de entrarem em vigor; mudanças estruturais criam nova versão; quem decidiu, a data e o parecer ficam registrados. | ✅ (implementado na Etapa 4) |
| RF-53 | Acompanhamento sem nova aprovação: situação, marcos alcançados, observações e percentual (complementar e não obrigatório); atrasos calculados. | ✅ (D-072; implementado na Etapa 4) |
| RF-54 | Quem aprova as alterações do plano: por ora, o administrador do sistema, em nível único, com estrutura preparada para governança futura. | ✅ (D-072; revisitar com a autenticação) |
| RF-55 | Ações e marcos organizados por pilares ou eixos próprios de cada projeto ou tema, com os cinco pilares do Comitê de Infraestrutura como modelo opcional. | ✅ (D-072; implementado na Etapa 4) |
| RF-56 | Comparação entre versões do plano (ações e marcos incluídos, retirados e alterados). | 🔧 implementado na Etapa 4 |
| RF-57 | Conversão de compromisso em ação do plano, preservando a origem e sem duplicidade; ações ligadas a iniciativas e a stakeholders. | ✅ (D-072; implementado na Etapa 4, P-052) |

Detalhes em [PLANO_ACAO.md](PLANO_ACAO.md).

### 4.7 Matriz de Riscos

| ID | Requisito | Situação |
|---|---|---|
| RF-60 | Registro de riscos com criticidade, gatilhos e medidas de resposta. | ✅ (implementado na Etapa 4) |
| RF-61 | Criticidade calculada a partir de probabilidade e impacto: criticidade = probabilidade × impacto, calculada pelo banco. | ✅ (D-072; matriz original do Comitê de Infraestrutura) |
| RF-62 | Escalas de probabilidade e impacto (1 a 5) e faixas de criticidade (Baixo 1–4, Moderado 5–9, Alto 10–16, Crítico 17–25), com as cores e prioridades do instrumento original. | ✅ (D-072; implementado na Etapa 4) |
| RF-63 | Histórico das avaliações de cada risco, inerentes e residuais, com data, responsável e justificativa; reavaliação sempre fundamentada. | ✅ (D-072; implementado na Etapa 4) |
| RF-64 | Distinção entre risco inerente e residual, sem redução automática por registro de medida ou gatilho; comparação sem percentual de redução da exposição. | ✅ (D-072; implementado na Etapa 4) |
| RF-65 | Situações Aberto, Em mitigação, Monitorado, Mitigado e Escalonado; gatilhos com acompanhamento que sinaliza a reavaliação; respostas evitar, mitigar, transferir e aceitar, que podem apontar para ações do plano. | ✅ (D-072; implementado na Etapa 4) |
| RF-66 | Matriz 5 × 5 com as cores institucionais e consulta por projeto ou tema, criticidade, situação, responsável e gatilho. | ✅ (D-072; implementado na Etapa 4) |

Detalhes em [MATRIZ_RISCOS.md](MATRIZ_RISCOS.md).

### 4.8 Painéis e relatórios

| ID | Requisito | Situação |
|---|---|---|
| RF-70 | Painéis e relatórios gerenciais: visão por comitê, visão por projeto ou tema e relatórios R1 a R5 em XLSX, com as permissões da Etapa 5. | ✅ (D-079; implementado na Etapa 6, aguardando homologação) |
| RF-71 | Indicadores da primeira versão: contagens, datas e situações registradas de comitês, iniciativas, interações, compromissos, planos, ações, marcos, riscos e stakeholders, sem índices, rankings ou estimativas. | ✅ (D-079; implementado na Etapa 6, aguardando homologação) |

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
| RN-05 | Uma iniciativa pode envolver vários stakeholders e projetos; uma interação pode contribuir para uma ou mais iniciativas. | ✅ (implementado na Etapa 3) |
| RN-06 | Não duplicar registros de reuniões. | ✅ (implementado na Etapa 3) |
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
