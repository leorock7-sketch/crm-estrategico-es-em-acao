import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Autenticação real, regras de acesso no PostgreSQL do Supabase e navegador (npm run test:supabase).
 * Usa as chaves de .env.local e as contas de .dados/contas-teste.json: roda neste computador, não
 * no GitHub Actions. Prepare antes com npm run supabase:preparar. Somente dados fictícios.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./testes/apoio/vazio.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    env: loadEnv("development", process.cwd(), ""),
    include: ["testes/supabase/**/*.test.ts"],
    // Um arquivo por vez: compartilham o mesmo projeto e as mesmas contas.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});
