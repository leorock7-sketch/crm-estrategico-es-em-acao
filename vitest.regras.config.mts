import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Os testes de banco das Etapas 1 a 4, sem alteração, no papel crm_app e sob as regras de acesso
 * (npm run test:regras). Roda sem segredos, no PGlite: pode rodar a cada Pull Request.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      { find: "server-only", replacement: fileURLToPath(new URL("./testes/apoio/vazio.ts", import.meta.url)) },
      { find: /^@\/lib\/banco\/conexao$/, replacement: fileURLToPath(new URL("./testes/apoio/conexao-com-regras.ts", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: [
      "testes/banco-cadastro-mestre.test.ts",
      "testes/banco-projetos-temas.test.ts",
      "testes/banco-avaliacoes.test.ts",
      "testes/banco-iniciativas-interacoes.test.ts",
      "testes/banco-plano-acao-riscos.test.ts",
    ],
    // Ficam de fora só os testes que tentam, por comando direto, o que o papel crm_app nem chega
    // a poder fazer: excluir registros (42501, antes do gatilho cuja mensagem o teste confere) e
    // trocar o tipo do stakeholder (nenhuma linha alcançada). Eles continuam na configuração
    // principal. O último confere transação sem identidade, que este caminho não permite. O quadro em
    // testes/README.md mostra, para cada um, o que comprova a restrição pelo papel crm_app.
    testNamePattern:
      /^(?!.*(não permite excluir|proibição de excluir|o tipo do stakeholder não pode ser trocado|versão aprovada não muda|versão publicada não pode ser alterada|somente dentro da transação)).*$/,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
