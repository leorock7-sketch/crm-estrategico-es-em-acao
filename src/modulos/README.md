# Módulos de negócio

Cada módulo do CRM tem sua própria pasta, reunindo regras de negócio, validações específicas, consultas ao banco e componentes exclusivos do módulo.

| Pasta | Módulo | Situação | Documentação |
|---|---|---|---|
| `acesso/` | Usuários, permissões e visibilidade por projeto ou tema | Provisório: usuário fictício de desenvolvimento | [GOVERNANCA.md](../../docs/GOVERNANCA.md) |
| `stakeholders/` | Cadastro Mestre: pessoas, instituições, vínculos e contatos | Implementado na Etapa 1 | [MODELO_DADOS.md](../../docs/MODELO_DADOS.md) |
| `projetos-temas/` | Comitês (consulta), projetos e temas, comitês participantes e stakeholders dos contextos | Implementado na Etapa 1.1 | [MODELO_DADOS.md](../../docs/MODELO_DADOS.md) |
| `avaliacoes/` | Avaliações de stakeholders e matriz de poder × interesse | Etapas 2A e 2B: escalas V2.2, com metodologia fictícia (não homologada para uso institucional) | [METODOLOGIA_STAKEHOLDERS.md](../../docs/METODOLOGIA_STAKEHOLDERS.md) |
| `iniciativas/` | Matriz de Iniciativas: iniciativas, projetos e stakeholders envolvidos, histórico | Implementado na Etapa 3 (homologado para desenvolvimento, D-071) | [MATRIZ_INICIATIVAS.md](../../docs/MATRIZ_INICIATIVAS.md) |
| `interacoes/` | Interações (registro único), agenda, compromissos e acompanhamento | Implementado na Etapa 3 (homologado para desenvolvimento, D-071) | [MODELO_DADOS.md](../../docs/MODELO_DADOS.md) |
| `plano-acao/` | Plano de Ação | Previsto | [PLANO_ACAO.md](../../docs/PLANO_ACAO.md) |
| `riscos/` | Matriz de Riscos | Previsto | [MATRIZ_RISCOS.md](../../docs/MATRIZ_RISCOS.md) |
| `paineis/` | Painéis e relatórios gerenciais | Previsto | [REQUISITOS.md](../../docs/REQUISITOS.md) |

Organização interna de cada módulo, como em `stakeholders/`:

```
modulos/<modulo>/
├── esquemas.ts        regras de validação (Zod) do módulo
├── consultas.ts       leitura e gravação no banco de dados
├── acoes.ts           operações chamadas pelos formulários (Server Actions)
├── rotulos.ts         nomes de exibição das listas de valores
└── componentes/       componentes visuais exclusivos do módulo
```
