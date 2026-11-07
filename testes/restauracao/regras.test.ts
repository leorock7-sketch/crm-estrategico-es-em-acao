/**
 * Segunda etapa do ensaio de restauração (C7, D-082): o conjunto completo das regras de acesso no banco
 * restaurado, pelo papel crm_app. Comprova que regras, funções, permissões e gatilhos voltaram
 * funcionando. Grava dados fictícios só neste banco temporário, por isso roda depois da conferência
 * (conferencia.test.ts). Só roda pelo comando npm run backup:ensaiar.
 */
import { afterAll, beforeAll } from "vitest";
import { abrirBancoPostgres, type Banco, fecharBanco } from "@/lib/banco/conexao";
import { regrasDeAcesso } from "../apoio/regras-acesso";

let administrativo: Banco;
let aplicacao: Banco;

beforeAll(() => {
  administrativo = abrirBancoPostgres(process.env.CRM_RESTAURACAO_ADMIN_URL as string, { max: 2, ssl: false });
  aplicacao = abrirBancoPostgres(process.env.CRM_RESTAURACAO_APP_URL as string, { max: 3, ssl: false });
});

afterAll(async () => {
  await fecharBanco(administrativo);
  await fecharBanco(aplicacao);
});

regrasDeAcesso(() => ({ administrativo, aplicacao }));
