# Operação, limites gratuitos, suspensão e recuperação

| Versão | Data | Situação |
|---|---|---|
| 0.1 | 07/11/2026 | Fase 7A (D-082): arquitetura de custo zero, monitoramento, consumo, cópias de segurança, restauração e conta pessoal. Somente ambiente de desenvolvimento, com dados fictícios. |
| 0.2 | 07/11/2026 | Fase 7A homologada para desenvolvimento (D-083). Ressalvas: restauração completa do Supabase Auth não demonstrada, sem hospedagem pública e sem disponibilidade garantida no plano Free. |
| 0.3 | 07/11/2026 | Monitor ativado pelo gestor (teste de quatro semanas iniciado) e rotina diária de cópias no Agendador de Tarefas do Windows (D-084). |
| 0.4 | 07/11/2026 | Reativação da tarefa diária, conferência da chave com abertura de cópia existente e reserva do segundo projeto do Supabase para outra ferramenta (D-085). |
| 0.5 | 07/11/2026 | Chave privada conferida pelo arquivo local, sem gerenciador de senhas; segunda cópia segura da chave pendente antes de dados reais (D-086). |
| 0.7 | 08/11/2026 | P-071 (D-088): desempenho após a otimização, ferramentas de medição, ociosidade configurável das conexões, publicação em produção e reversão. |
| 0.6 | 08/11/2026 | Etapa 7B (D-087): site de testes no Netlify Free, público e protegido pelo login e pelas permissões do CRM; resultados de T2, T3, T4 e T8; diagnóstico do desempenho; procedimento de contas e roteiro para os colegas, que só serão convidados depois da aprovação do gestor. |

Legenda: ✅ Aprovado · 🔧 Proposta técnica · ⏳ Pendente.

> **Meta financeira: US$ 0/mês** (D-082). Nenhum serviço pago, upgrade ou recurso adicional. Hospedagem pública, contas institucionais, novo projeto Supabase e dados reais dependem de autorização específica do gestor.

## 1. Arquitetura gratuita 🔧

| Parte | Serviço | Situação |
|---|---|---|
| Banco e login | Supabase Free, conta pessoal do gestor, projeto `crm-es-em-acao-dev` (São Paulo), descartável, só dados fictícios | Em uso |
| Aplicação | Netlify Free, site de testes `crm-estrategico-es-em-acao-testes` (D-087) | Publicado e público desde 08/11/2026, só com dados fictícios; colegas ainda não convidados (seção 7) |
| Monitoramento | GitHub Actions do repositório público | Preparado; ativação depende de cadastrar os segredos (seção 2) |
| Cópias de segurança | pg_dump (PostgreSQL 17.11) e age 1.3.2 no computador do gestor, sem Docker | Em uso com dados fictícios |

Limites e condições dos fornecedores, conferidos em 07/11/2026 nas páginas oficiais (podem mudar sem aviso):

| Fornecedor | Limite ou condição | Efeito para o CRM |
|---|---|---|
| Supabase Free | Banco de 500 MB; 5 GB de transferência por mês; 1 GB de arquivos; 50 mil usuários ativos por mês; até 2 projetos gratuitos ativos | O segundo projeto gratuito está reservado para outra ferramenta institucional indicada pelo gestor (a mesma da V3-07) e não será usado pelo CRM (D-085). Banco de desenvolvimento com 21 MB (4,2%) em 07/11/2026. O CRM não usa armazenamento de arquivos nem funções do Supabase |
| Supabase Free | Projeto pausado após cerca de 7 dias de pouca atividade, **sem garantia** de que consultas evitem a pausa | Monitoramento reduz o risco; reativação manual (seção 4) |
| Supabase Free | Sem cópias automáticas, sem recuperação a um ponto no tempo e sem download de cópias | Cópias próprias (seção 5) |
| Netlify Free | 300 créditos por mês, limite rígido; ao esgotar, **todos** os sites da conta param até o ciclo seguinte; publicação em produção gasta 15 créditos; prévias não gastam | Sem cobrança, mas com interrupção. Consumo real só será conhecido nos testes T3 e T4 |
| Netlify Free | Funções em Ohio (us-east-2); a escolha da região das funções é restrita aos planos Pro e Enterprise, segundo a documentação oficial; até 60 s por requisição; memória de 1024 MB | **Restrição do ambiente gratuito:** o banco fica em São Paulo, e cada ida e volta ao banco custa cerca de 0,16 s (teste T3, seção 7) |
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
| Créditos do Netlify | Painel de uso do Netlify (*Usage & billing*, atualizado diariamente) e avisos do próprio Netlify (50%, 75%, 90%, 100%). O contador da API não acompanha em tempo real: zero na API **não** significa consumo nulo | Mensal, e depois de cada rodada de testes ou publicação |

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

