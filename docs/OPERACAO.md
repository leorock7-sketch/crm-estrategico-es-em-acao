# Operação, limites gratuitos, suspensão e recuperação

| Versão | Data | Situação |
|---|---|---|
| 0.1 | 07/11/2026 | Fase 7A (D-082): arquitetura de custo zero, monitoramento, consumo, cópias de segurança, restauração e conta pessoal. Somente ambiente de desenvolvimento, com dados fictícios. |
| 0.2 | 07/11/2026 | Fase 7A homologada para desenvolvimento (D-083). Ressalvas: restauração completa do Supabase Auth não demonstrada, sem hospedagem pública e sem disponibilidade garantida no plano Free. |
| 0.3 | 07/11/2026 | Monitor ativado pelo gestor (teste de quatro semanas iniciado) e rotina diária de cópias no Agendador de Tarefas do Windows (D-084). |
| 0.4 | 07/11/2026 | Reativação da tarefa diária, conferência da chave com abertura de cópia existente e reserva do segundo projeto do Supabase para outra ferramenta (D-085). |
| 0.5 | 07/11/2026 | Chave privada conferida pelo arquivo local, sem gerenciador de senhas; segunda cópia segura da chave pendente antes de dados reais (D-086). |

Legenda: ✅ Aprovado · 🔧 Proposta técnica · ⏳ Pendente.

> **Meta financeira: US$ 0/mês** (D-082). Nenhum serviço pago, upgrade ou recurso adicional. Hospedagem pública, contas institucionais, novo projeto Supabase e dados reais dependem de autorização específica do gestor.

## 1. Arquitetura gratuita 🔧

| Parte | Serviço | Situação |
|---|---|---|
| Banco e login | Supabase Free, conta pessoal do gestor, projeto `crm-es-em-acao-dev` (São Paulo), descartável, só dados fictícios | Em uso |
| Aplicação | Netlify Free (candidato, A1) | Não criada; compatibilidade testada sem conta (seção 7) |
| Monitoramento | GitHub Actions do repositório público | Preparado; ativação depende de cadastrar os segredos (seção 2) |
| Cópias de segurança | pg_dump (PostgreSQL 17.11) e age 1.3.2 no computador do gestor, sem Docker | Em uso com dados fictícios |

Limites e condições dos fornecedores, conferidos em 07/11/2026 nas páginas oficiais (podem mudar sem aviso):

| Fornecedor | Limite ou condição | Efeito para o CRM |
|---|---|---|
| Supabase Free | Banco de 500 MB; 5 GB de transferência por mês; 1 GB de arquivos; 50 mil usuários ativos por mês; até 2 projetos gratuitos ativos | O segundo projeto gratuito está reservado para outra ferramenta institucional indicada pelo gestor (a mesma da V3-07) e não será usado pelo CRM (D-085). Banco de desenvolvimento com 21 MB (4,2%) em 07/11/2026. O CRM não usa armazenamento de arquivos nem funções do Supabase |
| Supabase Free | Projeto pausado após cerca de 7 dias de pouca atividade, **sem garantia** de que consultas evitem a pausa | Monitoramento reduz o risco; reativação manual (seção 4) |
| Supabase Free | Sem cópias automáticas, sem recuperação a um ponto no tempo e sem download de cópias | Cópias próprias (seção 5) |
| Netlify Free | 300 créditos por mês, limite rígido; ao esgotar, **todos** os sites da conta param até o ciclo seguinte; publicação em produção gasta 15 créditos; prévias não gastam | Sem cobrança, mas com interrupção. Consumo real só será conhecido nos testes T3 e T4 |
| Netlify Free | Funções em Ohio (padrão); mudança de região no plano gratuito não confirmada; até 60 s por requisição; memória de 1024 MB | Risco de lentidão com o banco em São Paulo (teste T3) |
| Netlify e Supabase | Plano gratuito sem garantia de disponibilidade, alterável ou encerrável pelo fornecedor | Continuidade não garantida |
| GitHub Actions | Fluxos agendados de repositório público desativados após 60 dias sem atividade no repositório; atrasos e descartes em horários de pico; registros e artefatos visíveis a usuários do GitHub | Conferência da própria automação e procedimento manual (seção 2); nenhum dado ou cópia no GitHub |

