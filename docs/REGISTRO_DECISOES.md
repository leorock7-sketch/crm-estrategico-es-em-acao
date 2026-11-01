# Registro de Decisões

| Versão | Data | Situação |
|---|---|---|
| 0.1 | 31/10/2026 | Registro inicial (Etapa 0) |

Este documento consolida o que já foi decidido, o que é sugestão técnica e o que ainda precisa de decisão. Ao decidir uma questão pendente, ela deve ser movida para a seção 1, com data e origem.

Legenda: ✅ Aprovado · 🔧 Proposta técnica · ⏳ Pendente.

## 1. Decisões aprovadas ✅

| ID | Data | Decisão | Origem |
|---|---|---|---|
| D-001 | Anterior à Etapa 0 | O sistema atende ao Comitê de Desenvolvimento e aos Comitês Temáticos de Infraestrutura, Atração de Investimentos e Inovação, subordinados a ele. | README / instruções da Etapa 0 |
| D-002 | Anterior à Etapa 0 | Funcionalidades previstas: as nove listadas no README. | README |
| D-003 | Anterior à Etapa 0 | Desenvolvimento com apoio do Claude Code e versionamento no GitHub. | README |
| D-004 | Anterior à Etapa 0 | Arquitetura de referência: Next.js com TypeScript; PostgreSQL, futuramente gerenciado pelo Supabase; Supabase Auth quando a autenticação for configurada; Vercel como hospedagem proposta. Sujeita a validação técnica e institucional. | README / instruções da Etapa 0 |
| D-005 | Anterior à Etapa 0 | Apenas dados fictícios em testes até autorização para dados reais. | README |
| D-006 | Anterior à Etapa 0 | Repositório em conta pessoal, provisoriamente, com transferência prevista para conta institucional. Sem transferência automática de direitos. | README |
| D-007 | Anterior à Etapa 0 | Repositório privado; proibido armazenar credenciais no código; alterações documentadas e testadas antes da implantação. | README |
| D-008 | 31/10/2026 | Operação inicial por um único administrador, com expansão para vários usuários e permissões por projeto ou tema. | Instruções da Etapa 0 |
| D-009 | 31/10/2026 | Cadastro Mestre global, com pessoas e instituições separadas, vínculos e histórico. | Instruções da Etapa 0 |
| D-010 | 31/10/2026 | O mesmo stakeholder pode ter posicionamento, influência e interesse diferentes em cada projeto ou tema. Avaliações independentes, versionadas e com visibilidade restrita por contexto. | Instruções da Etapa 0 |
| D-011 | 31/10/2026 | Uma iniciativa pode envolver vários stakeholders e projetos; uma interação pode contribuir para uma ou mais iniciativas; reuniões não são duplicadas. | Instruções da Etapa 0 |
| D-012 | 31/10/2026 | Os seis critérios históricos de poder e interesse estão em revisão. Não serão definidos critérios ou pesos até a conclusão da revisão. | Instruções da Etapa 0 |
| D-013 | 31/10/2026 | Etapa 0 sem conexão a serviços externos, criação de contas, contratação de serviços ou uso de dados reais. | Instruções da Etapa 0 |
| D-014 | 31/10/2026 | Trabalho em branch específica por etapa, com Pull Request para revisão e sem incorporação automática à `main`. Não avançar de etapa sem aprovação. | Instruções da Etapa 0 |
| D-015 | 31/10/2026 | Instalação de dependências e testes da Etapa 0 executados em cópia temporária no disco C:, fora do Google Drive. | Escolha do gestor durante a Etapa 0 |
| D-016 | 31/10/2026 | Pull Request aberto a partir de link gerado após o envio da branch, uma vez que o GitHub CLI não está instalado. | Escolha do gestor durante a Etapa 0 |

## 2. Propostas técnicas 🔧

Sugestões adotadas provisoriamente na Etapa 0. Podem ser revistas na validação técnica.