## 7. Hospedagem de testes: Netlify Free 🔧 (A1, D-087)

### Configuração (08/11/2026)

| Item | Configuração |
|---|---|
| Site | `crm-estrategico-es-em-acao-testes`, na equipe do gestor, plano Free (créditos): https://crm-estrategico-es-em-acao-testes.netlify.app |
| Visibilidade | **Pública**, produção e prévias (D-087). O plano Free oferece uma única opção para o site, e a privada exige conta Netlify do dono da equipe. A proteção é o login e as permissões do CRM, com as regras de acesso do banco (RLS) |
| Repositório | Integração nativa do Netlify com o GitHub, autorizada pelo gestor só para este repositório |
| Publicações | Produção pelo ramo `hospedagem-producao`; publicação de ramo só para `hospedagem-previa`; prévias de Pull Requests desligadas; a `main` e os demais ramos não publicam. Duas barreiras: a lista de ramos permitidos no Netlify e a regra `ignore` do `netlify.toml` |
| Credenciais | Só as quatro variáveis da aplicação, gravadas por `npm run hospedagem:credenciais -- --site=<identificador>`, que confere antes o projeto autorizado, a marca de banco descartável e o papel restrito `crm_app`; as duas do servidor ficam marcadas como secretas. O plano Free não restringe escopos: os segredos ficam disponíveis também na compilação, que não os usa (compilação aprovada sem eles). **Nunca** vão para o Netlify: a conexão administrativa, a do monitor, as chaves das cópias e qualquer credencial administrativa |
| Servidor | Adaptador Next.js 5.16.6: uma função do servidor (Node 24, 1 GB, Ohio, us-east-2) e uma Edge Function (o proxy, que leva ao login); banco em São Paulo |
| Contas | Autocadastro público desligado no Supabase (conferido por `npm run ambiente:conferir`); contas só pelo administrador do CRM, com troca obrigatória da senha provisória (P-056) |

**Como publicar uma alteração aprovada:** depois do merge na `main` pelo gestor, testar antes, se útil, no ramo `hospedagem-previa` (publicação de ramo, sem custo de publicação) e então levar o mesmo commit ao ramo `hospedagem-producao` (15 créditos por publicação). Alterações só de documentação não precisam ser publicadas.

### Testes anteriores, sem conta

| Teste | Resultado |
|---|---|
| Ferramenta oficial no Windows (`netlify build --offline`, adaptador 5.16.6) | Next.js e funções compilam; o empacotamento do proxy como Edge Function falha por erro de caminhos do Windows na ferramenta (com Turbopack e com webpack). Não conclusivo: o Netlify compila em Linux |
| Mesma compilação em Linux (GitHub Actions, sem conta e sem segredos) | Aprovada em 07/11/2026 (execução de 1f4c1c0): compilação com o adaptador 5.16.6, funções do servidor e Edge Function do proxy geradas; no servidor local do Netlify, /login com HTTP 200 e /paineis sem sessão levado ao login pelo proxy |

Vercel Hobby fica excluído para uso institucional (termos restritos a uso pessoal e não comercial).

### Resultados no endereço público (08/11/2026, commit `038945d`)

