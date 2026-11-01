# Componentes reutilizáveis

Peças visuais usadas em mais de uma tela: botões, selos, tabelas, campos de formulário, cartões etc.

- Um componente por arquivo, com nome em letras minúsculas separadas por hífen (por exemplo, `selo-situacao.tsx`).
- Componentes desta pasta **não** contêm regras de negócio nem acessam o banco de dados: recebem os dados prontos.
- Componentes específicos de um único módulo ficam dentro da pasta desse módulo, em `src/modulos/`.

Componente existente: `selo-situacao.tsx`, usado na página inicial.
