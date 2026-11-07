import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Reconhece o atalho "@/" definido em tsconfig.json.
    tsconfigPaths: true,
    // O pacote server-only falha fora do Next.js de propósito; nos testes, não tem efeito.
    alias: { "server-only": fileURLToPath(new URL("./testes/apoio/vazio.ts", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["testes/**/*.test.{ts,tsx}"],
    // Exigem as chaves locais do projeto Supabase: rodam com npm run test:supabase.
    // O ensaio de restauração roda só com npm run backup:ensaiar, num banco temporário isolado.
    exclude: ["testes/supabase/**", "testes/restauracao/**"],
    // Os testes de banco rodam em paralelo, cada um com um PostgreSQL próprio, e podem
    // demorar quando o computador está com pouca memória livre. Estes limites valem só
    // para o tempo de espera; não mudam o que cada teste confere.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
