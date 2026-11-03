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
  metodologia_versao_nome_unico: "Já existe uma metodologia com este nome.",
  metodologia_vigente_unica: "Já existe uma metodologia vigente. Encerre-a antes de colocar outra em vigor.",
  criterio_avaliacao_nome_unico: "Já existe um critério com este nome nesta dimensão da metodologia.",
  criterio_avaliacao_escala: "O valor máximo da escala deve ser maior que o mínimo.",
  avaliacao_stakeholder_contexto_unica: "Este stakeholder já tem uma ficha de avaliação neste projeto ou tema.",
  avaliacao_versao_rascunho_unico: "Já existe um rascunho em andamento para esta avaliação.",
  avaliacao_versao_vigente_unica: "Esta avaliação já tem uma versão vigente.",
  avaliacao_versao_numero_unico: "Outra versão foi registrada ao mesmo tempo. Recarregue a página e tente novamente.",
  avaliacao_nota_criterio_unica: "Este critério já tem nota nesta versão.",
  evidencia_descricao_preenchida: "Descreva a evidência.",
  permissao_contexto_unica: "Este usuário já tem permissão neste projeto ou tema.",
  // Etapa 3: iniciativas, interações e compromissos.
  iniciativa_titulo_preenchido: "Informe o título da iniciativa.",
  iniciativa_datas: "As datas de previsão e de conclusão não podem ser anteriores à abertura.",
  iniciativa_concluida_com_data: "Informe a data de conclusão da iniciativa.",
  iniciativa_projeto_tema_unico: "Este projeto ou tema já está ligado à iniciativa.",
  iniciativa_stakeholder_unico: "Este stakeholder já está na iniciativa com este papel.",
  interacao_assunto_preenchido: "Informe o assunto da interação.",
  interacao_periodo: "O término não pode ser anterior ao início.",
  interacao_origem_unica: "Esta reunião já foi registrada a partir do calendário de origem.",
  interacao_participante_stakeholder_unico: "Este participante já está na interação.",
  interacao_participante_usuario_unico: "Este participante já está na interação.",
  interacao_participante_um_tipo: "Indique um participante externo ou da equipe, não os dois.",
  interacao_projeto_tema_unico: "Este projeto ou tema já está ligado à interação.",
  interacao_iniciativa_unico: "Esta iniciativa já está ligada à interação.",
  compromisso_descricao_preenchida: "Descreva o compromisso.",
  compromisso_com_origem: "Ligue o compromisso a uma interação ou a uma iniciativa.",
  compromisso_com_responsavel: "Indique o responsável pelo compromisso.",
  compromisso_concluido_com_data: "Informe a data de conclusão do compromisso.",
  compromisso_acompanhamento_registro_preenchido: "Descreva o acompanhamento.",
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
