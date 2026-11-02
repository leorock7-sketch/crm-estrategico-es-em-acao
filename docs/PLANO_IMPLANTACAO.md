# Plano de Implantação

| Versão | Data | Situação |
|---|---|---|
| 0.1 | 31/10/2026 | Proposta de sequência de etapas para aprovação |
| 0.2 | 01/11/2026 | Homologação da Etapa 1 (D-027), incorporação à `main` (D-028) e Etapa 1.1 (D-029, D-030) |
| 0.3 | 01/11/2026 | Homologação da Etapa 1.1 (D-031), repositório público (D-033) e Etapa 2A (D-032, D-034) |
| 0.4 | 01/11/2026 | Aprovação funcional da Etapa 2A (D-035), decisões D-036 a D-040 e consolidação das pendências |
| 0.5 | 01/11/2026 | Verificação automática no GitHub Actions (D-041), plano de revisão metodológica (D-042) e fluxo dos Pull Requests (D-043) |
| 0.6 | 01/11/2026 | Correção da normalização (D-044), proteção da `main` (D-045) e inventário metodológico (D-046) |
| 0.7 | 01/11/2026 | Homologação da Etapa 1.1 (D-047), providências concluídas (D-052) e relatório técnico de revisão metodológica (D-050) |
| 0.8 | 01/11/2026 | Etapa 1.1 concluída e incorporada à `main` (D-053); Pull Request da Etapa 2A (D-054) |
| 0.9 | 01/11/2026 | Etapa 2A homologada e incorporada à `main` (D-055); próxima atividade: decisões Q-65 (D-056) |

Legenda: ✅ Aprovado · 🔧 Proposta técnica · ⏳ Pendente.

> A sequência a partir da Etapa 1 é uma **proposta técnica** 🔧 e deve ser conferida com o Guia de Implantação citado no README, que não está no repositório. Cada etapa só começa com aprovação do gestor. ✅

## 1. Princípios ✅

- Cada etapa é desenvolvida em branch própria e entregue por Pull Request.
- A etapa seguinte só começa após aprovação da anterior.
- Testes e verificações são executados e relatados com resultados reais.
- Somente dados fictícios até autorização formal para dados reais.
- Nenhum serviço externo é conectado sem decisão expressa.

## 2. Etapas

| Etapa | Nome | Conteúdo principal | Situação |
|---|---|---|---|
| 0 | Fundação técnica | Documentação, esqueleto da aplicação, testes básicos | ✅ Aprovada em 31/10/2026 |
| 1 | Banco de dados de desenvolvimento e Cadastro Mestre | Banco PostgreSQL local, estrutura de comitês e projetos/temas, cadastro de pessoas, instituições e vínculos, com dados fictícios | ✅ **Homologada em 01/11/2026** para desenvolvimento e testes (D-027); pendências C6, C7 e C8 |
| 1.1 | Projetos, temas e contextos | Telas de comitês, projetos e temas; comitês participantes (D-023); associação de stakeholders aos contextos, sem avaliação de poder × interesse | ✅ **Concluída**: homologada em 01/11/2026 para desenvolvimento com dados fictícios (D-031, D-047, incluindo a correção de normalização) e incorporada à `main` pelo Pull Request #1 (commit de merge `90c319c`, D-053) |
| 2A | Metodologia e estrutura da avaliação estratégica | Fichas e versões, evidências, posicionamento, grau de confiança, permissões e matriz com metodologia de demonstração e dados fictícios | ✅ **Concluída**: homologada em 01/11/2026 para desenvolvimento e testes com dados fictícios (D-035, D-055) e incorporada à `main` pelo Pull Request #2 (commit de merge `81478af`) |
| 2B | Metodologia institucional e cálculos definitivos | Critérios, escalas, pesos, fórmula e pontos de corte homologados. Depende de Q-01, Q-02, Q-05, Q-06 e Q-60 | ⏳ Próxima atividade: revisão e homologação das seis decisões Q-65 (D-056), a partir do relatório técnico (D-046, D-050); programação não autorizada |
| 3 | Iniciativas, interações e compromissos | Matriz de iniciativas, registro único de reuniões, encaminhamentos e prazos | 🔧 |
| 4 | Plano de ação e matriz de riscos | Versões e aprovação, acompanhamento, riscos, gatilhos e respostas | 🔧 |
| 5 | Autenticação e permissões | Supabase Auth, perfis e permissões por projeto/tema, segurança no banco. Depende de Q-50 | 🔧 |
| 6 | Painéis e relatórios | Indicadores executivos e relatórios. Depende de Q-55 | 🔧 |
| 7 | Homologação e hospedagem | Supabase e Vercel com dados fictícios, validação técnica e institucional, plano de cópias de segurança. **Pré-requisitos: C6, C7 e C8 solucionadas** (D-027) | 🔧 ⏳ (exige contas e autorização) |
| 8 | Piloto com dados reais | Somente após autorização formal, análise LGPD e solução de C6, C7 e C8 (D-027) | ⏳ |
| 9 | Integrações | Outlook, calendário, SharePoint, OneDrive e IA assistiva | ✅ Futuro / 🔧 (ordem) |

