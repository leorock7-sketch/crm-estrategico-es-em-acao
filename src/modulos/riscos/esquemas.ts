import { z } from "zod";
import {
  esquemaDataOpcional,
  esquemaIdentificador,
  textoObrigatorio,
  textoOpcional,
  vazioParaAusente,
} from "@/lib/validacao/comuns";
import { ESTRATEGIAS_RESPOSTA, SITUACOES_RESPOSTA, SITUACOES_RISCO, TIPOS_AVALIACAO } from "./rotulos";

const identificadorOpcional = (mensagem: string) => z.preprocess(vazioParaAusente, z.uuid({ error: mensagem }).optional());

/** Nível de 1 a 5 da matriz (probabilidade ou impacto). */
const nivel5 = (nome: string) =>
  z.preprocess(
    (v) => (vazioParaAusente(v) === undefined ? undefined : Number(v)),
    z
      .number({ error: `Selecione ${nome}.` })
      .int()
      .min(1, { error: `Selecione ${nome}.` })
      .max(5, { error: `Selecione ${nome}.` }),
  );

const camposAvaliacao = {
  dataAvaliacao: z.iso.date({ error: "Informe a data da avaliação." }),
  probabilidade: nivel5("a probabilidade"),
  impacto: nivel5("o impacto"),
  justificativa: textoObrigatorio("Justificativa", 2000),
  avaliadoPor: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione o responsável pela avaliação." })),
};

export const esquemaRisco = z.object({
  titulo: textoObrigatorio("Risco", 300),
  descricao: textoOpcional("Descrição", 4000),
  causa: textoOpcional("Causa", 2000),
  consequencia: textoOpcional("Consequência", 2000),
  controlesExistentes: textoOpcional("Controles existentes", 2000),
  eixoId: identificadorOpcional("Pilar ou eixo inválido."),
  iniciativaId: identificadorOpcional("Iniciativa inválida."),
  responsavelId: identificadorOpcional("Responsável inválido."),
  situacao: z.enum(SITUACOES_RISCO, { error: "Selecione a situação." }),
  proximaRevisao: esquemaDataOpcional,
});
export type DadosRisco = z.infer<typeof esquemaRisco>;

/** Novo risco: já com a avaliação do risco inerente (obrigatória). */
export const esquemaNovoRisco = esquemaRisco.extend({
  projetoTemaId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione o projeto ou tema." })),
  ...camposAvaliacao,
});
export type DadosNovoRisco = z.infer<typeof esquemaNovoRisco>;

/** Avaliação ou reavaliação, sempre fundamentada; cada uma é um novo registro. */
export const esquemaAvaliacao = z.object({
  riscoId: esquemaIdentificador,
  tipo: z.enum(TIPOS_AVALIACAO, { error: "Selecione o tipo da avaliação." }),
  ...camposAvaliacao,
});
export type DadosAvaliacao = z.infer<typeof esquemaAvaliacao>;

export const esquemaGatilho = z.object({
  riscoId: esquemaIdentificador,
  descricao: textoObrigatorio("Gatilho", 1000),
});

export const esquemaRegistroGatilho = z.object({
  gatilhoId: esquemaIdentificador,
  data: z.iso.date({ error: "Informe a data." }),
  ocorrido: z.preprocess((v) => (v === "sim" ? true : v === "nao" ? false : undefined), z.boolean({ error: "Indique se o gatilho ocorreu." })),
  observacao: textoOpcional("Observação", 2000),
});
export type DadosRegistroGatilho = z.infer<typeof esquemaRegistroGatilho>;

export const esquemaResposta = z.object({
  riscoId: esquemaIdentificador,
  estrategia: z.enum(ESTRATEGIAS_RESPOSTA, { error: "Selecione a estratégia." }),
  descricao: textoObrigatorio("Medida de resposta", 2000),
  responsavelUsuarioId: identificadorOpcional("Responsável inválido."),
  responsavelStakeholderId: identificadorOpcional("Responsável inválido."),
  prazo: esquemaDataOpcional,
  situacao: z.enum(SITUACOES_RESPOSTA, { error: "Selecione a situação." }),
  acaoId: identificadorOpcional("Ação inválida."),
});
export type DadosResposta = z.infer<typeof esquemaResposta>;

export const esquemaStakeholderRisco = z.object({
  riscoId: esquemaIdentificador,
  stakeholderId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione a pessoa ou instituição." })),
  observacao: textoOpcional("Observação", 500),
});
export type DadosStakeholderRisco = z.infer<typeof esquemaStakeholderRisco>;
