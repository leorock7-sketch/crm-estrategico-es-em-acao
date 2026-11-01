import { z } from "zod";
import { cnpjValido, limparCnpj } from "@/lib/validacao/cnpj";
import {
  esquemaDataOpcional,
  esquemaEmailOpcional,
  esquemaIdentificador,
  textoObrigatorio,
  textoOpcional,
  vazioParaAusente,
} from "@/lib/validacao/comuns";
import { ESFERAS, NATUREZAS, UFS } from "./rotulos";

/** Pessoa: somente dados mínimos (decisão D-021). */
export const esquemaPessoa = z.object({
  nomeCompleto: textoObrigatorio("Nome completo", 200),
  nomeTratamento: textoOpcional("Nome de tratamento", 100),
  email: esquemaEmailOpcional,
  telefone: textoOpcional("Telefone", 40),
  observacoes: textoOpcional("Observações", 2000),
});

export type DadosPessoa = z.infer<typeof esquemaPessoa>;

export const esquemaInstituicao = z.object({
  nome: textoObrigatorio("Nome", 200),
  sigla: textoOpcional("Sigla", 30),
  natureza: z.enum(NATUREZAS, { error: "Selecione a natureza da instituição." }),
  esfera: z.preprocess(vazioParaAusente, z.enum(ESFERAS, { error: "Esfera inválida." }).optional()),
  cnpj: z.preprocess(
    (valor) => (typeof valor === "string" ? vazioParaAusente(limparCnpj(valor)) : valor),
    z
      .string()
      .refine(cnpjValido, {
        error: "CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores.",
      })
      .optional(),
  ),
  uf: z.preprocess(vazioParaAusente, z.enum(UFS, { error: "UF inválida." }).optional()),
  municipio: textoOpcional("Município", 100),
  site: z.preprocess(
    vazioParaAusente,
    z
      .url({
        protocol: /^https?$/,
        error: "Endereço do site inválido. Comece com http:// ou https://.",
      })
      .max(300, { error: "Endereço do site deve ter no máximo 300 caracteres." })
      .optional(),
  ),
  instituicaoSuperiorId: z.preprocess(vazioParaAusente, esquemaIdentificador.optional()),
});

export type DadosInstituicao = z.infer<typeof esquemaInstituicao>;

export const esquemaVinculo = z
  .object({
    pessoaId: esquemaIdentificador,
    instituicaoId: z.preprocess(vazioParaAusente, z.uuid({ error: "Selecione a instituição." })),
    cargo: textoOpcional("Cargo", 150),
    area: textoOpcional("Área", 150),
    dataInicio: esquemaDataOpcional,
    dataFim: esquemaDataOpcional,
    principal: z.preprocess((valor) => valor === "on" || valor === true, z.boolean()),
  })
  .refine((dados) => !dados.dataInicio || !dados.dataFim || dados.dataFim >= dados.dataInicio, {
    error: "O término não pode ser anterior ao início.",
    path: ["dataFim"],
  });

export type DadosVinculo = z.infer<typeof esquemaVinculo>;

export const esquemaEncerramentoVinculo = z.object({
  vinculoId: esquemaIdentificador,
  dataFim: z.iso.date({ error: "Informe a data de término." }),
});