| Teste | Resultado |
|---|---|
| Publicações | 2 em produção, ambas prontas (`24ddd49`, 61 s de compilação; `038945d`, 40 s), nenhuma de ramo ou de Pull Request. Adaptador Next.js 5.16.6, uma função do servidor e uma Edge Function |
| T8 — segurança | 24 conferências aprovadas: HTTP levado a HTTPS; cabeçalhos de segurança; telas, relatórios e arquivos sem sessão levados ao login; `/saude` sem dados; erro sem detalhes técnicos; 12 arquivos do navegador sem segredos e sem mapas do código-fonte; cookie da sessão `Secure`, `HttpOnly` e `SameSite=Lax`; chave pública sem leitura de dados. A primeira rodada apontou o cookie sem `Secure`; corrigido no commit `038945d` e conferido de novo |
| T2 — testes reais (`test:supabase`, com os testes de navegador apontados ao endereço público) | 159 de 159 aprovados em 18,5 min: autenticação, regras de acesso, painéis e exportações por perfil, monitor, credenciais e 41 cenários de navegador nos quatro perfis |
| T3 — desempenho | Ver abaixo: funcional, mas lento; **não homologado** para uso pelos colegas |
| T4 — créditos | Ver abaixo: leitura no painel pendente |

**T3: tempos por tela** (10 rodadas; a 1ª rodada à parte; nas demais, 9 observações por tela; o p95 é exploratório e, com 9 observações, coincide com o máximo):

| Tela | Local: mediana | Netlify: 1º byte, mediana | Netlify: tela completa, mediana [mín.–máx.] | Netlify: 1ª rodada |
|---|---|---|---|---|
| Visão executiva | 1,6 s | 0,6 s | 8,4 s [8,3–8,9] | 8,2 s |
| Painel do projeto | 1,9 s | 0,3 s | 8,1 s [7,9–8,4] | 9,2 s |
| Relatórios | 1,7 s | 0,3 s | 8,7 s [8,7–9,9] | 8,8 s |
| Matriz de stakeholders | 0,9 s | 0,3 s | 6,1 s [4,7–7,4] | 7,3 s |
| Projeto ou tema | 1,7 s | 0,3 s | 9,4 s [8,8–11,1] | 9,4 s |
| Pessoas | 0,7 s | 0,3 s | 4,3 s [2,8–5,0] | 4,4 s |
| Instituições | 0,4 s | 0,3 s | 2,5 s [2,0–5,2] | 4,3 s |
| Interações | 0,7 s | 0,3 s | 3,3 s [3,3–6,8] | 6,8 s |
| Iniciativas | 1,2 s | 0,3 s | 3,9 s [3,7–4,4] | 3,9 s |
| Planos de ação | 0,7 s | 0,3 s | 3,3 s [3,0–3,5] | 3,6 s |
| Riscos | 1,0 s | 0,3 s | 4,1 s [4,1–6,8] | 4,1 s |
| Usuários | 0,7 s | 0,3 s | 3,5 s [3,3–3,7] | 3,6 s |
| R1 a R5 em XLSX | 1,7 a 2,1 s | — | 9,3 a 9,7 s [9,0–11,5] | 9,1 a 9,5 s |
| Entrada (login até o painel, uma medida) | 3,3 s | — | 12,3 s | — |

O primeiro byte chega em cerca de 0,3 s (a estrutura da tela aparece logo, com "Carregando"); a demora está no preenchimento dos dados. A 1ª rodada não difere muito das demais (funções "frias" não são a causa principal), salvo Instituições e Interações.

**Medido x hipótese.** Medido: arquivo estático pela CDN, 27 ms (local, 4 ms); `/saude`, que faz uma única consulta sem tabelas, 905 ms (local, 133 ms); comandos do banco por tela, pelas estatísticas do PostgreSQL (`npm run hospedagem:consultas`, comparação antes e depois de cada carregamento, sem reiniciar as estatísticas):

| Tela | Comandos | Transações | Consultas do CRM | Conexões novas | Tempo no banco | Tela completa |
|---|---|---|---|---|---|---|
| Visão executiva | 36 | 2 | 29 | 0 a 1 | 0,16 s | 8,1 s |
| Painel do projeto | 36 | 2 | 29 | 0 | 0,15 s | 8,0 s |
| Projeto ou tema | 104 | 26 | 25 | 0 a 4 | 0,17 s | 8,8 s |
| Matriz de stakeholders | 39 | 9 | 8 | 0 a 4 | 0,01 s | 7,1 s |
| Pessoas | 14 | 3 | 2 | 0 a 2 | 0,04 s | 4,3 s |
| Planos de ação | 18 | 4 | 3 | 0 a 2 | 0,18 s | 5,6 s |
| R1 em XLSX | 44 | 4 | 30 | 0 | 0,15 s | 9,3 s |

