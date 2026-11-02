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
| 0.10 | 01/11/2026 | Escalas V2.2 (D-057 a D-060): Etapa 2B redefinida; plano de adaptação técnica proposto (seção 7, Q-67) |
| 0.11 | 01/11/2026 | Seção 7: ressalvas relevantes, justificativas e evidências por dimensão (D-061) |
| 0.12 | 02/11/2026 | Fase documental V2.2 concluída (D-062); próxima atividade: homologação da Q-66 e da Q-67 |
| 0.13 | 02/11/2026 | Diretrizes da Q-66 e da Q-67 homologadas com ajustes (D-063); seção 7 atualizada (T-1, T-4, T-6); calibração H6 pendente |
| 0.14 | 02/11/2026 | T-4 precisada (D-064); preparação operacional do H6 autorizada |

Legenda: ✅ Aprovado · 🔧 Proposta técnica · ⏳ Pendente.

> A sequência a partir da Etapa 1 é uma **proposta técnica** 🔧, conferida em 01/11/2026 com o Guia de Implantação V2.2 (mantido fora do repositório) quanto às etapas já realizadas e às escalas de avaliação (D-057). Cada etapa só começa com aprovação do gestor. ✅

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
| 2A | Metodologia e estrutura da avaliação estratégica | Fichas e versões, evidências, posicionamento, grau de confiança, permissões e matriz com metodologia de demonstração e dados fictícios | ✅ **Concluída**: homologada em 01/11/2026 para desenvolvimento e testes com dados fictícios (D-035, D-055) e incorporada à `main` pelo Pull Request #2 (commit de merge `81478af`); adaptação às escalas V2.2 pendente (seção 7) |
| 2B | Metodologia institucional V2.2 e adaptação técnica | Escalas aprovadas (D-058 a D-060); rubricas homologadas e adaptação do sistema às novas escalas (seção 7). Depende de Q-66 e Q-67 | ⏳ Suspensa: diretrizes da Q-66 e da Q-67 homologadas com ajustes (D-063); programação só após a calibração (H6) e a confirmação das versões finais; fase documental concluída (D-062) |
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
| Rascunho: posicionamento (cinco níveis e "não avaliado", escala do Manual V2.0 superada para novas avaliações pela D-059), grau de confiança, notas, justificativa, validação institucional e evidências; salvar, publicar e descartar | Concluída |
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

## 7. Adaptação às escalas V2.2 — plano proposto 🔧 (Q-67)

Decisões T-1 a T-7 homologadas com ajustes em 02/11/2026 (D-063). **Nada desta seção foi implementado.** A execução depende da calibração (H6) e da confirmação das versões finais da Q-66 e da Q-67. Referências: D-058 a D-060; [Metodologia](METODOLOGIA_STAKEHOLDERS.md), seções 3.2, 6, 9 e 10; [Modelo de Dados](MODELO_DADOS.md), seção 6.3.1.

### 7.1 Inventário de impactos

