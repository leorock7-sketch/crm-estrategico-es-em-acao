/**
 * Transforma os registros da trilha de auditoria em descrições legíveis:
 * quais campos mudaram, com o valor anterior e o novo.
 */
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import { formatarCnpj } from "@/lib/validacao/cnpj";
import { ROTULOS_CAMPOS, ROTULOS_ESFERA, ROTULOS_NATUREZA } from "./rotulos";

type Dados = Record<string, unknown> | null;

export type Alteracao = {
  campo: string;
  rotulo: string;
  antes: string;
  depois: string;
};

/** Campos técnicos que não interessam ao leitor do histórico. */
const CAMPOS_OCULTOS = new Set([
  "id",
  "tipo_stakeholder",
  "nome_normalizado",
  "criado_em",
  "criado_por",
  "atualizado_em",
  "atualizado_por",
]);

const CAMPOS_DE_DATA = new Set(["data_inicio", "data_fim"]);

/**
 * Converte um valor gravado em texto de exibição. Identificadores de pessoas
 * e instituições são trocados pelos nomes, quando conhecidos.
 */
export function formatarValor(campo: string, valor: unknown, nomes: Map<string, string>): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  const texto = String(valor);
  if (campo.endsWith("_id")) return nomes.get(texto) ?? "registro não identificado";
  if (CAMPOS_DE_DATA.has(campo)) return formatarData(texto);
  if (campo === "arquivado_em") return formatarDataHora(texto);
  if (campo === "cnpj") return formatarCnpj(texto);
  if (campo === "natureza") return ROTULOS_NATUREZA[texto as keyof typeof ROTULOS_NATUREZA] ?? texto;
  if (campo === "esfera") return ROTULOS_ESFERA[texto as keyof typeof ROTULOS_ESFERA] ?? texto;
  return texto;
}

/** Campos que mudaram entre duas versões de um registro. */
export function alteracoesEntre(
  antes: Dados,
  depois: Dados,
  nomes: Map<string, string> = new Map(),
): Alteracao[] {
  const campos = new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]);
  const alteracoes: Alteracao[] = [];
  for (const campo of campos) {
    if (CAMPOS_OCULTOS.has(campo)) continue;
    const valorAntes = antes?.[campo] ?? null;
    const valorDepois = depois?.[campo] ?? null;
    if (JSON.stringify(valorAntes) === JSON.stringify(valorDepois)) continue;
    alteracoes.push({
      campo,
      rotulo: ROTULOS_CAMPOS[campo] ?? campo,
      antes: formatarValor(campo, valorAntes, nomes),
      depois: formatarValor(campo, valorDepois, nomes),
    });
  }
  return alteracoes;
}
