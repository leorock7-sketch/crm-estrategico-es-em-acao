# CRM Estratégico — ES em Ação

CRM institucional para gestão de stakeholders, projetos, iniciativas, interações, planos de ação e riscos estratégicos do ES em Ação.

## Apresentação

Projeto de desenvolvimento de um sistema próprio de gestão estratégica de relacionamentos institucionais (CRM), voltado ao acompanhamento de stakeholders, projetos, iniciativas, interações, planos de ação e matriz de riscos do ES em Ação.

## Estrutura institucional

O sistema será inicialmente estruturado para:

- Comitê de Desenvolvimento;
- Comitê Temático de Infraestrutura;
- Comitê Temático de Atração de Investimentos;
- Comitê Temático de Inovação.

Os três comitês temáticos são subordinados ao Comitê de Desenvolvimento.

## Funcionalidades previstas

1. Cadastro Mestre de Stakeholders.
2. Gestão de projetos e temas estratégicos.
3. Avaliação de stakeholders por projeto ou tema, com histórico.
4. Matriz de poder × interesse.
5. Matriz de iniciativas.
6. Controle de interações, agendas e compromissos.
7. Gestão de planos de ação e matriz de riscos.
8. Indicadores e painéis executivos.
9. Integrações futuras com Microsoft 365.

## Desenvolvimento

O projeto será desenvolvido com apoio do Claude Code e versionado no GitHub.

A arquitetura tecnológica inicialmente proposta utiliza Next.js, TypeScript, PostgreSQL, Supabase e Vercel, sujeita a validação técnica e institucional.

## Situação atual

Projeto em fase inicial de desenvolvimento. As Etapas 1, 1.1, 2A, 2B, 3, 4, 5 e 6 foram homologadas para desenvolvimento com dados fictícios; a homologação de produção depende da Etapa 7. As escalas de avaliação foram redefinidas pela deliberação V2.2 (poder e interesse: Baixo, Médio e Alto; posicionamento: Favorável, Neutro e Contrário; "Não avaliado" à parte), e o sistema foi adaptado a elas na Etapa 2B (D-069, D-070): matriz 3 × 3, rubricas como texto de apoio, alertas orientativos que não impedem o registro e avaliações preliminares identificadas. A Etapa 3 — Matriz de Iniciativas, interações registradas uma única vez e compromissos com prazos e acompanhamento — foi homologada para desenvolvimento (D-071), com soluções provisórias ainda não homologadas (P-040 a P-046). A Etapa 4 — Plano de Ação por projeto ou tema, com versões aprovadas, marcos e acompanhamento, e Matriz de Riscos 5 × 5 do Comitê de Infraestrutura, com riscos inerentes e residuais, gatilhos e respostas — foi homologada para desenvolvimento (D-073), com soluções provisórias ainda não homologadas (P-047 a P-053). A próxima etapa é a Autenticação e Permissões (Etapa 5), cujo roteiro será validado pelo gestor antes da programação.

Já existem a documentação, um banco de dados local de desenvolvimento, as telas do Cadastro Mestre (pessoas, instituições, vínculos, contatos e histórico de alterações) e as telas de comitês (somente consulta), projetos e temas, com comitês participantes e stakeholders associados, além da estrutura de avaliação de stakeholders (fichas, versões, evidências e matriz de poder × interesse) com uma metodologia fictícia na escala V2.2 e as metodologias de **demonstração** anteriores mantidas como histórico: os resultados exibidos são fictícios e **não homologados**. Ainda não há metodologia homologada para uso institucional, autenticação, hospedagem nem os demais módulos.

A Etapa 6 — painéis por comitê e por projeto ou tema, e relatórios R1 a R5 em XLSX, sempre dentro das permissões de cada usuário — foi homologada para desenvolvimento (D-080), com soluções provisórias ainda não homologadas (P-061 a P-065). O menu "Painéis" dá acesso às três áreas; a impressão e o PDF usam o próprio navegador.

Na Etapa 7, a meta é custo de US$ 0/mês (D-082). A Fase 7A — atualização de segurança do Next.js, troca obrigatória da senha provisória, páginas sem formulário para quem só consulta, reforço da auditoria, monitoramento gratuito, cópias criptografadas com ensaio de restauração e teste de compatibilidade com o Netlify Free — foi homologada para desenvolvimento (D-083), sem hospedagem pública e sem disponibilidade garantida no plano gratuito. Operação e limites: [docs/OPERACAO.md](docs/OPERACAO.md).

