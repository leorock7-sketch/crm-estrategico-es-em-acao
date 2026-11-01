import { erroDoBanco } from "@/lib/banco/erros";

/** Mensagens para as regras de integridade do banco (nomes definidos em esquema.ts). */
const MENSAGENS_POR_REGRA: Record<string, string> = {
  pessoa_email_unico: "Já existe uma pessoa cadastrada com este e-mail.",
  instituicao_cnpj_unico: "Já existe uma instituição cadastrada com este CNPJ.",
  vinculo_principal_vigente_unico:
    "Esta pessoa já tem um vínculo principal vigente. Encerre-o antes ou desmarque a opção “vínculo principal”.",
  vinculo_datas: "A data de término não pode ser anterior à data de início.",
  instituicao_nao_superior_de_si: "Uma instituição não pode ser superior a si mesma.",
};

/** Traduz um erro de gravação em mensagem compreensível para o usuário. */
export function mensagemDeErro(erro: unknown): string {
  const original = erroDoBanco(erro);
  if (original?.constraint && MENSAGENS_POR_REGRA[original.constraint]) {
    return MENSAGENS_POR_REGRA[original.constraint];
  }
  // Mensagens dos gatilhos do banco, já escritas em português.
  if (original?.code === "P0001" && original.message) return original.message;
  console.error(erro);
  return "Não foi possível salvar. Tente novamente; se o problema persistir, registre o ocorrido.";
}
