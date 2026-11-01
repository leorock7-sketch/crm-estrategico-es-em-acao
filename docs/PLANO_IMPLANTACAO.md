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
| 1 | Banco de dados de desenvolvimento e Cadastro Mestre | Banco PostgreSQL local, estrutura de comitês e projetos/temas, cadastro de pessoas, instituições e vínculos, com dados fictícios | 🔧 |
| 2 | Avaliações e matriz de poder × interesse | Fichas e versões de avaliação, evidências, matriz por contexto. Depende de Q-01 a Q-07 | 🔧 |
| 3 | Iniciativas, interações e compromissos | Matriz de iniciativas, registro único de reuniões, encaminhamentos e prazos | 🔧 |
| 4 | Plano de ação e matriz de riscos | Versões e aprovação, acompanhamento, riscos, gatilhos e respostas | 🔧 |
| 5 | Autenticação e permissões | Supabase Auth, perfis e permissões por projeto/tema, segurança no banco. Depende de Q-50 | 🔧 |
| 6 | Painéis e relatórios | Indicadores executivos e relatórios. Depende de Q-55 | 🔧 |
| 7 | Homologação e hospedagem | Supabase e Vercel com dados fictícios, validação técnica e institucional, plano de cópias de segurança | 🔧 ⏳ (exige contas e autorização) |
| 8 | Piloto com dados reais | Somente após autorização formal e análise LGPD | ⏳ |
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

## 4. Etapa 1 — proposta preliminar 🔧 (não iniciar sem aprovação)

### Objetivo

Criar o banco de dados **local** de desenvolvimento e o primeiro módulo funcional, o Cadastro Mestre, usando apenas dados fictícios.

### Conteúdo sugerido

1. Banco PostgreSQL local, preferencialmente com as ferramentas de desenvolvimento local do Supabase, que dispensam conta ou contrato. Requer instalar o Docker Desktop, a ser decidido.
2. Scripts versionados de criação das tabelas (*migrations*): `comite`, `projeto_tema`, `stakeholder`, `pessoa`, `instituicao`, `vinculo_pessoa_instituicao`, `usuario` e `registro_auditoria`.
3. Carga dos quatro comitês e de dados fictícios para testes.
4. Telas de listagem, cadastro, edição e arquivamento de pessoas, instituições e vínculos, com alerta de duplicidade.
5. Validação dos dados (Zod) e testes automatizados das regras.

### Decisões necessárias antes da Etapa 1

| ID | Decisão |
|---|---|
| Q-10, Q-11 | Projetos ou temas com mais de um comitê; hierarquia entre temas e projetos |
| Q-12, Q-13 | Visibilidade do Cadastro Mestre e dados pessoais permitidos |
| Q-53 | Local definitivo da cópia de trabalho (Google Drive ou pasta local) |
| — | Instalação do Docker Desktop para o banco local, ou alternativa |

## 5. Local de trabalho recomendado 🔧

O projeto está hoje dentro do Google Drive. Para as próximas etapas, recomenda-se manter uma cópia de trabalho em pasta local (por exemplo, `C:\Projetos\crm-estrategico-es-em-acao`), obtida pelo GitHub. O GitHub já cumpre o papel de cópia de segurança e histórico; a sincronização do Drive sobre dependências e banco local tende a causar lentidão, conflitos e corrupção de arquivos. ⏳ Decisão Q-53.
