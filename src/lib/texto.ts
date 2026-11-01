/**
 * Texto para busca e comparação: sem acentos, em minúsculas e com espaços
 * simples. Regra única da aplicação (também aplicada aos registros já gravados,
 * ver lib/banco/normalizacao.ts): separa as letras de seus acentos (NFD),
 * remove só as marcas de acento e troca qualquer outro sinal por espaço —
 * assim "d'Água", "d´Água" e "d’Água" ficam iguais.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Protege os caracteres especiais de um termo usado em buscas com LIKE. */
export function escaparLike(termo: string): string {
  return termo.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}
