import { z } from "zod";
import {
  esquemaDataOpcional,
  esquemaIdentificador,
  textoObrigatorio,
  textoOpcional,
  vazioParaAusente,
} from "@/lib/validacao/comuns";
import { PERIODICIDADES, SITUACOES_ACAO } from "./rotulos";

const identificadorOpcional = (mensagem: string) => z.preprocess(vazioParaAusente, z.uuid({ error: mensagem }).optional());

export const esquemaPlano = z.object({
  titulo: textoObrigatorio("Título", 200),
  objetivo: textoOpcional("Objetivo geral", 2000),
  responsavelId: identificadorOpcional("Responsável inválido."),
});
export type DadosPlano = z.infer<typeof esquemaPlano>;

/** Novo plano: um por projeto ou tema; os pilares de referência são opcionais. */
export const esquemaNovoPlano = esquemaPlano.extend({
  projetoTemaId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione o projeto ou tema." })),
  usarPilaresReferencia: z.preprocess((v) => v === "sim" || v === true, z.boolean()),
});
export type DadosNovoPlano = z.infer<typeof esquemaNovoPlano>;

export const esquemaEixo = z.object({
  planoAcaoId: esquemaIdentificador,
  nome: textoObrigatorio("Nome", 200),
  descricao: textoOpcional("Descrição", 2000),
  objetivo: textoOpcional("Objetivo estratégico", 2000),
});
export type DadosEixo = z.infer<typeof esquemaEixo>;

/** Planejamento da ação numa versão em rascunho (nova ação quando não há acaoId). */
export const esquemaAcaoPlanejada = z
  .object({
    versaoId: esquemaIdentificador,
    eixoId: identificadorOpcional("Pilar ou eixo inválido."),
    titulo: textoObrigatorio("Ação", 300),
    descricao: textoOpcional("Detalhamento", 4000),
    justificativa: textoOpcional("Justificativa", 2000),
    responsavelUsuarioId: identificadorOpcional("Responsável inválido."),
    responsavelStakeholderId: identificadorOpcional("Responsável inválido."),
    inicioPrevisto: esquemaDataOpcional,
    fimPrevisto: esquemaDataOpcional,
    periodicidade: z.preprocess(vazioParaAusente, z.enum(PERIODICIDADES).optional()),
    iniciativaId: identificadorOpcional("Iniciativa inválida."),
  })
  .refine((d) => d.responsavelUsuarioId || d.responsavelStakeholderId, {
    error: "Indique o responsável, da equipe ou externo.",
    path: ["responsavelUsuarioId"],
  })
  .refine((d) => !d.inicioPrevisto || !d.fimPrevisto || d.fimPrevisto >= d.inicioPrevisto, {
    error: "O fim previsto não pode ser anterior ao início.",
    path: ["fimPrevisto"],
  });
export type DadosAcaoPlanejada = z.infer<typeof esquemaAcaoPlanejada>;

export const esquemaMarco = z.object({
  versaoId: esquemaIdentificador,
  acaoId: esquemaIdentificador,
  descricao: textoObrigatorio("Marco", 500),
  prazoPrevisto: esquemaDataOpcional,
});
export type DadosMarco = z.infer<typeof esquemaMarco>;

export const esquemaEnvio = z.object({
  versaoId: esquemaIdentificador,
  motivoAlteracao: textoOpcional("Motivo da alteração", 2000),
});

export const esquemaDecisao = z.object({
  versaoId: esquemaIdentificador,
  decisao: z.enum(["aprovada", "devolvida", "rejeitada"], { error: "Selecione a decisão." }),
  parecer: textoOpcional("Parecer", 2000),
});
export type DadosDecisao = z.infer<typeof esquemaDecisao>;

/**
 * Acompanhamento sem aprovação (D-072, item 2.2): situação, percentual
 * complementar e opcional, observação e marco alcançado; ao menos uma informação.
 */
export const esquemaAcompanhamentoAcao = z
  .object({
    acaoId: esquemaIdentificador,
    data: z.iso.date({ error: "Informe a data do acompanhamento." }),
    situacao: z.preprocess(vazioParaAusente, z.enum(SITUACOES_ACAO).optional()),
    percentual: z.preprocess(
      (v) => (vazioParaAusente(v) === undefined ? undefined : Number(v)),
      z.number({ error: "Percentual inválido." }).int({ error: "Use um número inteiro." }).min(0).max(100, { error: "Use de 0 a 100." }).optional(),
    ),
    observacao: textoOpcional("Observação", 2000),
    marcoId: identificadorOpcional("Marco inválido."),
    marcoAlcancado: z.preprocess((v) => (v === "sim" ? true : v === "nao" ? false : undefined), z.boolean().optional()),
  })
  .refine((d) => d.situacao || d.percentual !== undefined || d.observacao || d.marcoId, {
    error: "Informe a situação, o percentual, uma observação ou o marco.",
    path: ["observacao"],
  })
  .refine((d) => !d.marcoId || d.marcoAlcancado !== undefined, {
    error: "Indique se o marco foi alcançado.",
    path: ["marcoAlcancado"],
  });
export type DadosAcompanhamentoAcao = z.infer<typeof esquemaAcompanhamentoAcao>;

export const esquemaConversaoCompromisso = z.object({
  compromissoId: esquemaIdentificador,
  planoAcaoId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione o plano de ação." })),
  eixoId: identificadorOpcional("Pilar ou eixo inválido."),
});

export const esquemaStakeholderAcao = z.object({
  acaoId: esquemaIdentificador,
  stakeholderId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione a pessoa ou instituição." })),
  observacao: textoOpcional("Observação", 500),
});
export type DadosStakeholderAcao = z.infer<typeof esquemaStakeholderAcao>;
