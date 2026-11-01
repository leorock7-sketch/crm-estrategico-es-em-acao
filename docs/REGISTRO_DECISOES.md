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
| D-017 | 31/10/2026 | Etapa 0 — Fundação Técnica aprovada. A incorporação à `main` ocorre pelo Pull Request, por ação do gestor. | Aprovação do gestor |
| D-018 | 31/10/2026 | Banco de dados de desenvolvimento: PGlite (PostgreSQL executado dentro do projeto, sem instalação de programas). Os mesmos scripts de criação serão aplicados futuramente no Supabase. | Escolha do gestor para a Etapa 1 |
| D-019 | 31/10/2026 | Cópia de trabalho do projeto em pasta local (`C:\Projetos\crm-estrategico-es-em-acao`), fora do Google Drive. O GitHub é a cópia de segurança. Resolve Q-53. | Escolha do gestor para a Etapa 1 |
| D-020 | 31/10/2026 | Cada projeto ou tema tem um único comitê responsável; não há hierarquia entre temas e projetos. Pode ser ampliado no futuro. Resolve Q-10 e Q-11. **Revisada em 01/11/2026 pela D-023 quanto aos comitês participantes**; a ausência de hierarquia entre temas e projetos permanece. | Escolha do gestor para a Etapa 1 |
| D-021 | 31/10/2026 | Cadastro de pessoas com dados mínimos: nome, nome de tratamento, e-mail, telefone, observações e vínculos. Sem CPF, endereço ou data de nascimento. A análise LGPD (Q-13) continua necessária antes do uso de dados reais. E-mails e telefones passaram à tabela de contatos (D-025). | Escolha do gestor para a Etapa 1 |
| D-022 | 31/10/2026 | Etapa 1 — Banco de dados de desenvolvimento e Cadastro Mestre aprovada para execução, na branch `feature/cadastro-mestre`. | Aprovação do gestor |
| D-023 | 01/11/2026 | Cada projeto ou tema tem um **comitê principal** responsável e pode ter **comitês participantes**, registrados em tabela de ligação própria (`projeto_tema_comite`), com período e auditoria. A hierarquia institucional (Comitê de Desenvolvimento → Infraestrutura, Atração de Investimentos e Inovação) é preservada. Implementação na Etapa 1.1. | Revisão de homologação da Etapa 1; aprovação do gestor |
| D-024 | 01/11/2026 | CNPJ repetido **gera alerta, não bloqueio**: subunidades sem CNPJ próprio podem usar o do órgão superior. Instituições estrangeiras têm país próprio, sem CNPJ e sem UF; para instituições brasileiras, a UF é obrigatória. | Revisão de homologação da Etapa 1; aprovação do gestor |
| D-025 | 01/11/2026 | Contatos (e-mail, telefone, celular, site) em tabela própria, com natureza (pessoal, institucional ou funcional), período, contato principal, vínculo opcional com o cargo e histórico. **Sem unicidade do valor**: e-mails institucionais compartilhados ou passados ao sucessor geram alerta, não bloqueio. Pessoas e instituições mantêm identificadores permanentes. | Revisão de homologação da Etapa 1; aprovação do gestor |
| D-026 | 01/11/2026 | Plano de correções da revisão de homologação aprovado: trava do banco local (C1), contatos (C2), proteção de produção (C3), política de CNPJ (C4) e país (C5) nesta revisão; reforço da auditoria (C6) e comandos de cópia de segurança (C7) planejados; teste de portabilidade em PostgreSQL real (C8) depende de autorização específica. | Aprovação do gestor |
| D-027 | 01/11/2026 | **Etapa 1 homologada** — Banco de Dados de Desenvolvimento e Cadastro Mestre de Stakeholders, incluindo as correções C1 a C5 (commit `77bfea8`), **para fins de desenvolvimento e testes**. As pendências C6 (reforço da auditoria), C7 (cópia de segurança e restauração) e C8 (portabilidade em PostgreSQL real) permanecem registradas e devem ser solucionadas antes das respectivas etapas de implantação e do uso de dados institucionais reais. **A homologação não autoriza implantação em produção nem uso de dados reais.** | Homologação do gestor |
| D-028 | 01/11/2026 | Incorporação à `main`, após a revisão dos Pull Requests: primeiro a Etapa 0, depois a Etapa 1, preservando os respectivos históricos (merge com "Create a merge commit", sem squash nem rebase) e os resultados dos testes registrados nos Pull Requests. | Homologação do gestor |
| D-029 | 01/11/2026 | Etapa 1.1 — Projetos e Temas, incluindo os relacionamentos com stakeholders e comitês, autorizada **para planejamento**. A implementação depende da aprovação do plano. | Homologação do gestor |

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
| P-017 | Drizzle ORM para acesso ao banco, com scripts SQL gerados pelo drizzle-kit. | Funciona com PGlite e com Supabase; a estrutura das tabelas fica descrita em um único arquivo. |
| P-018 | Gatilhos no banco para auditoria, preenchimento de responsável e datas, proibição de exclusão e regras entre linhas. | As regras valem mesmo que alguém grave dados sem passar pelas telas. |
| P-019 | Usuário fictício "Administrador (desenvolvimento)" responsável por todas as operações até a etapa de autenticação. | Permite a trilha de auditoria desde já; será substituído pelo login real. |
| P-020 | Validação do CNPJ alfanumérico, adotado pela Receita Federal a partir de julho de 2026. | Novas inscrições podem conter letras; o sistema já as aceita. |
| P-021 | Alerta de possível duplicidade por nome, nome semelhante (primeiro e último nome), e-mail, sigla ou CNPJ, com confirmação expressa; na edição, só quando os dados de identificação mudam. | Atende ao Cadastro Mestre único sem impedir homônimos legítimos. |
| P-022 | Telas e ações do servidor organizadas por módulo (`src/modulos/stakeholders`), com a validação repetida no servidor. | Separa regras de negócio da interface e protege contra envios adulterados. |
| P-023 | Trava exclusiva da pasta do banco local por arquivo criado de forma atômica (`.dados/pglite.trava`), com substituição automática de travas abandonadas. | A revisão comprovou perda silenciosa de gravações com dois processos na mesma pasta (correção C1). |
| P-024 | Em produção, o banco local só é aceito com `CRM_BANCO=pglite`, destinado a testes locais da versão compilada. | Impede que dados reais sejam gravados por engano no banco de desenvolvimento (correção C3). |
| P-025 | Lista de países pelos 249 códigos ISO 3166-1, com nomes em português obtidos do próprio sistema. | Evita manter nomes de países à mão; um teste confere a lista. |
| P-026 | Contato funcional ligado ao vínculo é encerrado automaticamente quando o vínculo termina. | Representa a passagem do e-mail ou telefone do cargo ao sucessor. |

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
| Q-12 | Visibilidade do Cadastro Mestre para todos os usuários (relevante a partir da etapa de autenticação). | [Modelo de dados](MODELO_DADOS.md) | Gestor |
| Q-13 | Análise LGPD dos dados pessoais do cadastro, antes do uso de dados reais (o conjunto mínimo de campos já foi definido em D-021). | [Governança](GOVERNANCA.md) | Instância jurídica |
| Q-20 a Q-24 | Apresentação da matriz, prioridade, "reunião relevante", papéis, vínculo obrigatório a projeto. | [Iniciativas](MATRIZ_INICIATIVAS.md) | Gestor |
| Q-30 a Q-34 | Aprovação de planos, quantidade de planos, planos por iniciativa, níveis de aprovação. | [Plano de ação](PLANO_ACAO.md) | Gestor |
| Q-40 a Q-44 | Escalas, criticidade, categorias, riscos gerais e oportunidades. | [Riscos](MATRIZ_RISCOS.md) | Gestor |
| Q-50 | Forma de login: e-mail e senha pelo Supabase Auth ou contas Microsoft 365 institucionais (Microsoft Entra ID, também suportado pelo Supabase Auth). | [Arquitetura](ARQUITETURA.md) | Gestor / TI institucional |
| Q-51 | Região de hospedagem dos dados (por exemplo, São Paulo). | [Arquitetura](ARQUITETURA.md) | Gestor / instância institucional |
| Q-52 | Momento e procedimento de transferência para conta institucional. | [Governança](GOVERNANCA.md) | Instância institucional |
| Q-54 | Quem fará a validação técnica independente. | [Governança](GOVERNANCA.md) | Gestor |
| Q-55 | Indicadores dos painéis executivos da primeira versão. | [Requisitos](REQUISITOS.md) | Gestor |
| Q-56 | Conferência desta documentação com o Manual de Especificação V2.0 e o Guia de Implantação. | Todos | Gestor |
| Q-57 | Autorização para o teste de portabilidade em PostgreSQL real (por exemplo, GitHub Actions) e definição da versão de destino. | [Arquitetura](ARQUITETURA.md) | Gestor |
| Q-58 | Política de retenção, anonimização e eliminação de dados pessoais, inclusive na trilha de auditoria. | [Governança](GOVERNANCA.md) | Instância jurídica / gestor |
