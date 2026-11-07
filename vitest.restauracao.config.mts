import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Testes do ensaio de restauração (C7, D-082). Rodam só por npm run backup:ensaiar, que cria o banco
 * temporário isolado e informa as conexões pelas variáveis CRM_RESTAURACAO_*.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./testes/apoio/vazio.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["testes/restauracao/**/*.test.ts"],
    sequence: { concurrent: false },
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
