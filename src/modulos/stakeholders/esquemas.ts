import { z } from "zod";
import { cnpjValido, limparCnpj } from "@/lib/validacao/cnpj";
import {
  esquemaDataOpcional,
  esquemaIdentificador,
  textoObrigatorio,
  textoOpcional,
  vazioParaAusente,
} from "@/lib/validacao/comuns";
import { erroDoValorContato } from "./contatos";
import { CODIGOS_PAISES, PAIS_PADRAO } from "./paises";
import { ESFERAS, NATUREZAS, NATUREZAS_CONTATO, TIPOS_CONTATO, UFS } from "./rotulos";

/** Pessoa: somente dados mínimos (D-021); contatos ficam em tabela própria (D-025). */
export const esquemaPessoa = z.object({
  nomeCompleto: textoObrigatorio("Nome completo", 200),
  nomeTratamento: textoOpcional("Nome de tratamento", 100),
  observacoes: textoOpcional("Observações", 2000),
});

export type DadosPessoa = z.infer<typeof esquemaPessoa>;

const camposInstituicao = z.object({
  nome: textoObrigatorio("Nome", 200),
  sigla: textoOpcional("Sigla", 30),
  natureza: z.enum(NATUREZAS, { error: "Selecione a natureza da instituição." }),
  esfera: z.preprocess(vazioParaAusente, z.enum(ESFERAS, { error: "Esfera inválida." }).optional()),
  pais: z.preprocess(
    vazioParaAusente,
    z
      .string()
      .refine((codigo) => CODIGOS_PAISES.includes(codigo), { error: "País inválido." })
      .optional(),
  ),
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

/** Instituição: UF (obrigatória) e CNPJ só se aplicam a instituições do Brasil (correção C5). */
export const esquemaInstituicao = camposInstituicao.superRefine((dados, contexto) => {
  const brasileira = (dados.pais ?? PAIS_PADRAO) === PAIS_PADRAO;
  if (brasileira && !dados.uf) {
    contexto.addIssue({ code: "custom", message: "Informe a UF.", path: ["uf"] });
  }
  if (!brasileira && dados.uf) {
    contexto.addIssue({ code: "custom", message: "A UF só se aplica a instituições do Brasil.", path: ["uf"] });
  }
  if (!brasileira && dados.cnpj) {
    contexto.addIssue({ code: "custom", message: "O CNPJ só se aplica a instituições do Brasil.", path: ["cnpj"] });
  }
});

export type DadosInstituicao = z.infer<typeof camposInstituicao>;

/** Contato de pessoa ou instituição (decisão D-025). */
export const esquemaContato = z
  .object({
    stakeholderId: esquemaIdentificador,
    tipo: z.enum(TIPOS_CONTATO, { error: "Selecione o tipo de contato." }),
    valor: z.string({ error: "Informe o contato." }).trim(),
    natureza: z.enum(NATUREZAS_CONTATO, { error: "Selecione a natureza do contato." }),
    vinculoId: z.preprocess(vazioParaAusente, esquemaIdentificador.optional()),
    principal: z.preprocess((valor) => valor === "on" || valor === true, z.boolean()),
    dataInicio: esquemaDataOpcional,
    observacao: textoOpcional("Observação", 500),
  })
  .superRefine((dados, contexto) => {
    const erro = erroDoValorContato(dados.tipo, dados.valor);
    if (erro) contexto.addIssue({ code: "custom", message: erro, path: ["valor"] });
  });

export type DadosContato = z.infer<typeof esquemaContato>;

export const esquemaEncerramentoContato = z.object({
  contatoId: esquemaIdentificador,
  dataFim: z.iso.date({ error: "Informe a data de término." }),
});

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
