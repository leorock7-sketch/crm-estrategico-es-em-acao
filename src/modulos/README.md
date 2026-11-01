# Módulos de negócio

Cada módulo do CRM terá sua própria pasta aqui, reunindo regras de negócio, validações específicas, consultas ao banco e componentes exclusivos do módulo. **Nenhum módulo foi implementado na Etapa 0.**

| Pasta prevista | Módulo | Documentação |
|---|---|---|
| `stakeholders/` | Cadastro Mestre: pessoas, instituições e vínculos | [MODELO_DADOS.md](../../docs/MODELO_DADOS.md) |
| `projetos-temas/` | Comitês, projetos e temas estratégicos | [MODELO_DADOS.md](../../docs/MODELO_DADOS.md) |
| `avaliacoes/` | Avaliações de stakeholders e matriz de poder × interesse | [METODOLOGIA_STAKEHOLDERS.md](../../docs/METODOLOGIA_STAKEHOLDERS.md) |
| `iniciativas/` | Matriz de Iniciativas | [MATRIZ_INICIATIVAS.md](../../docs/MATRIZ_INICIATIVAS.md) |
| `interacoes/` | Interações, agenda e compromissos | [MODELO_DADOS.md](../../docs/MODELO_DADOS.md) |
| `plano-acao/` | Plano de Ação | [PLANO_ACAO.md](../../docs/PLANO_ACAO.md) |
| `riscos/` | Matriz de Riscos | [MATRIZ_RISCOS.md](../../docs/MATRIZ_RISCOS.md) |
| `paineis/` | Painéis e relatórios gerenciais | [REQUISITOS.md](../../docs/REQUISITOS.md) |
| `acesso/` | Usuários e permissões por projeto ou tema | [GOVERNANCA.md](../../docs/GOVERNANCA.md) |

Organização interna sugerida para cada módulo 🔧:

```
modulos/<modulo>/
├── esquemas.ts      regras de validação (Zod) específicas do módulo
├── consultas.ts     leitura e gravação no banco de dados
├── acoes.ts         operações chamadas pelas telas (Server Actions)
└── componentes/     componentes visuais exclusivos do módulo
```
