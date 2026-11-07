/**
 * Painéis e exportações por perfil (D-079), no PostgreSQL do Supabase: a aplicação conecta com o papel
 * crm_app, pela mesma conexão que usa de verdade, e a conexão administrativa só monta o cenário e confere
 * a origem dos números. Somente dados fictícios; nada é excluído.
 */
import { afterAll, beforeAll } from "vitest";
import { abrirBancoPostgres, type Banco, fecharBanco } from "@/lib/banco/conexao";
import { regrasDosPaineis } from "../apoio/regras-paineis";

let administrativo: Banco;
let aplicacao: Banco;

beforeAll(async () => {
  administrativo = abrirBancoPostgres(process.env.CRM_BANCO_ADMIN_URL as string, { max: 3 });
  aplicacao = abrirBancoPostgres(process.env.CRM_BANCO_URL as string, { max: 5 });
});

afterAll(async () => {
  await fecharBanco(administrativo);
  await fecharBanco(aplicacao);
});

regrasDosPaineis(() => ({ administrativo, aplicacao }));
