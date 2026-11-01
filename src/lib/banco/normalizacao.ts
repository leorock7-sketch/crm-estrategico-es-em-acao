/**
 * Alinha os valores normalizados gravados no banco (usados na busca e na
 * identificação de duplicidades) à regra única da aplicação: normalizarTexto
 * para nomes e normalizarContato para contatos.
 *
 * Necessário porque scripts SQL de migração preencheram esses valores com uma
 * regra mais simples (a 0004 só aplicou minúsculas, sem tirar acentos nem
 * pontuação; a 0003 não removia a barra final de endereços). Executado ao abrir
 * o banco, depois das migrações: corrige bancos que já têm registros e mantém a
 * consistência se a regra mudar. Só altera o que difere; cada correção fica na
 * trilha de auditoria, sem usuário (como as cargas iniciais).
 */
import { eq } from "drizzle-orm";
import { normalizarTexto } from "@/lib/texto";
import { normalizarContato } from "@/modulos/stakeholders/contatos";
import type { Banco } from "./conexao";
import { contato, instituicao, pessoa, projetoTema } from "./esquema";

export type ResultadoAlinhamento = {
  projetosTemas: number;
  pessoas: number;
  instituicoes: number;
  contatos: number;
};

export async function alinharValoresNormalizados(banco: Banco): Promise<ResultadoAlinhamento> {
  const [projetos, pessoas, instituicoes, contatos] = await Promise.all([
    banco.select({ id: projetoTema.id, origem: projetoTema.nome, gravado: projetoTema.nomeNormalizado }).from(projetoTema),
    banco.select({ id: pessoa.id, origem: pessoa.nomeCompleto, gravado: pessoa.nomeNormalizado }).from(pessoa),
    banco.select({ id: instituicao.id, origem: instituicao.nome, gravado: instituicao.nomeNormalizado }).from(instituicao),
    banco
      .select({ id: contato.id, tipo: contato.tipo, origem: contato.valor, gravado: contato.valorNormalizado })
      .from(contato),
  ]);

  const divergentes = <T extends { origem: string; gravado: string }>(linhas: T[], regra: (linha: T) => string) =>
    linhas.map((linha) => ({ ...linha, correto: regra(linha) })).filter((linha) => linha.correto !== linha.gravado);

  const correcoes = {
    projetosTemas: divergentes(projetos, (p) => normalizarTexto(p.origem)),
    pessoas: divergentes(pessoas, (p) => normalizarTexto(p.origem)),
    instituicoes: divergentes(instituicoes, (i) => normalizarTexto(i.origem)),
    contatos: divergentes(contatos, (c) => normalizarContato(c.tipo, c.origem)),
  };
  const total = Object.values(correcoes).reduce((soma, lista) => soma + lista.length, 0);
  if (total > 0) {
    await banco.transaction(async (tx) => {
      for (const p of correcoes.projetosTemas) {
        await tx.update(projetoTema).set({ nomeNormalizado: p.correto }).where(eq(projetoTema.id, p.id));
      }
      for (const p of correcoes.pessoas) {
        await tx.update(pessoa).set({ nomeNormalizado: p.correto }).where(eq(pessoa.id, p.id));
      }
      for (const i of correcoes.instituicoes) {
        await tx.update(instituicao).set({ nomeNormalizado: i.correto }).where(eq(instituicao.id, i.id));
      }
      for (const c of correcoes.contatos) {
        await tx.update(contato).set({ valorNormalizado: c.correto }).where(eq(contato.id, c.id));
      }
    });
    console.info(`Banco: ${total} valor(es) normalizado(s) realinhado(s) à regra da aplicação.`);
  }
  return {
    projetosTemas: correcoes.projetosTemas.length,
    pessoas: correcoes.pessoas.length,
    instituicoes: correcoes.instituicoes.length,
    contatos: correcoes.contatos.length,
  };
}
