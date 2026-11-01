# Plano de Implantação

| Versão | Data | Situação |
|---|---|---|
| 0.1 | 31/10/2026 | Proposta de sequência de etapas para aprovação |

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
| 1.1 | Projetos, temas e contextos | Telas de comitês, projetos e temas; comitês participantes (D-023); associação de stakeholders aos contextos, sem avaliação de poder × interesse | ✅ Autorizada para planejamento (D-029); implementação depende da aprovação do plano |
| 2 | Avaliações e matriz de poder × interesse | Fichas e versões de avaliação, evidências, matriz por contexto. Depende de Q-01 a Q-07 | 🔧 |
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

## 5. Local de trabalho ✅ (D-019)

A cópia de trabalho do projeto fica em `C:\Projetos\crm-estrategico-es-em-acao`, obtida pelo GitHub, fora do Google Drive. O GitHub cumpre o papel de cópia de segurança e histórico. A pasta antiga no Google Drive não foi apagada.
