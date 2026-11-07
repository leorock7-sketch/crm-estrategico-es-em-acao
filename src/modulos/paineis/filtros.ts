/**
 * Filtros dos painéis e dos relatórios (D-079), lidos do endereço da página. Valor inválido é
 * ignorado: o filtro nunca amplia o que o usuário vê, porque as regras de acesso valem em todas
 * as consultas, qualquer que seja o identificador informado.
 */
import { z } from "zod";

export type FiltrosPainel = {
  comiteId?: string;
  projetoTemaId?: string;
  /** Início e fim do período, no formato AAAA-MM-DD. */
  de?: string;
  ate?: string;
  responsavelId?: string;
};

type Parametros = Record<string, string | string[] | undefined>;

const identificador = z.uuid();
const data = z.iso.date();

function texto(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

export function lerFiltros(parametros: Parametros): { filtros: FiltrosPainel; periodoInvertido: boolean } {
  const comiteId = identificador.safeParse(texto(parametros.comite)).data;
  const projetoTemaId = identificador.safeParse(texto(parametros.projeto)).data;
  const responsavelId = identificador.safeParse(texto(parametros.responsavel)).data;
  const de = data.safeParse(texto(parametros.de)).data;
  const ate = data.safeParse(texto(parametros.ate)).data;
  const periodoInvertido = Boolean(de && ate && de > ate);
  return {
    filtros: {
      comiteId,
      projetoTemaId,
      responsavelId,
      de: periodoInvertido ? undefined : de,
      ate: periodoInvertido ? undefined : ate,
    },
    periodoInvertido,
  };
}

export function parametrosDosFiltros(filtros: FiltrosPainel): string {
  const parametros = new URLSearchParams();
  if (filtros.comiteId) parametros.set("comite", filtros.comiteId);
  if (filtros.projetoTemaId) parametros.set("projeto", filtros.projetoTemaId);
  if (filtros.de) parametros.set("de", filtros.de);
  if (filtros.ate) parametros.set("ate", filtros.ate);
  if (filtros.responsavelId) parametros.set("responsavel", filtros.responsavelId);
  const texto = parametros.toString();
  return texto ? `?${texto}` : "";
}

/** A data está no período? Sem período, toda data registrada conta; sem data, nunca conta. */
export function dentroDoPeriodo(valor: string | null | undefined, filtros: Pick<FiltrosPainel, "de" | "ate">): boolean {
  if (!valor) return false;
  if (filtros.de && valor < filtros.de) return false;
  if (filtros.ate && valor > filtros.ate) return false;
  return true;
}