## 2. Monitoramento contra inatividade 🔧 (A3, P-066)

**O que comprova:** que o banco, o login e, quando houver hospedagem, a aplicação **respondem**. **O que não comprova:** que essa atividade baste para evitar a suspensão. O Supabase informa que algumas consultas por dia costumam bastar, sem garantia. A segunda pergunta só tem resposta indireta, pela ausência de avisos de pausa ao longo do tempo — e, enquanto houver uso de desenvolvimento, nem isso isola o efeito do monitor.

| Item | Como funciona |
|---|---|
| Frequência | 3 vezes ao dia: 07:17, 13:17 e 19:17 (Brasília), fora do início da hora |
| Banco | Papel `crm_monitor`: sem superusuário, sem BYPASSRLS, sem herança, no máximo 2 conexões, tempo-limite de 5 s, **sem nenhuma permissão em tabela, coluna ou função**. Faz `select 1`, confere as proteções no catálogo e lê o tamanho do banco. Recusa credencial com privilégio |
| Proteções | Toda tabela com regras de acesso forçadas, gatilho de auditoria e bloqueio de esvaziamento (C6); falha se alguma faltar |
| Login | Rota pública de saúde do Supabase Auth, com a chave pública |
| Aplicação | Rota `/saude` (sem sessão, sem dados), quando houver hospedagem |
| Registros | Data, verificação, resultado, duração e categoria do erro; no consumo, o percentual do limite. Nunca a mensagem original do erro |
| Alertas | E-mail do GitHub quando uma verificação falha ou o consumo passa de 70% ou 85%; e-mail do Supabase antes de pausar |
| Histórico | Aba Actions do repositório, fluxo "Monitoramento" (90 dias) |
| Consumo | Cerca de 30 a 60 segundos de execução por verificação, gratuitos em repositório público; poucos bytes de transferência no Supabase |

**Ativação (gestor):** depois da incorporação à `main`, cadastrar em *Settings > Secrets and variables > Actions* os segredos `CRM_MONITOR_URL`, `CRM_SUPABASE_URL` e `CRM_SUPABASE_CHAVE_PUBLICA`, com os valores do arquivo `.dados/segredos-monitor-github.txt` gerado por `npm run monitor:preparar`; depois, apagar o arquivo com `npm run monitor:preparar -- --apagar-arquivo`. O teste de quatro semanas começa nesse dia.

**Situação:** ✅ ativado em 07/11/2026 — segredos cadastrados pelo gestor, primeira execução manual concluída com sucesso e arquivo local dos segredos apagado. Teste de quatro semanas: de 07/11/2026 até cerca de 05/12/2026.

**Conferência da própria automação:** `npm run monitor:conferir` consulta a API pública do GitHub e acusa fluxo desativado, execução com falha ou mais de 26 horas sem execução concluída.

**Procedimento manual alternativo** (se o fluxo for desativado ou o GitHub estiver indisponível): reativar o fluxo na aba Actions (*Enable workflow*); enquanto isso, rodar `npm run monitor:verificar` no computador de desenvolvimento pelo menos uma vez por dia útil. Não se fazem commits artificiais para manter o repositório "ativo".

## 3. Consumo e limites 🔧 (P-067)

| Recurso | Fonte da medida | Frequência |
|---|---|---|
| Tamanho do banco | PostgreSQL (`pg_database_size`), lido pelo monitor | 3 vezes ao dia |
| Transferência, usuários ativos e armazenamento do Supabase | Painel *Usage* do Supabase | Mensal, pelo gestor |
| Créditos do Netlify | Painel de uso do Netlify e avisos do próprio Netlify (50%, 75%, 90%, 100%) | Mensal, quando houver hospedagem |

Os alertas de **70% e 85%** são parâmetros de gestão (D-082), não regras dos fornecedores. A automação de transferência e usuários ativos exigiria um token de acesso amplo à conta: não adotada.

