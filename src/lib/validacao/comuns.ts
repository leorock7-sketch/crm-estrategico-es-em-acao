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

/** E-mail opcional: campo vazio é tratado como ausente; se preenchido, deve ser válido. */
export const esquemaEmailOpcional = z.preprocess(
  (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
  z.email({ error: "E-mail inválido." }).optional(),
);
