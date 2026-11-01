# Componentes reutilizáveis

Peças visuais usadas em mais de uma tela.

| Arquivo | Componente |
|---|---|
| `alerta.tsx` | Mensagem destacada de erro, aviso ou sucesso |
| `cabecalho-pagina.tsx` | Título da página, link de retorno e botões de ação |
| `campo.tsx` | Rótulo, campo de formulário, ajuda e mensagem de erro |
| `carregando.tsx` | Indicação de carregamento |
| `estilos.ts` | Classes visuais padronizadas (botões, campos, tabelas, cartões) |
| `selo-situacao.tsx` | Selo de situação, por exemplo "Em desenvolvimento", "Arquivada" ou "Vigente" |

Regras:

- Um componente por arquivo, com nome em letras minúsculas separadas por hífen.
- Componentes desta pasta **não** contêm regras de negócio nem acessam o banco de dados: recebem os dados prontos.
- Componentes específicos de um único módulo ficam dentro da pasta desse módulo, em `src/modulos/`.