A autenticação (Etapa 5) precisa estar concluída antes de qualquer hospedagem acessível pela internet (Etapa 7). 🔧

## 3. Etapa 0 — Fundação técnica

### Entregas

| Entrega | Situação |
|---|---|
| Branch `feature/fundacao-crm` | Concluída |
| README revisado e pasta `docs/` com dez documentos | Concluída |
| Aplicação Next.js com TypeScript e página inicial em português | Concluída |
| Estrutura de pastas para interface, componentes, módulos, banco, validação e testes | Concluída |
| `.gitignore` ajustado, inclusive para as pastas temporárias do Claude Code | Concluída |
| Testes: instalação, tipos, qualidade, compilação, teste automatizado e funcionamento da página | Executados e aprovados: tipos, qualidade e compilação sem erros; 9 de 9 testes; página verificada no navegador |
| Pull Request para revisão | Branch `feature/fundacao-crm` enviada ao GitHub |
| Aprovação do gestor | Aprovada em 31/10/2026 |

### Critérios de aceite

1. A aplicação instala e compila sem erros.
2. A página inicial exibe "CRM Estratégico — ES em Ação" e informa que está em desenvolvimento.
3. Nenhuma credencial no repositório.
4. Documentação diferencia aprovado, proposta e pendente.
5. Nenhuma alteração na `main` sem aprovação.

## 4. Etapa 1 — Banco de dados de desenvolvimento e Cadastro Mestre ✅ (D-022)

### Objetivo

Criar o banco de dados **local** de desenvolvimento e o primeiro módulo funcional, o Cadastro Mestre, usando apenas dados fictícios.

### Decisões tomadas para a etapa

| ID | Decisão |
|---|---|
| D-018 | Banco local PGlite, sem instalação de programas |
| D-019 | Cópia de trabalho em `C:\Projetos\crm-estrategico-es-em-acao` |
| D-020 | Um comitê responsável por projeto/tema, sem hierarquia |
| D-021 | Pessoas com dados mínimos |

### Entregas

| Entrega | Situação |
|---|---|
| Branch `feature/cadastro-mestre` | Concluída |
| Banco PGlite local, aplicado automaticamente ao iniciar a aplicação | Concluída |
| Scripts SQL versionados das 8 tabelas, com regras de integridade e gatilhos de auditoria | Concluída |
| Carga dos 4 comitês (script) e de dados fictícios (comando `npm run banco:exemplos`) | Concluída |
| Telas de pessoas e instituições: lista com busca, inclusão, edição, arquivamento e reativação | Concluída |
| Vínculos: registro, encerramento e regra de um único vínculo principal vigente | Concluída |
| Histórico de alterações por pessoa e por instituição | Concluída |
| Alerta de possível duplicidade com confirmação expressa | Concluída |
| Validação de CNPJ numérico e alfanumérico | Concluída |
| Testes automatizados e verificação no navegador | Resultados no relatório da Etapa 1 e no Pull Request |
| Aprovação do gestor | Homologada em 01/11/2026, com as correções C1 a C5, para desenvolvimento e testes (D-027) |

