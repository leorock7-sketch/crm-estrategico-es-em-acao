import { z } from "zod";

/** Identificador único (UUID), usado como chave primária em todas as tabelas. */
export const esquemaIdentificador = z.uuid({ error: "Identificador inválido." });

/** Texto obrigatório: remove espaços nas pontas e exige ao menos um caractere. */
export function textoObrigatorio(nomeCampo: string, tamanhoMaximo = 255) {
  return z
    .string({ error: `${nomeCampo} é obrigatório.` })
    .trim()
    .min(1, { error: `${nomeCampo} é obrigatório.` })
    .max(tamanhoMaximo, {
      error: `${nomeCampo} deve ter no máximo ${tamanhoMaximo} caracteres.`,
    });
}

/** Converte campo de formulário vazio (ou só com espaços) em "ausente". */
export function vazioParaAusente(valor: unknown) {
  return typeof valor === "string" && valor.trim() === "" ? undefined : valor;
}

/** Texto opcional: campo vazio é tratado como ausente; se preenchido, respeita o tamanho máximo. */
export function textoOpcional(nomeCampo: string, tamanhoMaximo = 255) {
  return z.preprocess(
    vazioParaAusente,
    z
      .string()
      .trim()
      .max(tamanhoMaximo, {
        error: `${nomeCampo} deve ter no máximo ${tamanhoMaximo} caracteres.`,
      })
      .optional(),
  );
}

/** E-mail opcional: campo vazio é tratado como ausente; se preenchido, deve ser válido. */
export const esquemaEmailOpcional = z.preprocess(
  vazioParaAusente,
  z.email({ error: "E-mail inválido." }).optional(),
);

/** Data opcional no formato do campo de data do navegador (AAAA-MM-DD). */
export const esquemaDataOpcional = z.preprocess(
  vazioParaAusente,
  z.iso.date({ error: "Data inválida." }).optional(),
);