O banco gasta no máximo 0,18 s por tela; nenhuma consulta do CRM se repete no mesmo carregamento (sem padrão N+1 de comandos iguais). Teste local controlado, só leitura e sem tabelas, pela mesma conexão da aplicação: uma ida e volta, 29 ms; transação com identidade, 90 ms; 10 consultas **com parâmetros** numa transação, cerca de 650 ms **tanto em série quanto em paralelo**; 10 consultas **sem parâmetros** em paralelo, 91 ms. Logo, nesta configuração (driver `postgres` sem consultas preparadas, exigência do pooler de transações), cada consulta com parâmetros custa duas idas e voltas e não se sobrepõe às outras, mesmo quando o código as dispara em paralelo, como já faz o painel.

Hipótese, coerente com as medidas mas não comprovada por instrumentação na função: o tempo das telas é dominado pelo número de idas e voltas em série ao banco, cada uma de cerca de 0,16 s entre Ohio e São Paulo; somam-se a abertura de conexões novas (0 a 4 por carregamento, cada uma com várias idas e voltas) e o processamento da função e do navegador, não separados por esta medição.

**T4: créditos.** Confirmado no painel do Netlify: **ainda não lido** (o painel atualiza diariamente e exige login do gestor). Pela API, o contador da conta mostrava 0 de 300, o que **não** comprova consumo nulo, porque não acompanha em tempo real. Conferido pela API: plano Free de créditos, sem recarga automática, sem forma de pagamento cadastrada, sem avaliação de plano pago e com compilações bloqueadas ao esgotar. Estimativa, não confirmada: 2 publicações em produção (30 créditos, pela tabela do Netlify) mais cerca de 660 carregamentos de telas e relatórios nos testes (processamento, requisições e transferência, entre 15 e 35 créditos): **de 45 a 65 créditos**, de 15% a 22% do mês. No desempenho atual, cada tela mantém a função ativa por vários segundos; 1 crédito corresponde a algo como 45 a 50 carregamentos, o que comporta uma homologação pequena, mas exige reavaliação antes de uso regular.

### Desempenho depois da P-071 (prévia, 08/11/2026, D-088)

Medido no mesmo horário que a produção (código original), com as mesmas contas e dados fictícios:

| Tela | Produção atual | Prévia otimizada |
|---|---|---|
| Visão executiva | 7,3 s | 3,35 s |
| Painel do projeto | 7,2 s | 3,2 s |
| Página de relatórios | 7,8 s | 3,3 s |
| R1 e R5 em XLSX | 8,3 e 8,6 s | 3,3 e 3,4 s |
| Projeto ou tema | 9,3 s | 5,1 s; com ociosidade de 60 s, 3,3 s depois de pausas de 5 s e 3,9 s depois de 30 s |

Depois de pausas longas (90 s ou mais), a função do Netlify esfria e as conexões são reabertas qualquer que seja a ociosidade (6,9 a 8 s na primeira tela). **Ociosidade das conexões:** `CRM_BANCO_OCIOSIDADE_S` (inteiro de 1 a 600; sem ela, 20 s) ajusta só o pool da aplicação; 60 s aceitos na prévia (contexto `branch-deploy`). A produção só a recebe na publicação aprovada pelo gestor.

Ferramentas (somente leitura, salvo onde indicado; contas fictícias): `hospedagem:laboratorio` (servidor local com a distância até o banco simulada, sem deploy), `hospedagem:consultas` (comandos, transações e decomposição do tempo por tela), `hospedagem:equivalencia` e `hospedagem:equivalencia-paineis` (páginas e R1 a R5 comparados célula a célula entre versões, para oito contas), `hospedagem:concorrencia` (grava e arquiva uma iniciativa fictícia durante downloads do R1) e `hospedagem:reuso` (conexões depois de intervalos sem uso).

### Publicação em produção e reversão

**Sequência (depende de aprovação final do gestor):** (1) merge do Pull Request da Etapa 7B na `main`; (2) troca da base do Pull Request da P-071 para a `main`, conferência do GitHub Actions e merge; (3) `CRM_BANCO_OCIOSIDADE_S=60` também no contexto de produção; (4) o mesmo commit da `main` levado ao ramo `hospedagem-producao` (15 créditos); (5) conferências: segurança (T8), equivalência com a prévia, tempos e avaliação pessoal do gestor.