Ao passar de 70%: apresentar ao gestor as medidas possíveis, como reduzir publicações em produção, conferir consultas que leem dados em excesso ou espaçar exportações. Ao passar de 85%: suspender publicações e usos não essenciais até a decisão do gestor. **Nunca** excluir registros, encurtar históricos ou desativar funções para economizar recursos, nem mudar de plano.

## 4. Suspensão do projeto Supabase e reativação ⏳

1. O Supabase envia e-mail antes de pausar. O monitor passa a falhar, em geral com a categoria `projeto-pausado` ou `projeto-inexistente-ou-pausado`.
2. O gestor entra no painel do Supabase, abre o projeto e usa **Restore**. O prazo considerado é de **90 dias** desde a pausa (D-082, valor conservador: há páginas do fornecedor que citam um ano).
3. Depois da reativação, conferir: `npm run ambiente:conferir`; `npm run monitor:verificar` (banco, proteções, consumo, login); `npm run backup:comparar` (nenhuma tabela pode ter menos registros que a última cópia, já que o CRM só arquiva); `npx vitest run --config vitest.supabase.config.mts testes/supabase/regras.test.ts` (regras de acesso, sem operação destrutiva); login de uma conta fictícia.
4. Se `backup:comparar` acusar perda: não gravar nada e seguir a seção 6.

## 5. Cópias de segurança (C7) 🔧 (P-068)

Somente do banco de desenvolvimento, com dados fictícios. **Nenhuma cópia de dados reais** antes da definição do local de guarda e das exigências de segurança e LGPD.

| Item | Como é feito |
|---|---|
| Conteúdo | Esquemas `public` e `drizzle`: dados, estrutura, regras de acesso (RLS), políticas, gatilhos e permissões. Tabelas `auth.users` e `auth.identities`: contas do login, com as senhas protegidas por hash |
| Consistência | Contagens e pg_dump usam o mesmo instantâneo do banco (transação somente leitura) |
| Criptografia | age 1.3.2, para a chave pública. A chave privada fica num arquivo local (`%USERPROFILE%\.crm-backup\identidade-age.txt`), fora do repositório e das pastas das cópias, sem gerenciador de senhas (D-086). **Pendente antes de dados reais:** segunda cópia segura da chave — sem ela, a perda do computador torna irrecuperáveis também as cópias do Google Drive |
| Destinos | Pasta local `C:\Projetos\backups-crm-desenvolvimento` e pasta do Google Drive `CRM_ES_em_Acao/Backups do CRM - desenvolvimento (dados ficticios)`. Nunca o GitHub nem artefatos públicos |
| Retenção | 7 diárias, 4 semanais e 3 mensais (fica a mais recente de cada período), aplicada só às cópias íntegras; a mais recente íntegra nunca é descartada, inclusive quando uma cópia nova falha |
| Integridade | `pg_restore --list` de cada arquivo, SHA-256 antes e depois da criptografia, manifesto e conferência das cópias nos dois destinos |
| Ensaio | `npm run backup:ensaiar`: restaura num PostgreSQL temporário e isolado, confere contagens, estrutura, regras, projetos visíveis por conta, senhas das contas fictícias no hash restaurado e roda o conjunto completo das regras de acesso pelo papel `crm_app`; depois apaga tudo |
| Comandos | `npm run backup:preparar` (uma vez), `npm run backup:executar`, `npm run backup:ensaiar`, `npm run backup:comparar` |
| Agendamento | ✅ Tarefa diária do Windows, autorizada pela D-084 (abaixo) |

**Fora da cópia, a reproduzir pelo painel** em caso de projeto novo: provedores de login e cadastro desligado, endereço do site e endereços de retorno, política de senha, Data API desligada, senhas dos papéis `crm_app` e `crm_monitor` (definidas de novo pelos comandos de preparação). As chaves de assinatura do projeto novo serão outras: as pessoas entram de novo.

