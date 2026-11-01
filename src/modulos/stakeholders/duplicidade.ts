import { normalizarTexto } from "@/lib/texto";

function mesmoTexto(a?: string | null, b?: string | null) {
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}

/**
 * Na edição, a busca por possível duplicidade só é refeita quando mudam os
 * dados que identificam a pessoa (nome ou e-mail). Assim, corrigir um telefone
 * não exige nova confirmação.
 */
export function identificacaoPessoaMudou(
  atual: { nomeNormalizado: string; email: string | null },
  novo: { nomeCompleto: string; email?: string },
) {
  return atual.nomeNormalizado !== normalizarTexto(novo.nomeCompleto) || !mesmoTexto(atual.email, novo.email);
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