| Área | Hoje (Etapa 2A) | A V2.2 exige | Impacto | Transição proposta |
|---|---|---|---|---|
| Banco — posicionamento | Lista de cinco valores (tipo `posicionamento`, migração 0005) | Três categorias e "Não avaliado" nas novas versões | Alto | Manter a lista, por causa do histórico; a metodologia passa a indicar sua escala de posicionamento; regra no banco recusa as categorias parciais em metodologia de três categorias. Versões existentes não são tocadas. |
| Banco — poder e interesse | Número de 0 a 100 calculado das notas (`avaliacao_versao.poder` e `.interesse`) | Baixo, Médio, Alto ou "Não avaliado", classificados diretamente | Alto | Novas colunas de nível; as numéricas ficam só para as versões de demonstração já publicadas; regra impede misturar os dois tipos e impede Médio em metodologia binária histórica. |
| Banco — metodologia | Critérios com escala numérica e peso; só entra em vigor com critérios | Escala e rubricas por versão, sem pesos | Médio | Tipo de escala na metodologia e rubricas por nível em tabela própria, travadas quando a metodologia entra em vigor. Cada nova versão registra a natureza da alteração (substantiva ou editorial), com justificativa e aprovação (D-064). |
| Banco — ressalvas, justificativas e evidências (D-061, D-063) | Uma justificativa geral; evidências ligadas só à versão | Ressalvas em três situações; justificativa e evidência por dimensão; verificação documental para Poder Baixo; evidências históricas só como referência confirmada | Médio | Campo de situação das ressalvas e descrição; justificativas por dimensão e síntese; tabela que liga evidências às dimensões; tipo "verificação documental" (fontes, elementos, data); confirmação de pertinência de evidências reaproveitadas; regras de publicação correspondentes, sem quarta categoria. |
| Cálculo (`calculo.ts`) | Média ponderada convertida para 0 a 100 | Nenhum cálculo | Médio | Restrito às metodologias de demonstração; nenhum cálculo na metodologia V2.2 (T21). |
| Tendência (`tendenciaDoPosicionamento`) | Compara a posição na lista de cinco | Comparação de versões ou justificativa explícita | Médio | Comparar só avaliações metodologicamente comparáveis (mesma versão, alteração apenas editorial aprovada ou equivalência declarada); senão, "Não comparável", com justificativa (T-6, D-064). |
| Formulário de rascunho | Notas por critério; cinco posições; confiança "Alto, Médio, Baixo" | Níveis diretos; três posições; "Baixa, Média, Alta" | Alto | Campos de nível com "Não avaliado"; três posições; rubrica como texto de ajuda; ressalvas (três situações) e justificativas por dimensão; na mudança metodológica substantiva, nada de classificação é copiado como válido (T-4, D-064). |
| Ficha e histórico (`resumo-versao`, `selo-posicionamento`) | Notas com escala de 1 a 5; cores de cinco posições | Níveis; três categorias; parciais só no histórico | Médio | Exibir a escala de cada versão; parciais com a indicação "escala anterior". |
| Matriz (`matriz-poder-interesse`, `matriz.ts`) | Gráfico contínuo de 0 a 100, sem quadrantes | Grade 3 × 3; histórico binário em 2 × 2 | Alto | Novo componente de grade com células nomeadas; posição por cor ou ícone, com legenda; listas de não avaliados e de outras metodologias; nenhuma conduta. |
| Consultas, ações e validação (`consultas.ts`, `acoes.ts`, `esquemas.ts`) | Leem e validam notas e cinco posições | Novos campos e regras por escala | Médio | Validação conforme a escala da metodologia, no servidor e no banco. |
| Tela de metodologias | Descreve o cálculo de demonstração | Escala e rubricas | Baixo | Mostrar o tipo de escala e as rubricas; manter a descrição da demonstração nas antigas. |
| Dados de demonstração (`carregar-exemplos.ts`) | Duas metodologias numéricas; versões com posições parciais | Exemplos na escala V2.2 | Baixo | Manter os exemplos atuais como histórico de demonstração; nova metodologia fictícia de três níveis, marcada como não homologada. |
| Testes | 147 testes; o formulário espera cinco posições | T17 a T24 e testes complementares | Médio | Atualizar os testes afetados; acrescentar os novos e um teste de atualização de banco com dados da Etapa 2A. |

### 7.2 Sequência proposta, após a homologação de Q-66 e Q-67

1. **Cópia de segurança obrigatória** do banco local antes da migração (`.dados/copias/antes-escalas-v2-2`), com proposta de cópia automática antes de aplicar migrações pendentes (T-1).
2. Migração `0006`, **somente aditiva**: novos tipos, colunas e a tabela de rubricas. Sem excluir colunas e sem alterar ou recalcular versões publicadas. As metodologias já registradas recebem, como valor padrão das colunas novas, a escala em que foram feitas.
3. Regras no banco para as escalas de cada metodologia; novas versões passam a exigir metodologia, para que a escala seja sempre conhecida.
4. Rótulos, validação e formulário.
5. Ficha, histórico e tendência.
6. Matriz 3 × 3 (e 2 × 2 para histórico binário).
7. Dados de demonstração na escala V2.2.
8. Testes T17 a T24, complementares e de regressão, e **teste de preservação campo a campo** de um banco com dados da Etapa 2A (T-1).
9. Verificação no navegador, no computador e no celular, com dados fictícios.
10. Documentação e Pull Request, sem merge automático.

### 7.3 Riscos e cuidados