**Programas** (fora do repositório, em `C:\Projetos\ferramentas`): PostgreSQL 17.11 (pacote oficial em zip, sem assinatura digital nem checksum publicados; conferidos origem HTTPS, tamanho, extração e versão) e age 1.3.2 (SHA-256 conferido com o publicado no GitHub).

### Rotina diária (D-084) ✅

Tarefa **"CRM - copia diaria (desenvolvimento)"** no Agendador de Tarefas do Windows, somente para o banco de desenvolvimento, com dados fictícios.

| Item | Como funciona |
|---|---|
| Horário | Diária às 12:30, só com o usuário conectado (nenhuma senha guardada no Agendador) e sem privilégio de administrador |
| Horário perdido | Executada assim que possível, quando o computador estava desligado ou o usuário desconectado às 12:30 |
| Sem duplicação | O Agendador não inicia uma segunda execução enquanto a primeira roda; uma trava na pasta local impede execuções simultâneas por outro caminho (trava com mais de 2 horas é desfeita); uma cópia da rotina por dia, no calendário de Brasília: nova execução no mesmo dia só confere. Limite de 30 minutos por execução |
| Cópia | Pelo comando de cópia da seção 5: gravada com nome provisório (`.parcial-…`) e renomeada só depois de conferida. Em falha, as cópias anteriores ficam intactas |
| Retenção | Só sobre as cópias íntegras; a mais recente íntegra nunca é descartada; pastas com problema ficam preservadas para análise; pastas provisórias de execução interrompida são apagadas depois de um dia |
| Conferência | Todas as cópias dos dois destinos: só arquivos criptografados e o manifesto (qualquer outro arquivo, inclusive em texto aberto, reprova a cópia); tamanho e SHA-256 de cada arquivo contra o manifesto; as mesmas cópias íntegras nos dois destinos |
| Monitor | Conferência somente leitura da automação do GitHub (`npm run monitor:conferir`); a rotina não altera o monitoramento |
| Registro | `registro-rotina.log`, só na pasta local (não sincronizado): data, etapa, resultado, duração, categoria e nome da cópia. Nunca conexões, chaves, senhas, mensagens de erro originais ou dados |
| Avisos | Falha: notificação do Windows e mensagem na tela. Pendência (ensaio vencido, chave não conferida, monitor com problema): notificação. Cada aviso substitui o anterior e é retirado na execução seguinte sem pendências. Sem arquivos de aviso: a Área de Trabalho pode estar no OneDrive, que impede processos do Agendador de regravar arquivos já sincronizados |
| Ensaio mensal | `npm run backup:ensaiar` pelo menos a cada 31 dias; o resultado entra no registro, e a rotina avisa quando o prazo vence |
| Chave privada | `npm run backup:conferir-chave-arquivo` (D-086) lê a chave direto do arquivo local, sem exibi-la: o próprio age lê o arquivo, que não é alterado nem apagado (o programa compara o resumo do arquivo antes e depois). O programa confere se a chave corresponde à chave pública usada nas cópias, abre só na memória cada arquivo da cópia íntegra mais recente, comparando o conteúdo com o resumo SHA-256 do original, e mostra se a tarefa diária continua habilitada. O registro guarda só o resultado. `npm run backup:conferir-chave` faz o mesmo com a chave colada, que não aparece na tela. Vale a conferência mais recente: até a primeira, ou depois de uma conferência com falha, a rotina avisa a pendência |

**Comandos:** `npm run backup:rotina` (o mesmo que a tarefa executa), `npm run backup:conferir` (só confere os destinos e mostra se a tarefa continua habilitada, com a última e a próxima execução), `npm run backup:conferir-chave-arquivo` (ou `backup:conferir-chave`, com a chave colada), `npm run backup:agendar` (cria ou atualiza a tarefa) e `npm run backup:agendar -- -Remover` (remove a tarefa).

**Limites:** depende do computador ligado e do usuário conectado. A conferência lê a pasta do Google Drive para computador; o envio à nuvem é feito pelo próprio aplicativo do Google Drive. A tarefa executa os scripts do repositório local, que precisa estar na `main` com esta rotina.