**Reversão para a versão atual (`038945d`, publicação `6af0002`), sem custo de publicação:** no painel do Netlify, *Deploys* › publicação `6af0002` › **Publish deploy**, e **Lock to stop auto publishing** até a correção; remover `CRM_BANCO_OCIOSIDADE_S` do contexto de produção. No Git, sem reescrever o histórico: reverter os merges por Pull Request e só então destravar a publicação automática.

### Contas individuais de teste para os colegas (só depois da liberação pelo gestor)

O banco de desenvolvimento é descartável e só pode ter dados fictícios (D-077): **as contas usam pseudônimo e e-mail fictício**. As proteções do projeto recusam contas fora dos domínios fictícios (`.example.com`, `.invalid`, `.test`), e uma conta com e-mail real faria a rotina diária de cópias e os comandos de manutenção pararem. O e-mail serve só para entrar: o CRM não envia mensagens.

1. O gestor entra no CRM com uma conta de **administrador** (nunca repassada a terceiros).
2. **Usuários e permissões › Novo usuário:** nome `Homologador 01` (02, 03…), e-mail `homologador01@homologacao.crm-es-em-acao.example.com`; **não** marcar "administrador do sistema"; salvar.
3. Copiar a **senha provisória**, mostrada uma única vez, e repassá-la ao colega por canal individual (pessoalmente ou mensagem direta), nunca em grupo ou lista de e-mail.
4. Na página da conta, **Conceder permissão:** um projeto fictício, o perfil do teste (Gestor, Colaborador ou Leitor) e **Válida até** a data de encerramento da homologação.
5. A correspondência entre pseudônimo e pessoa fica só com o gestor, fora do CRM e do repositório.
6. No primeiro acesso, o colega troca a senha provisória (P-056). Ao fim da homologação, o gestor **suspende** ou exclui a conta.

### Roteiro de homologação para os colegas

Regra para todos: registrar **somente informações fictícias**, nunca nomes, cargos ou dados reais de stakeholders.

1. **Acesso:** abrir o endereço, entrar com o e-mail e a senha provisória, criar a senha nova, sair e entrar de novo com ela.
2. **Navegação:** Painéis (visão executiva e painel do projeto), página do projeto, matriz de stakeholders, Pessoas, Instituições, Interações, Iniciativas, Planos e Riscos.
3. **Conforme o perfil:** Leitor, só consulta (não deve haver botões de inclusão nem formulários); Colaborador, registrar e alterar uma interação e uma iniciativa fictícias; Gestor, também decidir sobre uma versão do plano.
4. **Relatórios:** baixar R1 a R5 (perfis com exportação) e abri-los no Microsoft Excel, conferindo leitura e apresentação.
5. **Isolamento:** confirmar que só aparecem dados do projeto concedido.
6. **Celular:** repetir a entrada e a navegação principal no celular.
7. **Registro:** anotar o que funcionou, erros (com captura de tela), lentidão (tela e tempo aproximado) e sugestões, num formulário ou planilha do gestor, fora do repositório.

## 8. Conta pessoal: consequências ⏳ (D-082)

| Tema | Consequência enquanto o projeto estiver na conta pessoal |
|---|---|
| Continuidade | Depende de uma pessoa; indisponibilidade ou perda de acesso dela interrompe reativações, cópias e configurações |
| Recuperação de acesso | Depende da recuperação da conta pessoal (e-mail e códigos de recuperação) |
| Autenticação multifator | Deve estar ligada no GitHub, no Supabase, no Google e, se criado, no Netlify, com códigos de recuperação guardados fora do computador |
| Guarda de credenciais | Senhas e segredos do monitor ficam sob responsabilidade pessoal. A chave privada das cópias fica só no arquivo local do computador de desenvolvimento, sem gerenciador de senhas (D-086); segunda cópia segura pendente antes de dados reais |
| Responsabilidade sobre os dados | Termos dos fornecedores aceitos pela pessoa, e não pela instituição. Antes de uso institucional real, é preciso solução aceita pela instituição para continuidade administrativa e proteção de dados; o plano gratuito não resolve isso |