- **Migração destrutiva:** proibida (Nota V2.2). Só acréscimos; nada é apagado ou convertido.
- **Rascunhos abertos na troca de metodologia:** a regra atual já impede publicar rascunho de metodologia que deixou de vigorar. O avaliador descarta e recomeça, sem conversão.
- **Cópia indevida entre metodologias:** na mudança metodológica substantiva, nada de classificação é copiado como válido; evidências só contam como referência depois de confirmadas; alterações estruturais não podem ser classificadas como editoriais (T-4, D-064).
- **Versões sem metodologia** (posicionamento sem pontuação): tratadas como escala anterior.
- **Rubricas não homologadas** não podem ser usadas em avaliação institucional (T21).
- **Dados reais** continuam proibidos até autorização (D-005).

### 7.4 Critérios de aceite da adaptação

1. Tipos, qualidade, testes e compilação sem erros, com os testes T17 a T24 e os complementares ([Metodologia](METODOLOGIA_STAKEHOLDERS.md), seção 9).
2. Todas as versões existentes antes da migração continuam idênticas e identificadas pela metodologia original (T20, T24).
3. Nenhuma opção parcial de posicionamento nem campo numérico de poder ou interesse nas novas avaliações (T17, T22).
4. Matriz 3 × 3 correta, sem conduta automática (T18).
5. Funciona em celular e computador.

## 8. Pendências efetivas (01/11/2026)

| Pendência | Bloqueia | Situação |
|---|---|---|
| C6. Reforço da auditoria | Etapas 7 e 8 (D-027) | Planejada |
| C7. Cópia de segurança e restauração | Etapas 7 e 8 (D-027) | Planejada |
| C8. Portabilidade em PostgreSQL real | Etapas 7 e 8 (D-027) | Depende de autorização (Q-57) |
| Autenticação e segurança multiusuário (inclusive regras de acesso no banco) | Uso por mais de uma pessoa; Etapas 7 e 8 | Etapa 5; estrutura de permissões preparada na 2A, não homologada |
| Rubricas das escalas V2.2 e plano de adaptação técnica | Etapa 2B (D-060, D-063) | Diretrizes da Q-66 e da Q-67 homologadas com ajustes (D-063) e T-4 precisada (D-064); **calibração H6 em preparação operacional (D-064), pendente de execução**; versões finais após a calibração; decisões Q-65.1, Q-65.4 e Q-65.6 pendentes |
| Documentos de referência V2.3 | — | Roteiro preparado fora do repositório (D-063); emissão depois da calibração |
| Arquivos `MANUAL_OPERACIONAL.md` e `PLANO_TRANSFERENCIA_INSTITUCIONAL.md`, previstos no Guia | — | Ainda não existem no repositório; criação a autorizar |
| Conduta do ES em Ação | Requisito futuro RF-28 | Categorias e regras de correspondência a definir (Q-64) |
| Verificação automática no GitHub Actions | — | ✅ Implementada (D-041): Node.js 24 e 26, a cada Pull Request e atualização da `main` |
| Proteção da `main` (verificações obrigatórias antes do merge) | — | ✅ Configurada pelo administrador e conferida (D-045, D-052) |
| Revisão e incorporação dos Pull Requests das Etapas 1.1 e 2A | Base correta da Etapa 2A | ✅ Concluída: Etapa 1.1 incorporada pelo Pull Request #1 (D-053, `90c319c`) e Etapa 2A pelo Pull Request #2 (D-055, `81478af`) |
| Fase documental V2.2 (registro da Etapa 2A e escalas V2.2) | Homologação da Q-66 e da Q-67 | ✅ Concluída (D-062): Pull Requests #3 (`9084a74`) e #4 (`a254b40`) incorporados; próxima atividade: homologação da Q-66 e da Q-67 |
| Análise LGPD, retenção e anonimização | Etapa 8 | Q-13, Q-58 |

## 9. Local de trabalho ✅ (D-019)

A cópia de trabalho do projeto fica em `C:\Projetos\crm-estrategico-es-em-acao`, obtida pelo GitHub, fora do Google Drive. O GitHub cumpre o papel de cópia de segurança e histórico. A pasta antiga no Google Drive não foi apagada.