Ficaram de fora, conforme o plano: login real, telas de projetos e temas, avaliações, iniciativas, hospedagem e dados reais.

### Critérios de aceite

1. Tipos, qualidade, testes e compilação sem erros.
2. Cadastro, edição, arquivamento e reativação de pessoas e instituições funcionando no navegador.
3. Regras de integridade garantidas pelo banco, inclusive sem passar pelas telas.
4. Toda alteração registrada no histórico, com responsável e data.
5. Somente dados fictícios; nenhum serviço externo conectado.

### Revisão de homologação (01/11/2026) — D-026

| Correção | Situação |
|---|---|
| C1. Trava exclusiva da pasta do banco local | Concluída e testada (dois processos: o segundo é recusado) |
| C2. Contatos com natureza, vínculo e histórico (D-025) | Concluída; e-mails e telefones existentes migrados |
| C3. Proteção contra uso do banco local em produção | Concluída e testada |
| C4. CNPJ repetido gera alerta, não bloqueio (D-024) | Concluída |
| C5. País da instituição; UF e CNPJ só para o Brasil (D-024) | Concluída |
| C6. Reforço da auditoria | Planejada |
| C7. Comandos de cópia de segurança e restauração | Planejada |
| C8. Teste de portabilidade em PostgreSQL real | Depende de autorização (Q-57) |

**Homologação (D-027):** Etapa 1 homologada em 01/11/2026, com as correções C1 a C5, para fins de desenvolvimento e testes. C6, C7 e C8 continuam pendentes e são pré-requisitos das etapas de implantação (7) e de uso de dados reais (8). A homologação **não** autoriza implantação em produção nem uso de dados reais.

**Incorporação à `main` (D-028):** após a revisão dos Pull Requests, primeiro a Etapa 0 e depois a Etapa 1, com "Create a merge commit", preservando históricos e resultados dos testes.

## 5. Etapa 1.1 — Projetos, temas e contextos ✅ (D-029, D-030)

### Objetivo

Dar telas aos comitês, projetos e temas e registrar quem se relaciona com cada contexto, **sem** avaliação de poder × interesse, cujos critérios e pesos estão em revisão.

### Decisões tomadas para a etapa

| ID | Decisão |
|---|---|
| D-023 | Comitê principal e comitês participantes |
| D-030 | Comitês somente consulta; lista neutra de tipos de relação com descrição livre |

### Entregas

| Entrega | Situação |
|---|---|
| Branch `feature/projetos-temas`, criada após a incorporação das Etapas 0 e 1 (`f2fc7c9`) | Concluída |
| Script SQL `0004`: comitês participantes, stakeholders dos contextos e nome normalizado | Concluída |
| Comitês: lista com a hierarquia e página de cada comitê, com seus projetos e temas (somente consulta) | Concluída |
| Projetos e temas: lista com filtros (texto, tipo, situação e comitê), inclusão, edição, arquivamento e reativação | Concluída |
| Comitês participantes: inclusão e encerramento; o principal não pode ser participante | Concluída |
| Stakeholders associados: inclusão e encerramento, com tipo de relação e descrição | Concluída |
| Seção "Projetos e temas" nas páginas de pessoas e instituições; histórico de alterações | Concluída |
| Dados fictícios: 2 projetos e 2 temas (comando `npm run banco:exemplos`) | Concluída; em banco novo, 16 associações de stakeholders |
| Testes automatizados | Executados e aprovados em 01/11/2026: tipos, qualidade e compilação sem erros; 91 de 91 testes (67 anteriores e 24 novos) |
| Verificação no navegador (versão compilada, dados fictícios) | Executada em 01/11/2026. Encontrou um erro na lista de comitês (consulta com coluna ambígua), corrigido e coberto por teste; depois, todas as telas e regras verificadas, sem erros no servidor |
| Aprovação do gestor | Homologada em 01/11/2026, para desenvolvimento com dados fictícios (D-031) |

