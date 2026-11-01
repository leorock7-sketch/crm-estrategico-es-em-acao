import { normalizarTexto } from "@/lib/texto";

function mesmoTexto(a?: string | null, b?: string | null) {
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}

/**
 * Na edição, a busca por possível duplicidade só é refeita quando muda o dado
 * que identifica a pessoa (o nome). Assim, corrigir as observações não exige
 * nova confirmação. Repetições de contatos são verificadas ao registrá-los.
 */
export function identificacaoPessoaMudou(
  atual: { nomeNormalizado: string },
  novo: { nomeCompleto: string },
) {
  return atual.nomeNormalizado !== normalizarTexto(novo.nomeCompleto);
}

/** Equivalente para instituições: nome, sigla ou CNPJ. */
export function identificacaoInstituicaoMudou(
  atual: { nomeNormalizado: string; sigla: string | null; cnpj: string | null },
  novo: { nome: string; sigla?: string; cnpj?: string },
) {
  return (
    atual.nomeNormalizado !== normalizarTexto(novo.nome) ||
    !mesmoTexto(atual.sigla, novo.sigla) ||
    (atual.cnpj ?? "") !== (novo.cnpj ?? "")
  );
}
