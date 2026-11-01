import { z } from "zod";
import {
  esquemaDataOpcional,
  esquemaIdentificador,
  textoObrigatorio,
  textoOpcional,
  vazioParaAusente,
} from "@/lib/validacao/comuns";
import { GRAUS_CONFIANCA, POSICIONAMENTOS, TIPOS_EVIDENCIA } from "./rotulos";

/** Campo de lista opcional: vazio significa "não informado" (no posicionamento, "não avaliado"). */
function listaOpcional<const T extends readonly [string, ...string[]]>(valores: T, mensagem: string) {
  return z.preprocess(vazioParaAusente, z.enum(valores, { error: mensagem }).optional());
}

/**
 * Rascunho da avaliação. As notas chegam como campos "nota_<id do critério>";
 * vazio significa "sem nota" (nunca zero). Justificativa e evidência só são
 * exigidas na publicação, pelo próprio banco de dados.
 */
export const esquemaRascunho = z.object({
  versaoId: esquemaIdentificador,
  posicionamento: listaOpcional(POSICIONAMENTOS, "Posicionamento inválido."),
  grauConfianca: listaOpcional(GRAUS_CONFIANCA, "Grau de confiança inválido."),
  justificativaConfianca: textoOpcional("Justificativa do grau de confiança", 1000),
  justificativa: textoOpcional("Justificativa", 4000),
  validacaoInstitucional: textoOpcional("Validação institucional", 1000),
  dataReferencia: esquemaDataOpcional,
});

export type DadosRascunho = z.infer<typeof esquemaRascunho>;

const PREFIXO_NOTA = "nota_";

/** Notas preenchidas no formulário: Map de id do critério → nota. Vazias ficam de fora. */
export function notasDoFormulario(valores: Record<string, string>): Map<string, number> {
  const notas = new Map<string, number>();
  for (const [campo, valor] of Object.entries(valores)) {
    if (!campo.startsWith(PREFIXO_NOTA) || valor.trim() === "") continue;
    const criterioId = esquemaIdentificador.parse(campo.slice(PREFIXO_NOTA.length));
    const nota = Number(valor.replace(",", "."));
    if (!Number.isFinite(nota)) throw new Error("Nota inválida.");
    notas.set(criterioId, nota);
  }
  return notas;
}

export function campoDaNota(criterioId: string) {
  return `${PREFIXO_NOTA}${criterioId}`;
}

export const esquemaEvidencia = z
  .object({
    versaoId: esquemaIdentificador,
    tipo: z.enum(TIPOS_EVIDENCIA, { error: "Selecione o tipo de evidência." }),
    descricao: textoObrigatorio("Descrição", 2000),
    fonte: textoOpcional("Fonte", 300),
    url: z.preprocess(
      vazioParaAusente,
      z
        .url({ protocol: /^https?$/, error: "Informe um endereço que comece com http:// ou https://." })
        .max(500, { error: "Endereço muito longo." })
        .optional(),
    ),
    dataEvidencia: esquemaDataOpcional,
  })
  .refine((dados) => dados.tipo !== "link" || dados.url, {
    error: "Informe o endereço do link.",
    path: ["url"],
  });

export type DadosEvidencia = z.infer<typeof esquemaEvidencia>;
