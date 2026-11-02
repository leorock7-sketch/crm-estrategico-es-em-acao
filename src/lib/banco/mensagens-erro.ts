import { erroDoBanco } from "./erros";

/** Mensagens para as regras de integridade do banco (nomes definidos em esquema.ts). */
const MENSAGENS_POR_REGRA: Record<string, string> = {
  vinculo_principal_vigente_unico:
    "Esta pessoa já tem um vínculo principal vigente. Encerre-o antes ou desmarque a opção “vínculo principal”.",
  vinculo_datas: "A data de término não pode ser anterior à data de início.",
  instituicao_nao_superior_de_si: "Uma instituição não pode ser superior a si mesma.",
  instituicao_uf_somente_brasil: "A UF só se aplica a instituições do Brasil.",
  instituicao_cnpj_somente_brasil: "O CNPJ só se aplica a instituições do Brasil.",
  contato_principal_vigente_unico:
    "Já existe um contato principal vigente deste tipo. Encerre-o antes ou desmarque a opção “principal”.",
  contato_datas: "A data de término não pode ser anterior à data de início.",
  projeto_tema_nome_unico: "Já existe um projeto ou tema com este nome e tipo neste comitê.",
  projeto_tema_datas: "A data de término não pode ser anterior à data de início.",
  projeto_tema_comite_vigente_unico: "Este comitê já é participante vigente deste projeto ou tema.",
  projeto_tema_comite_datas: "A data de término não pode ser anterior à data de início.",
  stakeholder_contexto_vigente_unico:
    "Este stakeholder já está associado a este projeto ou tema com o mesmo tipo de relação.",
  stakeholder_contexto_datas: "A data de término não pode ser anterior à data de início.",
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