| ID | Proposta | Justificativa |
|---|---|---|
| P-001 | Tabela-mãe `stakeholder`, com `pessoa` e `instituicao` como especializações. | Avaliações, iniciativas e interações apontam para um único tipo de registro, sem campos duplicados. |
| P-002 | Projetos e temas na mesma tabela (`projeto_tema`), diferenciados por tipo. | Avaliações, planos, riscos e permissões usam um único conceito de "contexto". |
| P-003 | Versões imutáveis para avaliações, planos de ação e avaliações de risco. | Atende ao histórico exigido e garante rastreabilidade. |
| P-004 | Versões do plano de ação como "fotografias" completas, com código permanente por ação; andamento registrado à parte, sem exigir aprovação. | Separa mudança de planejamento (que exige aprovação) de acompanhamento cotidiano. |
| P-005 | Critérios de avaliação em tabelas configuráveis, ligadas a versões de metodologia. | Permite aplicar os critérios revistos sem alterar o sistema nem perder o histórico. |
| P-006 | Arquivamento em vez de exclusão física, com trilha de auditoria automática. | Preserva histórico e responsabilidade. |
| P-007 | Controle de acesso no banco de dados (Row Level Security). | A regra de visibilidade por contexto vale mesmo que haja falha na interface. |
| P-008 | Chaves primárias UUID. | Padrão do Supabase; facilita integrações e importações. |
| P-009 | Identificador de origem (`origem_sistema`, `origem_id`) nas interações. | Evita duplicar reuniões importadas do Outlook no futuro. |
| P-010 | Tailwind CSS para estilos. | Padrão do gerador oficial do Next.js; acelera a construção das telas. |
| P-011 | Vitest e Testing Library para testes automatizados. | Ferramentas recomendadas na documentação do Next.js para testes de componentes. |
| P-012 | Zod para validação de dados. | Mesmas regras de validação usadas nas telas e no servidor. |
| P-013 | Nomes de pastas de negócio, tabelas e campos em português. | Facilita a leitura por pessoas não técnicas e a correspondência com a documentação. |
| P-014 | Node.js LTS 22.22+, 24.15+ ou 26 (testado com 26.13.0). | Versões de suporte prolongado exigidas pelas ferramentas de teste (Vitest 5 e jsdom 30) e compatíveis com o Next.js 16. |
| P-015 | Fontes do sistema operacional na interface, em vez de fontes baixadas da internet. | Evita dependência de serviço externo na compilação. |
| P-016 | Resolução de caminhos nos testes pela opção nativa do Vite, sem o plugin `vite-tsconfig-paths`. | O plugin depende de biblioteca marcada como sem manutenção; o Vite 8 já oferece o recurso. |

## 3. Decisões pendentes ⏳

| ID | Questão | Documento | Quem decide |
|---|---|---|---|
| Q-01 | Critérios de poder e de interesse (revisão dos seis critérios históricos). | [Metodologia](METODOLOGIA_STAKEHOLDERS.md) | Gestor / instância institucional |
| Q-02 | Escala de poder e interesse. | [Metodologia](METODOLOGIA_STAKEHOLDERS.md) | Gestor |
| Q-03 | Significado de "grau de confiança". | [Metodologia](METODOLOGIA_STAKEHOLDERS.md) | Gestor |
| Q-04 | Categorias de posicionamento. | [Metodologia](METODOLOGIA_STAKEHOLDERS.md) | Gestor |
| Q-05 | Quadrantes e pontos de corte da matriz de poder × interesse. | [Metodologia](METODOLOGIA_STAKEHOLDERS.md) | Gestor |
| Q-06 | Pesos entre critérios. | [Metodologia](METODOLOGIA_STAKEHOLDERS.md) | Gestor |
| Q-07 | Avaliações antes da aprovação da metodologia. | [Metodologia](METODOLOGIA_STAKEHOLDERS.md) | Gestor |
| Q-08 | Periodicidade de revisão das avaliações. | [Metodologia](METODOLOGIA_STAKEHOLDERS.md) | Gestor |
| Q-10 | Projeto ou tema ligado a mais de um comitê. | [Modelo de dados](MODELO_DADOS.md) | Gestor |
| Q-11 | Hierarquia entre temas e projetos. | [Modelo de dados](MODELO_DADOS.md) | Gestor |
| Q-12 | Visibilidade do Cadastro Mestre para todos os usuários. | [Modelo de dados](MODELO_DADOS.md) | Gestor |
| Q-13 | Dados pessoais permitidos no cadastro (análise LGPD). | [Governança](GOVERNANCA.md) | Instância jurídica |
| Q-20 a Q-24 | Apresentação da matriz, prioridade, "reunião relevante", papéis, vínculo obrigatório a projeto. | [Iniciativas](MATRIZ_INICIATIVAS.md) | Gestor |
| Q-30 a Q-34 | Aprovação de planos, quantidade de planos, planos por iniciativa, níveis de aprovação. | [Plano de ação](PLANO_ACAO.md) | Gestor |
| Q-40 a Q-44 | Escalas, criticidade, categorias, riscos gerais e oportunidades. | [Riscos](MATRIZ_RISCOS.md) | Gestor |
| Q-50 | Forma de login: e-mail e senha pelo Supabase Auth ou contas Microsoft 365 institucionais (Microsoft Entra ID, também suportado pelo Supabase Auth). | [Arquitetura](ARQUITETURA.md) | Gestor / TI institucional |
| Q-51 | Região de hospedagem dos dados (por exemplo, São Paulo). | [Arquitetura](ARQUITETURA.md) | Gestor / instância institucional |
| Q-52 | Momento e procedimento de transferência para conta institucional. | [Governança](GOVERNANCA.md) | Instância institucional |
| Q-53 | Local definitivo da cópia de trabalho do projeto (manter no Google Drive ou mover para pasta local). | [Plano de implantação](PLANO_IMPLANTACAO.md) | Gestor |
| Q-54 | Quem fará a validação técnica independente. | [Governança](GOVERNANCA.md) | Gestor |
| Q-55 | Indicadores dos painéis executivos da primeira versão. | [Requisitos](REQUISITOS.md) | Gestor |
| Q-56 | Conferência desta documentação com o Manual de Especificação V2.0 e o Guia de Implantação. | Todos | Gestor |