O ambiente de testes utilizará exclusivamente dados fictícios até que o tratamento de dados institucionais reais seja devidamente autorizado.

## Titularidade provisória

O repositório será inicialmente administrado em conta pessoal, de maneira provisória, para desenvolvimento e testes.

Está prevista a transferência de sua administração para uma conta institucional do ES em Ação, mediante autorização e formalização dos procedimentos necessários.

A titularidade definitiva do código, os direitos de uso e as responsabilidades institucionais deverão ser formalmente definidos. Esta declaração não constitui transferência automática de direitos.

## Segurança

Por decisão do gestor do projeto (D-033, de 01/11/2026), este repositório é mantido **público** por enquanto, com ciência dos riscos dessa escolha. A visibilidade pública do código **não** autoriza divulgar informações reais de stakeholders, documentos internos, planilhas institucionais, senhas, tokens, credenciais, dados de produção ou informações confidenciais. Antes de cada envio ao GitHub, os arquivos adicionados ou modificados e o histórico relevante são verificados quanto a dados pessoais, informações institucionais restritas e segredos.

O repositório ser público não significa que o futuro banco de dados do CRM será público: os dados ficarão em banco próprio, com acesso restrito.

É proibido armazenar senhas, tokens, chaves de acesso ou outras credenciais no código-fonte.

As alterações deverão ser documentadas e testadas antes da implantação.

## Documentação

Os requisitos funcionais e técnicos constam no Manual de Especificação e Operação V2.2, no Guia de Implantação V2.2 e na Nota de Decisões Metodológicas V2.2 do CRM Estratégico ES em Ação (01/11/2026), mantidos fora deste repositório (D-057).

A documentação será atualizada conforme o desenvolvimento avançar. A pasta [`docs/`](docs/) reúne a documentação técnica do repositório:

| Documento | Conteúdo |
|---|---|
| [REQUISITOS.md](docs/REQUISITOS.md) | Requisitos funcionais, não funcionais e regras de negócio |
| [ARQUITETURA.md](docs/ARQUITETURA.md) | Tecnologias, camadas e organização das pastas |
| [MODELO_DADOS.md](docs/MODELO_DADOS.md) | Modelo relacional: entidades, chaves, cardinalidades e regras de integridade |
| [METODOLOGIA_STAKEHOLDERS.md](docs/METODOLOGIA_STAKEHOLDERS.md) | Avaliação de stakeholders por projeto ou tema |
| [MATRIZ_INICIATIVAS.md](docs/MATRIZ_INICIATIVAS.md) | Demandas, reuniões relevantes e frentes de atuação |
| [PLANO_ACAO.md](docs/PLANO_ACAO.md) | Ações, marcos, versões e aprovação de alterações |
| [MATRIZ_RISCOS.md](docs/MATRIZ_RISCOS.md) | Riscos, criticidade, gatilhos e respostas |
| [GOVERNANCA.md](docs/GOVERNANCA.md) | Papéis, titularidade, fluxo de trabalho e proteção de dados |
| [REGISTRO_DECISOES.md](docs/REGISTRO_DECISOES.md) | Decisões aprovadas, propostas técnicas e decisões pendentes |
| [PLANO_IMPLANTACAO.md](docs/PLANO_IMPLANTACAO.md) | Etapas de implantação e critérios de aceite |
| [OPERACAO.md](docs/OPERACAO.md) | Operação a custo zero: monitoramento, limites gratuitos, suspensão, cópias de segurança e recuperação |

Em todos os documentos, cada item é classificado como **✅ Aprovado**, **🔧 Proposta técnica** ou **⏳ Pendente**.

## Como executar a aplicação no computador

Estas instruções não pressupõem experiência com programação.

### 1. Pré-requisito: Node.js

O Node.js é o programa que executa a aplicação. Utilize uma versão **LTS** ("LTS" significa versão de suporte prolongado, a mais estável): 22.22 ou superior, 24.15 ou superior, ou 26. O projeto foi testado com o Node.js 26.13.0 LTS.

- Baixe em <https://nodejs.org> e instale com as opções padrão; ou
- no Windows, abra o PowerShell e execute: `winget install OpenJS.NodeJS.LTS`

Para conferir, abra um novo terminal e digite `node -v`. Deve aparecer o número da versão, por exemplo `v26.13.0`.

### 2. Atenção ao Google Drive