Ficaram de fora, conforme o plano: matriz de poder × interesse, avaliações, alteração de comitês, C6, C7 e C8, hospedagem e dados reais.

**Homologação (D-031):** Etapa 1.1 homologada em 01/11/2026 (commit `9c030e8`, Pull Request #1), para o ambiente de desenvolvimento com dados fictícios. Antes da incorporação à `main`: Pull Request correspondente ao commit homologado, sem conflitos e com as verificações aprovadas; merge não automático. C6, C7 e C8 continuam pendentes (D-027).

**Incorporação (D-053):** Pull Request #1 incorporado manualmente à `main` pelo gestor em 01/11/2026 (commit de merge `90c319c`), com as verificações "Node.js 24" e "Node.js 26" aprovadas. O conteúdo da `main` é idêntico ao do commit homologado `e7d4154`.

### Critérios de aceite

1. Tipos, qualidade, testes e compilação sem erros.
2. Cadastro, edição, arquivamento e reativação de projetos e temas funcionando no navegador.
3. Comitês participantes e stakeholders associados podem ser incluídos e encerrados, com histórico.
4. Nenhum campo de poder, interesse ou posicionamento.
5. Somente dados fictícios; nenhum serviço externo conectado.

## 6. Etapa 2A — Metodologia e estrutura da avaliação estratégica ✅ (D-032, D-034)

### Objetivo

Construir a estrutura das avaliações de stakeholders — fichas, versões, evidências, posicionamento, grau de confiança, permissões e matriz — usando **somente dados e metodologias fictícios**, enquanto os critérios institucionais estão em revisão.

### Decisões tomadas para a etapa

| ID | Decisão |
|---|---|
| D-033 | Repositório mantido público, sem dados reais nem documentos internos |
| D-034 | Plano aprovado com ajustes: análise da planilha só para a metodologia; demonstração não homologada; confiança em três níveis sem automação; histórico preservado; segurança não homologada |

### Entregas

| Entrega | Situação |
|---|---|
| Branch `feature/avaliacao-stakeholders`, a partir da branch da Etapa 1.1, sincronizada com a `main` após a incorporação da Etapa 1.1 (D-053) e incorporada à `main` pelo Pull Request #2 (D-055) | Concluída |
| Inventário metodológico da planilha "Mapa de Stakeholders" (entregue ao gestor fora do repositório) | Concluído: a planilha não contém os seis critérios |
| Script SQL `0005`: metodologias, critérios, fichas, versões, notas, evidências e permissões, com regras de publicação e imutabilidade | Concluída |
| Ficha do stakeholder no contexto: avaliação vigente, tendência e histórico completo de versões | Concluída |
| Rascunho: posicionamento (cinco níveis e "não avaliado"), grau de confiança, notas, justificativa, validação institucional e evidências; salvar, publicar e descartar | Concluída |
| Matriz por projeto ou tema: metodologia vigente no gráfico; históricas, reavaliação, sem pontuação, não avaliados e associação encerrada em listas; tabela equivalente | Concluída |
| Consulta das metodologias | Concluída |
| Permissões por contexto (estrutura e testes), com aviso de segurança não homologada | Concluída |
| Dados fictícios: 2 metodologias de demonstração e 7 avaliações (`npm run banco:exemplos`) | Concluída |
| Proposta de critérios de apoio ao grau de confiança e análise de metodologias por comitê | Apresentadas para aprovação (Q-61, Q-62) |
| Testes automatizados | Executados e aprovados em 01/11/2026: tipos, qualidade e compilação sem erros; 127 de 127 testes (91 anteriores e 36 novos) |
| Verificação no navegador (versão compilada, dados fictícios) | Executada em 01/11/2026: matriz e listas, ficha, tendência, nova versão, recusa sem validação institucional, publicação, evidência (link inválido recusado, inclusão e retirada), salvar rascunho, metodologias e celular; corrigidos o formato dos números (87,5) e o tamanho do texto do gráfico no celular; sem erros no servidor |
| Aprovação do gestor | Aprovada funcionalmente em 01/11/2026, para desenvolvimento e testes com dados fictícios, condicionada à revisão do Pull Request (D-035); homologada e incorporada à `main` em 01/11/2026 (D-055). Não abrange a metodologia quantitativa institucional, a autenticação multiusuário nem dados reais |

Ficaram de fora, conforme a D-034: critérios, pesos, fórmula e pontos de corte institucionais (Etapa 2B), classificação automática do grau de confiança, gestão de metodologias e de permissões pelas telas, autenticação, Matriz de Iniciativas, C6, C7, C8 e dados reais.

**Homologação e incorporação (D-055):** Etapa 2A homologada em 01/11/2026 para desenvolvimento e testes com dados fictícios e incorporada manualmente à `main` pelo gestor (Pull Request #2, commit de merge `81478af`), com as verificações "Node.js 24" e "Node.js 26" aprovadas. O conteúdo da `main` é idêntico ao do commit revisado `0e5d589`; na `main`, 147 de 147 testes aprovados e telas da Etapa 2A verificadas na versão compilada.

### Critérios de aceite

1. Tipos, qualidade, testes e compilação sem erros.
2. Mesmo stakeholder com avaliações independentes em dois contextos; versão anterior recuperável (T02, T03).
3. Posicionamento de instituição só com validação institucional (T04).
4. Usuário sem permissão não lê a avaliação de outro contexto (T05), nos testes de autorização.
5. "Não avaliado" nunca tratado como zero (T06).
6. Publicação exige justificativa e evidência; versões publicadas não mudam, nem diretamente no banco.
7. Matriz só com a metodologia vigente, sem ocultar históricas e sem comparar metodologias diferentes.
8. Todo resultado de demonstração marcado como não homologado; nenhum critério institucional no sistema.
9. Funciona em celular e computador.

## 7. Pendências efetivas (01/11/2026)

| Pendência | Bloqueia | Situação |
|---|---|---|
| C6. Reforço da auditoria | Etapas 7 e 8 (D-027) | Planejada |
| C7. Cópia de segurança e restauração | Etapas 7 e 8 (D-027) | Planejada |
| C8. Portabilidade em PostgreSQL real | Etapas 7 e 8 (D-027) | Depende de autorização (Q-57) |
| Autenticação e segurança multiusuário (inclusive regras de acesso no banco) | Uso por mais de uma pessoa; Etapas 7 e 8 | Etapa 5; estrutura de permissões preparada na 2A, não homologada |
| Seis critérios originais, escalas, pesos, fórmula e pontos de corte | Etapa 2B (D-040) | Inventário e relatório técnico de revisão metodológica entregues fora do repositório (D-046, D-050); próxima atividade: deliberação individual das seis decisões Q-65 (D-056) |
| Conduta do ES em Ação | Requisito futuro RF-28 | Categorias e regras de correspondência a definir (Q-64) |
| Verificação automática no GitHub Actions | — | ✅ Implementada (D-041): Node.js 24 e 26, a cada Pull Request e atualização da `main` |
| Proteção da `main` (verificações obrigatórias antes do merge) | — | ✅ Configurada pelo administrador e conferida (D-045, D-052) |
| Revisão e incorporação dos Pull Requests das Etapas 1.1 e 2A | Base correta da Etapa 2A | ✅ Concluída: Etapa 1.1 incorporada pelo Pull Request #1 (D-053, `90c319c`) e Etapa 2A pelo Pull Request #2 (D-055, `81478af`) |
| Análise LGPD, retenção e anonimização | Etapa 8 | Q-13, Q-58 |

## 8. Local de trabalho ✅ (D-019)

A cópia de trabalho do projeto fica em `C:\Projetos\crm-estrategico-es-em-acao`, obtida pelo GitHub, fora do Google Drive. O GitHub cumpre o papel de cópia de segurança e histórico. A pasta antiga no Google Drive não foi apagada.
