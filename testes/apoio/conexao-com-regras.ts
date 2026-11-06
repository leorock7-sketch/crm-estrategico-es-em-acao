/**
 * Requisitos 5 e 10 (D-074): os testes das Etapas 1 a 4, sem alteração, passando pelo caminho
 * real da aplicação. Nesta configuração (vitest.regras.config.mts), abrirBanco() devolve um banco
 * com identidade, no papel crm_app e sob as regras de acesso, como administrador do sistema. O que
 * funcionava sem as regras tem de continuar funcionando com elas.
 */
import {
  abrirBanco as abrirBancoSemRegras,
  type Banco,
  type OpcoesAbertura,
} from "../../src/lib/banco/conexao";
import { comIdentidade } from "../../src/lib/banco/identidade";
import { prepararBancoLocal, USUARIO_DESENVOLVIMENTO } from "../../src/modulos/acesso/usuario-atual";

export * from "../../src/lib/banco/conexao";

export async function abrirBanco(diretorio?: string, opcoes: OpcoesAbertura = {}): Promise<Banco> {
  const base = await abrirBancoSemRegras(diretorio, opcoes);
  if (diretorio) return base;
  await prepararBancoLocal(base);
  return comIdentidade(base, USUARIO_DESENVOLVIMENTO.id);
}
