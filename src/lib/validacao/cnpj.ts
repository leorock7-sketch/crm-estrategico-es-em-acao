/**
 * CNPJ numérico ou alfanumérico. A partir de julho de 2026 a Receita Federal
 * passou a emitir CNPJs com letras nas 12 primeiras posições; os dois dígitos
 * verificadores continuam numéricos. No cálculo, cada caractere vale o seu
 * código ASCII menos 48 (assim, "0" a "9" valem 0 a 9 e "A" vale 17).
 */

/** Remove pontos, barra, hífen e espaços, e converte letras para maiúsculas. */
export function limparCnpj(valor: string): string {
  return valor.replace(/[.\-/\s]/g, "").toUpperCase();
}

function digitoVerificador(base: string): number {
  const pesos =
    base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = [...base].reduce(
    (total, caractere, posicao) => total + (caractere.charCodeAt(0) - 48) * pesos[posicao],
    0,
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(valor: string): boolean {
  const cnpj = limparCnpj(valor);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const primeiro = digitoVerificador(cnpj.slice(0, 12));
  const segundo = digitoVerificador(cnpj.slice(0, 12) + primeiro);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

/** Exibe o CNPJ no formato 00.000.000/0000-00. */
export function formatarCnpj(valor: string): string {
  const cnpj = limparCnpj(valor);
  if (cnpj.length !== 14) return valor;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
