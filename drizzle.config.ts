import { defineConfig } from "drizzle-kit";

// Gera os scripts de criação e alteração das tabelas (migrations) a partir de
// src/lib/banco/esquema.ts. Comando: npm run banco:gerar
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/banco/esquema.ts",
  out: "./src/lib/banco/migracoes",
});
