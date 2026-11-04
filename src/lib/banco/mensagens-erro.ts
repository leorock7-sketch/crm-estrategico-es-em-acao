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
  // Etapa 4: Plano de Ação e Matriz de Riscos.
  plano_acao_titulo_preenchido: "Informe o título do plano.",
  plano_acao_projeto_unico: "Este projeto ou tema já tem um plano de ação.",
  plano_eixo_nome_preenchido: "Informe o nome do pilar ou eixo.",
  plano_eixo_codigo_unico: "Já existe um pilar ou eixo com este código no plano.",
  plano_acao_versao_numero_unico: "Outra versão foi criada ao mesmo tempo. Recarregue a página e tente novamente.",
  plano_acao_versao_vigente_unica: "O plano já tem uma versão vigente.",
  plano_acao_versao_elaboracao_unica: "Já existe uma versão em elaboração ou em aprovação deste plano.",
  plano_acao_versao_decisao_registrada: "Registre quem decidiu e quando.",
  acao_codigo_unico: "Outra ação foi incluída ao mesmo tempo. Recarregue a página e tente novamente.",
  acao_planejamento_titulo_preenchido: "Descreva a ação.",
  acao_planejamento_datas: "O fim previsto não pode ser anterior ao início.",
  acao_planejamento_com_responsavel: "Indique o responsável, da equipe ou externo.",
  acao_planejamento_unico: "Esta ação já está nesta versão do plano.",
  acao_marco_codigo_unico: "Outro marco foi incluído ao mesmo tempo. Recarregue a página e tente novamente.",
  marco_planejamento_descricao_preenchida: "Descreva o marco.",
  marco_planejamento_unico: "Este marco já está nesta versão do plano.",
  acao_acompanhamento_percentual: "Use um percentual de 0 a 100.",
  acao_acompanhamento_marco: "Indique se o marco foi alcançado.",
  acao_acompanhamento_preenchido: "Informe a situação, o percentual, uma observação ou o marco.",
  acao_stakeholder_unico: "Esta pessoa ou instituição já está relacionada à ação.",
  risco_titulo_preenchido: "Descreva o risco.",
  risco_codigo_unico: "Outro risco foi registrado ao mesmo tempo. Recarregue a página e tente novamente.",
  risco_avaliacao_probabilidade: "A probabilidade vai de 1 a 5.",
  risco_avaliacao_impacto: "O impacto vai de 1 a 5.",
  risco_avaliacao_justificativa_preenchida: "Justifique a avaliação.",
  risco_gatilho_descricao_preenchida: "Descreva o gatilho.",
  risco_resposta_descricao_preenchida: "Descreva a medida de resposta.",
  risco_stakeholder_unico: "Esta pessoa ou instituição já está relacionada ao risco.",
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
