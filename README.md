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

Projeto em fase inicial de desenvolvimento — **Etapa 1: Banco de dados de desenvolvimento e Cadastro Mestre**.

Já existem a documentação, um banco de dados local de desenvolvimento e as telas do Cadastro Mestre (pessoas, instituições, vínculos e histórico de alterações). Ainda não há autenticação, hospedagem nem os demais módulos.

O ambiente de testes utilizará exclusivamente dados fictícios até que o tratamento de dados institucionais reais seja devidamente autorizado.

## Titularidade provisória

O repositório será inicialmente administrado em conta pessoal, de maneira provisória, para desenvolvimento e testes.

Está prevista a transferência de sua administração para uma conta institucional do ES em Ação, mediante autorização e formalização dos procedimentos necessários.

A titularidade definitiva do código, os direitos de uso e as responsabilidades institucionais deverão ser formalmente definidos. Esta declaração não constitui transferência automática de direitos.

## Segurança

O repositório deverá permanecer privado.

É proibido armazenar senhas, tokens, chaves de acesso ou outras credenciais no código-fonte.

As alterações deverão ser documentadas e testadas antes da implantação.

## Documentação

Os requisitos funcionais e técnicos constam no Manual de Especificação V2.0 e no Guia de Implantação do CRM Estratégico ES em Ação.

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
| `npm run banco:exemplos` | Carrega pessoas e instituições fictícias para testar as telas |
| `npm run banco:reiniciar` | Apaga o banco local; um banco novo e vazio é criado na próxima execução |

Para fazer uma cópia de segurança, pare a aplicação e copie a pasta `.dados/pglite` para outro lugar. Para restaurar, coloque a cópia de volta no mesmo lugar.

A versão compilada (`npm run build` e depois `npm start`) recusa o banco local, para que ele nunca seja usado em produção por engano. Para testá-la no seu computador, crie um arquivo `.env.local` com a linha `CRM_BANCO=pglite`.

### 5. Verificações de qualidade

| Comando | O que verifica |
|---|---|
| `npm run typecheck` | Se os tipos de dados do código TypeScript estão coerentes |
| `npm run lint` | Padrões de qualidade e possíveis erros no código |
| `npm test` | Testes automatizados |
| `npm run build` | Se a aplicação compila para publicação |
| `npm run verificar` | Executa todas as verificações acima, em sequência |