**Desativação de 07/11/2026 — causa não identificada (D-085).** A definição da tarefa foi alterada às 18:25:33 (desabilitada) e às 18:33:46 (habilitada de novo), sem comando desta rotina nem da sessão de testes. Os dois horários coincidem com o desligamento da tela ou espera do computador (o serviço de notificações do Windows encerrou a sessão do usuário às 18:25:33) e com a volta (eventos de energia às 18:33:47); na volta, as tarefas do OneDrive do mesmo usuário foram regravadas no mesmo segundo. O Windows não foi reiniciado nesse intervalo e o histórico do Agendador está desligado neste computador, por isso **a causa não pôde ser identificada com certeza**. Se a tarefa aparecer desabilitada de novo em `npm run backup:conferir`, investigar antes de reabilitar; ligar o histórico do Agendador (Agendador de Tarefas > *Habilitar Histórico de Todas as Tarefas*, com permissão de administrador) ajuda a identificar a origem.

## 6. Restauração num projeto Supabase ⏳

O ensaio local comprova dados, estrutura, regras, permissões e credenciais restauradas, mas **não** o login completo do Supabase Auth, que só roda num projeto Supabase. **A demonstração no segundo projeto gratuito não será feita:** ele está reservado para outra ferramenta institucional indicada pelo gestor (a mesma da V3-07) (D-085). A validação integral será replanejada, com uma alternativa tecnicamente segura e gratuita a apresentar; até lá, mantêm-se os ensaios locais isolados, e a pendência **não** está resolvida enquanto a restauração completa não for efetivamente comprovada. Roteiro técnico, para quando houver ambiente autorizado: preparar o projeto; aplicar `npm run supabase:preparar` com a conexão nova; restaurar os dados com `pg_restore --data-only` nas tabelas de `public` e de `auth`; reproduzir as configurações da seção 5; conferir com `backup:comparar` e com os testes não destrutivos.

## 7. Hospedagem candidata: Netlify Free 🔧 (A1)

| Teste | Resultado |
|---|---|
| Ferramenta oficial no Windows (`netlify build --offline`, adaptador 5.16.6) | Next.js e funções compilam; o empacotamento do proxy como Edge Function falha por erro de caminhos do Windows na ferramenta (com Turbopack e com webpack). Não conclusivo: o Netlify compila em Linux |
| Mesma compilação em Linux (GitHub Actions, sem conta e sem segredos) | Aprovada em 07/11/2026 (execução de 1f4c1c0): compilação com o adaptador 5.16.6, funções do servidor e Edge Function do proxy geradas; no servidor local do Netlify, /login com HTTP 200 e /paineis sem sessão levado ao login pelo proxy |

Pendentes, todos dependentes de autorização: T2 (prévia publicada com o banco de desenvolvimento), T3 (tempo de resposta Ohio–São Paulo), T4 (consumo real de créditos), T8 (segurança na hospedagem). A estimativa anterior de créditos **não** é previsão (D-082). Vercel Hobby fica excluído para uso institucional (termos restritos a uso pessoal e não comercial).

## 8. Conta pessoal: consequências ⏳ (D-082)

| Tema | Consequência enquanto o projeto estiver na conta pessoal |
|---|---|
| Continuidade | Depende de uma pessoa; indisponibilidade ou perda de acesso dela interrompe reativações, cópias e configurações |
| Recuperação de acesso | Depende da recuperação da conta pessoal (e-mail e códigos de recuperação) |
| Autenticação multifator | Deve estar ligada no GitHub, no Supabase, no Google e, se criado, no Netlify, com códigos de recuperação guardados fora do computador |
| Guarda de credenciais | Senhas e segredos do monitor ficam sob responsabilidade pessoal. A chave privada das cópias fica só no arquivo local do computador de desenvolvimento, sem gerenciador de senhas (D-086); segunda cópia segura pendente antes de dados reais |
| Responsabilidade sobre os dados | Termos dos fornecedores aceitos pela pessoa, e não pela instituição. Antes de uso institucional real, é preciso solução aceita pela instituição para continuidade administrativa e proteção de dados; o plano gratuito não resolve isso |
