import { z } from "zod";
import {
  esquemaDataOpcional,
  esquemaIdentificador,
  textoObrigatorio,
  textoOpcional,
  vazioParaAusente,
} from "@/lib/validacao/comuns";
import { SITUACOES_PROJETO_TEMA, TIPOS_PROJETO_TEMA, TIPOS_RELACAO } from "./rotulos";

const datasCoerentes = (dados: { dataInicio?: string; dataFim?: string }) =>
  !dados.dataInicio || !dados.dataFim || dados.dataFim >= dados.dataInicio;

export const esquemaProjetoTema = z
  .object({
    tipo: z.enum(TIPOS_PROJETO_TEMA, { error: "Selecione se é projeto ou tema." }),
    nome: textoObrigatorio("Nome", 200),
    descricao: textoOpcional("Descrição", 2000),
    comiteId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione o comitê principal." })),
    situacao: z.enum(SITUACOES_PROJETO_TEMA, { error: "Selecione a situação." }),
    dataInicio: esquemaDataOpcional,
    dataFim: esquemaDataOpcional,
  })
  .refine(datasCoerentes, { error: "O término não pode ser anterior ao início.", path: ["dataFim"] });

export type DadosProjetoTema = z.infer<typeof esquemaProjetoTema>;

/** Comitê participante (decisão D-023). */
export const esquemaParticipacao = z.object({
  projetoTemaId: esquemaIdentificador,
  comiteId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione o comitê." })),
  dataInicio: esquemaDataOpcional,
  observacao: textoOpcional("Observação", 500),
});

export type DadosParticipacao = z.infer<typeof esquemaParticipacao>;

/** Associação de stakeholder ao contexto, sem poder ou interesse (decisão D-030). */
export const esquemaAssociacao = z.object({
  projetoTemaId: esquemaIdentificador,
  stakeholderId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione a pessoa ou instituição." })),
  tipoRelacao: z.enum(TIPOS_RELACAO, { error: "Selecione o tipo de relação." }),
  descricao: textoOpcional("Descrição", 500),
  dataInicio: esquemaDataOpcional,
});

export type DadosAssociacao = z.infer<typeof esquemaAssociacao>;

export const esquemaEncerramentoParticipacao = z.object({
  participacaoId: esquemaIdentificador,
  dataFim: z.iso.date({ error: "Informe a data de término." }),
});

export const esquemaEncerramentoAssociacao = z.object({
  associacaoId: esquemaIdentificador,
  dataFim: z.iso.date({ error: "Informe a data de término." }),
});
