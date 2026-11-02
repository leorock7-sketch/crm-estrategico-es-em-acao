/**
 * Alertas orientativos da avaliação V2.2 (Q-66 1.0, seção 4.1; Q-67 1.0, seção
 * 4.1). Apontam possíveis inconsistências, mas NUNCA impedem salvar nem
 * publicar: o consultor pode manter a classificação, com justificativa, e os
 * alertas mantidos ficam gravados na versão publicada (D-067, D-068).
 * Só entram aqui as condições detectáveis por regra; as que dependem de ler o
 * texto ficam como lembretes fixos na tela. Funções puras, testáveis sem banco.
 */
import type { GrauConfianca, NaturezaPosicionamento, Posicionamento, SituacaoRessalvas } from "./rotulos";

export type DadosParaAlertas = {
  posicionamento: Posicionamento | null;
  naturezaPosicionamento: NaturezaPosicionamento | null;
  /** Origem da informação sobre o posicionamento (campo de validação institucional). */
  origemPosicionamento: string | null;
  situacaoRessalvas: SituacaoRessalvas | null;
  descricaoRessalvas: string | null;
  justificativaPosicionamento: string | null;
  grauConfianca: GrauConfianca | null;
};

export type CodigoAlerta =
  | "neutro_por_percepcao"
  | "origem_nao_informada"
  | "ressalvas_com_manifestacao"
  | "ressalvas_sem_descricao"
  | "indefinicao_sem_justificativa"
  | "confianca_alta_nao_confirmada";

export type AlertaOrientativo = { codigo: CodigoAlerta; mensagem: string };

export const MENSAGENS_ALERTA: Record<CodigoAlerta, string> = {
  neutro_por_percepcao:
    "Neutro pressupõe manifestação neutra ou equidistante. Silêncio, falta de resposta ou dever de imparcialidade do órgão não bastam.",
  origem_nao_informada: "Registre a origem da informação sobre o posicionamento (quem, em que contexto).",
  ressalvas_com_manifestacao: "Há manifestação? Revise a situação das ressalvas.",
  ressalvas_sem_descricao: "Descreva as condições ou objeções das ressalvas relevantes.",
  indefinicao_sem_justificativa: "Registre a manifestação e a razão da indefinição na justificativa do posicionamento.",
  confianca_alta_nao_confirmada: "Confiança alta com informação não confirmada: revise.",
};

const vazio = (texto: string | null) => !texto || texto.trim() === "";

/** Alertas ativos para os dados informados, na ordem de exibição. */
export function calcularAlertas(dados: DadosParaAlertas): AlertaOrientativo[] {
  const codigos: CodigoAlerta[] = [];
  const naturezaComManifestacao =
    dados.naturezaPosicionamento === "manifestacao_formal" || dados.naturezaPosicionamento === "informacao_informal";
  const naoConfirmada =
    dados.naturezaPosicionamento === "informacao_informal" || dados.naturezaPosicionamento === "percepcao_consultor";

  if (dados.posicionamento === "neutro" && dados.naturezaPosicionamento === "percepcao_consultor") {
    codigos.push("neutro_por_percepcao");
  }
  if (dados.posicionamento !== null && naturezaComManifestacao && vazio(dados.origemPosicionamento)) {
    codigos.push("origem_nao_informada");
  }
  if (dados.posicionamento !== null && naturezaComManifestacao && dados.situacaoRessalvas === null) {
    codigos.push("ressalvas_com_manifestacao");
  }
  if (dados.situacaoRessalvas === "ha_ressalvas" && vazio(dados.descricaoRessalvas)) {
    codigos.push("ressalvas_sem_descricao");
  }
  if (dados.posicionamento === null && dados.situacaoRessalvas !== null && vazio(dados.justificativaPosicionamento)) {
    codigos.push("indefinicao_sem_justificativa");
  }
  if (dados.grauConfianca === "alto" && naoConfirmada) {
    codigos.push("confianca_alta_nao_confirmada");
  }
  return codigos.map((codigo) => ({ codigo, mensagem: MENSAGENS_ALERTA[codigo] }));
}
