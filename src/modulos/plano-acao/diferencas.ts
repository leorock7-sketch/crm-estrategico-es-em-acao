/**
 * Comparação entre duas versões do plano (por exemplo, a vigente e a proposta),
 * para quem decide sobre a aprovação ver o que muda: ações e marcos incluídos,
 * retirados ou alterados, campo a campo. Sem dependência do banco.
 */

export type AcaoComparavel = {
  acaoId: string;
  codigo: string;
  titulo: string;
  eixoCodigo: string | null;
  eixoNome: string | null;
  descricao: string | null;
  justificativa: string | null;
  responsavelUsuarioNome: string | null;
  responsavelStakeholderNome: string | null;
  inicioPrevisto: string | null;
  fimPrevisto: string | null;
  periodicidade: string | null;
  iniciativaTitulo: string | null;
  marcos: { marcoId: string; codigo: string; descricao: string; prazoPrevisto: string | null }[];
};

export type Alteracao = { campo: string; antes: string | null; depois: string | null };

export type DiferencaAcao =
  | { tipo: "incluida"; codigo: string; titulo: string }
  | { tipo: "retirada"; codigo: string; titulo: string }
  | { tipo: "alterada"; codigo: string; titulo: string; alteracoes: Alteracao[] };

const CAMPOS: { campo: string; valor: (a: AcaoComparavel) => string | null }[] = [
  { campo: "Ação", valor: (a) => a.titulo },
  { campo: "Pilar ou eixo", valor: (a) => (a.eixoCodigo ? `${a.eixoCodigo} – ${a.eixoNome ?? ""}` : null) },
  { campo: "Detalhamento", valor: (a) => a.descricao },
  { campo: "Justificativa", valor: (a) => a.justificativa },
  {
    campo: "Responsável",
    valor: (a) => [a.responsavelUsuarioNome, a.responsavelStakeholderNome].filter(Boolean).join(" / ") || null,
  },
  { campo: "Início previsto", valor: (a) => a.inicioPrevisto },
  { campo: "Fim previsto", valor: (a) => a.fimPrevisto },
  { campo: "Periodicidade", valor: (a) => a.periodicidade },
  { campo: "Iniciativa", valor: (a) => a.iniciativaTitulo },
];

function alteracoesDosMarcos(antes: AcaoComparavel["marcos"], depois: AcaoComparavel["marcos"]): Alteracao[] {
  const resultado: Alteracao[] = [];
  const anteriores = new Map(antes.map((m) => [m.marcoId, m]));
  const novos = new Map(depois.map((m) => [m.marcoId, m]));
  const texto = (m: AcaoComparavel["marcos"][number]) => `${m.descricao}${m.prazoPrevisto ? ` (prazo ${m.prazoPrevisto})` : ""}`;
  for (const m of depois) {
    const anterior = anteriores.get(m.marcoId);
    if (!anterior) resultado.push({ campo: `Marco ${m.codigo} incluído`, antes: null, depois: texto(m) });
    else if (texto(anterior) !== texto(m)) resultado.push({ campo: `Marco ${m.codigo}`, antes: texto(anterior), depois: texto(m) });
  }
  for (const m of antes) {
    if (!novos.has(m.marcoId)) resultado.push({ campo: `Marco ${m.codigo} retirado`, antes: texto(m), depois: null });
  }
  return resultado;
}

/** Diferenças da versão `depois` em relação à versão `antes` (vazia quando não há versão anterior). */
export function diferencasEntreVersoes(antes: readonly AcaoComparavel[], depois: readonly AcaoComparavel[]): DiferencaAcao[] {
  const resultado: DiferencaAcao[] = [];
  const anteriores = new Map(antes.map((a) => [a.acaoId, a]));
  const novas = new Set(depois.map((a) => a.acaoId));
  for (const a of depois) {
    const anterior = anteriores.get(a.acaoId);
    if (!anterior) {
      resultado.push({ tipo: "incluida", codigo: a.codigo, titulo: a.titulo });
      continue;
    }
    const alteracoes: Alteracao[] = [];
    for (const { campo, valor } of CAMPOS) {
      const v1 = valor(anterior);
      const v2 = valor(a);
      if ((v1 ?? "") !== (v2 ?? "")) alteracoes.push({ campo, antes: v1, depois: v2 });
    }
    alteracoes.push(...alteracoesDosMarcos(anterior.marcos, a.marcos));
    if (alteracoes.length) resultado.push({ tipo: "alterada", codigo: a.codigo, titulo: a.titulo, alteracoes });
  }
  for (const a of antes) {
    if (!novas.has(a.acaoId)) resultado.push({ tipo: "retirada", codigo: a.codigo, titulo: a.titulo });
  }
  return resultado.sort((x, y) => x.codigo.localeCompare(y.codigo, "pt-BR", { numeric: true }));
}
