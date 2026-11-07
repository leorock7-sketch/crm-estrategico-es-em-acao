import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * C8: os testes de banco das Etapas 1 a 4, sem alteração, no PostgreSQL real do projeto Supabase
 * de desenvolvimento. APAGA os dados do projeto antes de cada arquivo; por isso, só roda no banco
 * identificado como descartável e com a frase no próprio comando (scripts/protecao-destrutiva.ts):
 * CRM_CONFIRMAR_EXCLUSAO="APAGAR DADOS FICTICIOS DE <identificador>" npm run test:postgres
 * Depois, refaça a carga com supabase:preparar --refazer. Não roda no GitHub Actions: exige as chaves.
 * Não executar sem necessidade e autorização específica do gestor (D-077).
 */
const { CRM_BANCO_ADMIN_URL, NEXT_PUBLIC_SUPABASE_URL, CRM_BANCO_DESCARTAVEL_REF } = loadEnv("development", process.cwd(), "");

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      { find: "server-only", replacement: fileURLToPath(new URL("./testes/apoio/vazio.ts", import.meta.url)) },
      { find: /^@\/lib\/banco\/conexao$/, replacement: fileURLToPath(new URL("./testes/apoio/conexao-postgres-real.ts", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    // Sem as demais variáveis, nada aqui imita a aplicação em uso. A confirmação vem só do próprio
    // comando: um valor gravado em .env.local não é lido.
    env: {
      CRM_BANCO_ADMIN_URL,
      NEXT_PUBLIC_SUPABASE_URL,
      CRM_BANCO_DESCARTAVEL_REF,
      CRM_CONFIRMAR_EXCLUSAO: process.env.CRM_CONFIRMAR_EXCLUSAO ?? "",
    },
    include: [
      "testes/banco-cadastro-mestre.test.ts",
      "testes/banco-projetos-temas.test.ts",
      "testes/banco-avaliacoes.test.ts",
      "testes/banco-iniciativas-interacoes.test.ts",
      "testes/banco-plano-acao-riscos.test.ts",
      "testes/permissoes.test.ts",
      "testes/normalizacao.test.ts",
    ],
    // Um arquivo por vez: todos usam o mesmo banco, refeito do zero.
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 600_000,
  },
});
