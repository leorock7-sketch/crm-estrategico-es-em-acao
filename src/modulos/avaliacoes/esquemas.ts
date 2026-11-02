import { z } from "zod";
import {
  esquemaDataOpcional,
  esquemaIdentificador,
  textoObrigatorio,
  textoOpcional,
  vazioParaAusente,
} from "@/lib/validacao/comuns";
import {
  type EscalaPoderInteresse,
  type EscalaPosicionamento,
  GRAUS_CONFIANCA,
  NATUREZAS_POSICIONAMENTO,
  NIVEIS,
  POSICIONAMENTOS,
  POSICIONAMENTOS_VIGENTES,
  SITUACOES_RESSALVAS,
  TIPOS_EVIDENCIA,
} from "./rotulos";

/** Campo de lista opcional: vazio significa "não informado" (no posicionamento, "não avaliado"). */
function listaOpcional<const T extends readonly [string, ...string[]]>(valores: T, mensagem: string) {
  return z.preprocess(vazioParaAusente, z.enum(valores, { error: mensagem }).optional());
}

/**
 * Rascunho da avaliação. As notas (metodologia de demonstração) chegam como
 * campos "nota_<id do critério>"; vazio significa "sem nota" (nunca zero). Na
 * escala V2.2, vazio nos níveis e no posicionamento significa "não avaliado",
 * e vazio nas ressalvas, "não se aplica". O que é exigido para publicar é
 * conferido pelo próprio banco de dados.
 */
export const esquemaRascunho = z.object({
  versaoId: esquemaIdentificador,
  posicionamento: listaOpcional(POSICIONAMENTOS, "Posicionamento inválido."),
  grauConfianca: listaOpcional(GRAUS_CONFIANCA, "Grau de confiança inválido."),
  justificativaConfianca: textoOpcional("Justificativa do grau de confiança", 1000),
  justificativa: textoOpcional("Justificativa", 4000),
  validacaoInstitucional: textoOpcional("Origem da informação", 1000),
  dataReferencia: esquemaDataOpcional,
  nivelPoder: listaOpcional(NIVEIS, "Nível de poder inválido."),
  nivelInteresse: listaOpcional(NIVEIS, "Nível de interesse inválido."),
  justificativaPoder: textoOpcional("Justificativa do poder", 2000),
  justificativaInteresse: textoOpcional("Justificativa do interesse", 2000),
  justificativaPosicionamento: textoOpcional("Justificativa do posicionamento", 2000),
  naturezaPosicionamento: listaOpcional(NATUREZAS_POSICIONAMENTO, "Natureza da informação inválida."),
  situacaoRessalvas: listaOpcional(SITUACOES_RESSALVAS, "Situação das ressalvas inválida."),
  descricaoRessalvas: textoOpcional("Descrição das ressalvas", 2000),
});

export type DadosRascunho = z.infer<typeof esquemaRascunho>;

/**
 * Confere os valores do rascunho com a escala da metodologia, antes de gravar
 * (o banco repete a mesma conferência): categorias parciais só no histórico
 * (T22); níveis só na escala ordinal; sem Médio na binária histórica.
 */
export function errosDaEscala(
  dados: DadosRascunho,
  escala: { poderInteresse: EscalaPoderInteresse; posicionamento: EscalaPosicionamento },
): Record<string, string[]> {
  const erros: Record<string, string[]> = {};
  if (
    escala.posicionamento === "tres_categorias" &&
    dados.posicionamento &&
    !(POSICIONAMENTOS_VIGENTES as readonly string[]).includes(dados.posicionamento)
  ) {
    erros.posicionamento = ["Use Favorável, Neutro, Contrário ou “Não avaliado”: as categorias parciais existem só no histórico."];
  }
  if (escala.poderInteresse === "demonstracao_numerica") {
    if (dados.nivelPoder) erros.nivelPoder = ["Esta metodologia usa notas por critério, sem níveis."];
    if (dados.nivelInteresse) erros.nivelInteresse = ["Esta metodologia usa notas por critério, sem níveis."];
  }
  if (escala.poderInteresse === "binaria_historica") {
    if (dados.nivelPoder === "medio") erros.nivelPoder = ["A escala binária histórica não tem o nível Médio."];
    if (dados.nivelInteresse === "medio") erros.nivelInteresse = ["A escala binária histórica não tem o nível Médio."];
  }
  return erros;
}

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
