/**
 * Leitura dos campos enviados por um formulário. Os campos indicados em
 * `listas` vêm de caixas de seleção múltipla e são lidos como listas; nos
 * valores devolvidos para reapresentar o formulário, viram texto separado por vírgulas.
 */
export function lerFormulario(formData: FormData, listas: readonly string[] = []) {
  const valores: Record<string, string> = {};
  const dados: Record<string, string | string[]> = {};
  for (const campo of new Set(formData.keys())) {
    if (campo.startsWith("$")) continue;
    if (listas.includes(campo)) {
      const itens = formData.getAll(campo).filter((v): v is string => typeof v === "string" && v !== "");
      dados[campo] = itens;
      valores[campo] = itens.join(",");
    } else {
      const valor = formData.get(campo);
      if (typeof valor === "string") {
        dados[campo] = valor;
        valores[campo] = valor;
      }
    }
  }
  for (const campo of listas) {
    if (!(campo in dados)) {
      dados[campo] = [];
      valores[campo] = "";
    }
  }
  return { valores, dados };
}
