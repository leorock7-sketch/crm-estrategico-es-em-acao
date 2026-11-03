import { z } from "zod";
import {
  esquemaDataOpcional,
  esquemaIdentificador,
  textoObrigatorio,
  textoOpcional,
  vazioParaAusente,
} from "@/lib/validacao/comuns";
import { normalizarTexto } from "@/lib/texto";
import { listaDeIdentificadores } from "@/modulos/iniciativas/esquemas";
import { FORMATO_DATA_HORA } from "./datas";
import { PRESENCAS_INTERACAO, SITUACOES_COMPROMISSO, SITUACOES_INTERACAO, TIPOS_INTERACAO } from "./rotulos";

const dataHora = (mensagem: string) => z.string({ error: mensagem }).regex(FORMATO_DATA_HORA, { error: mensagem });

const camposInteracao = z.object({
  tipo: z.enum(TIPOS_INTERACAO, { error: "Selecione o tipo da interação." }),
  assunto: textoObrigatorio("Assunto", 300).refine((assunto) => normalizarTexto(assunto) !== "", {
    error: "O assunto deve conter letras ou números.",
  }),
  inicio: dataHora("Informe a data e a hora de início."),
  fim: z.preprocess(vazioParaAusente, dataHora("Data e hora inválidas.").optional()),
  local: textoOpcional("Local", 300),
  resumo: textoOpcional("Resumo", 8000),
  situacao: z.enum(SITUACOES_INTERACAO, { error: "Selecione a situação." }),
});

type CamposInteracao = z.infer<typeof camposInteracao>;

function comPeriodoCoerente<T extends z.ZodType<CamposInteracao>>(esquema: T) {
  // Os valores têm o mesmo formato e o mesmo fuso: a comparação de textos basta.
  return esquema.refine((d) => !d.fim || d.fim >= d.inicio, {
    error: "O término não pode ser anterior ao início.",
    path: ["fim"],
  });
}

/** Edição dos dados da interação (ligações e participantes são geridos na página da interação). */
export const esquemaInteracao = comPeriodoCoerente(camposInteracao);
export type DadosInteracao = z.infer<typeof esquemaInteracao>;

/**
 * Nova interação, registrada uma única vez com todas as suas ligações: pelo
 * menos um projeto, tema ou iniciativa; participantes externos e internos opcionais.
 */
export const esquemaNovaInteracao = comPeriodoCoerente(
  camposInteracao.extend({
    projetos: listaDeIdentificadores,
    iniciativas: listaDeIdentificadores,
    participantesExternos: listaDeIdentificadores,
    participantesInternos: listaDeIdentificadores,
  }),
).refine((d) => d.projetos.length + d.iniciativas.length > 0, {
  error: "Ligue a interação a pelo menos um projeto, tema ou iniciativa.",
  path: ["projetos"],
});
export type DadosNovaInteracao = z.infer<typeof esquemaNovaInteracao>;

/** Participante: "s:<id>" (pessoa ou instituição) ou "u:<id>" (equipe interna). */
export const esquemaParticipante = z.object({
  interacaoId: esquemaIdentificador,
  participante: z
    .string({ error: "Selecione o participante." })
    .regex(/^[su]:[0-9a-f-]{36}$/i, { error: "Selecione o participante." })
    .transform((valor) => ({ tipo: valor[0] === "s" ? ("stakeholder" as const) : ("usuario" as const), id: valor.slice(2) })),
  presenca: z.enum(PRESENCAS_INTERACAO, { error: "Selecione a presença." }),
});
export type DadosParticipante = z.infer<typeof esquemaParticipante>;

export const esquemaPresenca = z.object({
  participanteId: esquemaIdentificador,
  presenca: z.enum(PRESENCAS_INTERACAO, { error: "Selecione a presença." }),
});

export const esquemaProjetoDaInteracao = z.object({
  interacaoId: esquemaIdentificador,
  projetoTemaId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione o projeto ou tema." })),
});

export const esquemaIniciativaDaInteracao = z.object({
  interacaoId: esquemaIdentificador,
  iniciativaId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione a iniciativa." })),
  contribuicao: textoOpcional("Contribuição", 500),
});
export type DadosIniciativaDaInteracao = z.infer<typeof esquemaIniciativaDaInteracao>;

const identificadorOpcional = (mensagem: string) => z.preprocess(vazioParaAusente, z.uuid({ error: mensagem }).optional());

/**
 * Compromisso (encaminhamento): ligado à interação de origem e/ou a uma
 * iniciativa, com pelo menos um responsável. A situação muda pelos registros de
 * acompanhamento, para que todo o andamento fique no histórico.
 */
export const esquemaCompromisso = z
  .object({
    descricao: textoObrigatorio("Descrição", 2000),
    interacaoId: identificadorOpcional("Interação inválida."),
    iniciativaId: identificadorOpcional("Iniciativa inválida."),
    responsavelUsuarioId: identificadorOpcional("Responsável inválido."),
    responsavelStakeholderId: identificadorOpcional("Responsável inválido."),
    prazo: esquemaDataOpcional,
  })
  .refine((d) => d.interacaoId || d.iniciativaId, {
    error: "Ligue o compromisso a uma interação ou a uma iniciativa.",
    path: ["iniciativaId"],
  })
  .refine((d) => d.responsavelUsuarioId || d.responsavelStakeholderId, {
    error: "Indique o responsável, da equipe ou externo.",
    path: ["responsavelUsuarioId"],
  });
export type DadosCompromisso = z.infer<typeof esquemaCompromisso>;

export const esquemaAcompanhamento = z.object({
  compromissoId: esquemaIdentificador,
  data: z.iso.date({ error: "Informe a data do acompanhamento." }),
  registro: textoObrigatorio("Registro", 2000),
  situacao: z.preprocess(vazioParaAusente, z.enum(SITUACOES_COMPROMISSO).optional()),
});
export type DadosAcompanhamento = z.infer<typeof esquemaAcompanhamento>;