Não instale as dependências dentro de uma pasta sincronizada pelo Google Drive, OneDrive ou serviço semelhante. A instalação cria dezenas de milhares de arquivos pequenos e a sincronização costuma causar lentidão e erros. Prefira uma pasta local, por exemplo `C:\Projetos\crm-estrategico-es-em-acao`, obtida com:

```
git clone https://github.com/leorock7-sketch/crm-estrategico-es-em-acao.git C:\Projetos\crm-estrategico-es-em-acao
```

### 3. Instalar e executar

Abra o terminal na pasta do projeto e execute, um comando por vez:

| Comando | O que faz |
|---|---|
| `npm install` | Baixa as bibliotecas usadas pelo projeto (somente na primeira vez ou quando elas mudarem) |
| `npm run dev` | Inicia a aplicação em modo de desenvolvimento |

Depois abra o navegador em <http://localhost:3000>. Para encerrar, volte ao terminal e pressione `Ctrl + C`.

### 4. Banco de dados local (somente dados fictícios)

Na primeira execução, a aplicação cria sozinha um banco de dados local na pasta `.dados/` do projeto, já com a estrutura das tabelas e os quatro comitês. Essa pasta **não** vai para o GitHub.

O banco local aceita um programa por vez. Se você tentar usá-lo com a aplicação aberta, aparecerá a mensagem "O banco de dados local já está em uso": feche a aplicação (`Ctrl + C` no terminal) e tente de novo. Com a aplicação parada:

| Comando | O que faz |
|---|---|
| `npm run banco:exemplos` | Carrega pessoas, instituições, projetos e temas fictícios para testar as telas (cada grupo só entra se ainda estiver vazio) |
| `npm run banco:reiniciar` | Apaga o banco local; um banco novo e vazio é criado na próxima execução |

Para fazer uma cópia de segurança, pare a aplicação e copie a pasta `.dados/pglite` para outro lugar. Para restaurar, coloque a cópia de volta no mesmo lugar.

A versão compilada (`npm run build` e depois `npm start`) recusa o banco local, para que ele nunca seja usado em produção por engano. Para testá-la no seu computador, crie um arquivo `.env.local` com a linha `CRM_BANCO=pglite`.

### 5. Login real e Supabase de desenvolvimento (Etapa 5)

Com as chaves do projeto de desenvolvimento em `.env.local` (modelo em `.env.example`), a aplicação exige login e usa o banco do Supabase. Sem elas, em desenvolvimento, funciona no modo local: banco PGlite e administrador fictício, sem login. Somente dados fictícios nos dois casos.

| Comando | O que faz |
|---|---|
| `npm run ambiente:conferir` | Confere o projeto Supabase, sem exibir nenhum valor |
| `npm run supabase:preparar` | Aplica as migrações e ativa o papel `crm_app`. Só no banco marcado como descartável, carrega os dados fictícios e cria as contas de teste (senhas só em `.dados/contas-teste.json`, que o Git ignora) |
| `npm run supabase:marcar-descartavel` | Identifica o banco como descartável, com frase de confirmação; não apaga nada. Banco marcado não pode receber dados institucionais reais (D-077) |
| `npm run ambiente:senha-admin -- gerar` e `-- aplicar` | Trocam a senha administrativa do PostgreSQL sem exibir o valor |
| `npm run test:supabase` | Testes de autenticação, regras de acesso e navegador no Supabase (antes: `npm run build`) |
| `npm run test:postgres` | Testes de banco das Etapas 1 a 4 no PostgreSQL do Supabase. **Apaga os dados do projeto**: só roda no banco marcado como descartável e com a frase de confirmação no próprio comando; depois, rode `npm run supabase:preparar -- --refazer`, com a mesma frase. Não executar sem necessidade e autorização específica do gestor (D-077) |

### 6. Verificações de qualidade

| Comando | O que verifica |
|---|---|
| `npm run typecheck` | Se os tipos de dados do código TypeScript estão coerentes |
| `npm run lint` | Padrões de qualidade e possíveis erros no código |
| `npm test` | Testes automatizados |
| `npm run build` | Se a aplicação compila para publicação |
| `npm run verificar` | Executa todas as verificações acima, em sequência |

A mesma verificação roda automaticamente no GitHub Actions a cada Pull Request e a cada atualização da `main`, no Node.js 24 e 26 (arquivo `.github/workflows/verificacao.yml`). O resultado aparece no próprio Pull Request. O fluxo usa somente leitura, não usa credenciais e não publica a aplicação nem faz merge.
