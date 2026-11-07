/**
 * Geração dos arquivos XLSX (D-079). O arquivo só traz o que está nas abas montadas em relatorios.ts:
 * nenhuma aba, linha ou coluna oculta, nenhum comentário e nenhuma fórmula. O texto digitado por
 * usuários é sempre gravado como texto e neutralizado, para não virar fórmula se o arquivo for
 * reeditado ou convertido para outro formato.
 */
import writeExcelFile from "write-excel-file/node";

export type Celula = string | number | null;

export type AbaRelatorio = { nome: string; cabecalho: string[]; linhas: Celula[][] };

export type ArquivoRelatorio = { nomeArquivo: string; abas: AbaRelatorio[] };

/** Retira caracteres que o formato não aceita e neutraliza início de fórmula (OWASP, CSV injection). */
export function neutralizarTexto(valor: string): string {
  const limpo = valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return /^[=+\-@\t\r]/.test(limpo) ? `'${limpo}` : limpo;
}

/**
 * Largura pelo conteúdo, para o texto longo não ficar espremido; títulos longos quebram em várias
 * linhas, sem alargar colunas de números.
 */
function larguraDaColuna(aba: AbaRelatorio, indice: number): number {
  const maiorValor = Math.max(0, ...aba.linhas.map((linha) => String(linha[indice] ?? "").length));
  const titulo = Math.min(aba.cabecalho[indice].length, 18);
  return Math.min(Math.max(Math.max(maiorValor, titulo) + 2, 10), 60);
}

function celula(valor: Celula) {
  if (typeof valor === "number") return { value: valor, type: Number };
  if (valor === null) return null;
  return { value: neutralizarTexto(valor), type: String, format: "@", wrap: true };
}

export async function gerarXlsx(arquivo: ArquivoRelatorio): Promise<Buffer> {
  const folhas = arquivo.abas.map((aba) => ({
    sheet: aba.nome,
    stickyRowsCount: 1,
    columns: aba.cabecalho.map((_, indice) => ({ width: larguraDaColuna(aba, indice) })),
    data: [
      aba.cabecalho.map((titulo) => ({ value: neutralizarTexto(titulo), type: String, fontWeight: "bold" as const, wrap: true })),
      ...aba.linhas.map((linha) => linha.map(celula)),
    ],
  }));
  return (await writeExcelFile(folhas as never).toBuffer()) as Buffer;
}
