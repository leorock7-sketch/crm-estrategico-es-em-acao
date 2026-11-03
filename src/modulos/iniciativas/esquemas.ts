import { z } from "zod";
import {
  esquemaDataOpcional,
  esquemaIdentificador,
  textoObrigatorio,
  textoOpcional,
  vazioParaAusente,
} from "@/lib/validacao/comuns";
import { normalizarTexto } from "@/lib/texto";
import { PAPEIS_INICIATIVA, PRIORIDADES_INICIATIVA, SITUACOES_INICIATIVA, TIPOS_INICIATIVA } from "./rotulos";

/** Lista de identificadores vinda de caixas de seleção múltipla (vazia se nada foi marcado). */
export const listaDeIdentificadores = z.preprocess(
  (valor) => (valor === undefined || valor === "" ? [] : Array.isArray(valor) ? valor : [valor]),
  z.array(z.uuid({ error: "Seleção inválida." })),
);

const camposIniciativa = z.object({
  tipo: z.enum(TIPOS_INICIATIVA, { error: "Selecione o tipo da iniciativa." }),
  titulo: textoObrigatorio("Título", 200).refine((titulo) => normalizarTexto(titulo) !== "", {
    error: "O título deve conter letras ou números.",
  }),
  descricao: textoOpcional("Descrição", 4000),
  origem: textoOpcional("Origem", 500),
  situacao: z.enum(SITUACOES_INICIATIVA, { error: "Selecione a situação." }),
  prioridade: z.preprocess(vazioParaAusente, z.enum(PRIORIDADES_INICIATIVA).optional()),
  responsavelId: z.preprocess(vazioParaAusente, z.uuid({ error: "Responsável inválido." }).optional()),
  dataAbertura: z.iso.date({ error: "Informe a data de abertura." }),
  dataPrevistaConclusao: esquemaDataOpcional,
  dataConclusao: esquemaDataOpcional,
});

type CamposIniciativa = z.infer<typeof camposIniciativa>;

/** Regras entre campos: datas coerentes e conclusão datada (também garantidas no banco). */
function comRegrasDeDatas<T extends z.ZodType<CamposIniciativa>>(esquema: T) {
  return esquema
    .refine((d) => !d.dataConclusao || d.dataConclusao >= d.dataAbertura, {
      error: "A conclusão não pode ser anterior à abertura.",
      path: ["dataConclusao"],
    })
    .refine((d) => !d.dataPrevistaConclusao || d.dataPrevistaConclusao >= d.dataAbertura, {
      error: "A previsão não pode ser anterior à abertura.",
      path: ["dataPrevistaConclusao"],
    })
    .refine((d) => d.situacao !== "concluida" || d.dataConclusao, {
      error: "Informe a data de conclusão.",
      path: ["dataConclusao"],
    });
}

/** Edição dos dados da iniciativa (projetos e stakeholders são geridos na página da iniciativa). */
export const esquemaIniciativa = comRegrasDeDatas(camposIniciativa);
export type DadosIniciativa = z.infer<typeof esquemaIniciativa>;

/** Nova iniciativa: pelo menos um projeto ou tema (Q-24, provisória) e, opcionalmente, stakeholders. */
export const esquemaNovaIniciativa = comRegrasDeDatas(
  camposIniciativa.extend({
    projetos: listaDeIdentificadores.refine((ids) => ids.length > 0, {
      error: "Selecione pelo menos um projeto ou tema.",
    }),
  }),
);
export type DadosNovaIniciativa = z.infer<typeof esquemaNovaIniciativa>;

export const esquemaProjetoDaIniciativa = z.object({
  iniciativaId: esquemaIdentificador,
  projetoTemaId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione o projeto ou tema." })),
});

export const esquemaStakeholderDaIniciativa = z.object({
  iniciativaId: esquemaIdentificador,
  stakeholderId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione a pessoa ou instituição." })),
  papel: z.enum(PAPEIS_INICIATIVA, { error: "Selecione o papel." }),
  observacao: textoOpcional("Observação", 500),
});
export type DadosStakeholderDaIniciativa = z.infer<typeof esquemaStakeholderDaIniciativa>;

/** Retirada de uma ligação (arquivamento, com registro no histórico). */
export const esquemaRetirada = z.object({ ligacaoId: esquemaIdentificador });
