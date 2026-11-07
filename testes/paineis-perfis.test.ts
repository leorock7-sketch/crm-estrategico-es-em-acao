// @vitest-environment node
/**
 * Painéis e exportações por perfil (D-079), no PGlite: roda a cada Pull Request. As mesmas regras
 * rodam no PostgreSQL do Supabase em supabase/paineis.test.ts.
 */
import { afterAll, beforeAll } from "vitest";
import { abrirBanco, type Banco, fecharBanco } from "@/lib/banco/conexao";
import { regrasDosPaineis } from "./apoio/regras-paineis";

let banco: Banco;

beforeAll(async () => {
  banco = await abrirBanco();
});

afterAll(async () => {
  await fecharBanco(banco);
});

regrasDosPaineis(() => ({ administrativo: banco, aplicacao: banco }));
