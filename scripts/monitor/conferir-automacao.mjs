/**
 * Confere a própria automação (D-082): o GitHub desativa fluxos agendados de repositório público
 * depois de 60 dias sem atividade no repositório, e execuções podem atrasar ou ser descartadas.
 * Consulta a API pública do GitHub, sem chave, e informa o estado do fluxo e a idade da última
 * execução concluída. Comando: npm run monitor:conferir (também usado pela rotina local diária).
 *
 * Se o fluxo estiver desativado: reativar na aba Actions do repositório (botão "Enable workflow").
 * Procedimento manual alternativo: docs/OPERACAO.md, seção 2.
 */
const REPOSITORIO = process.env.CRM_REPOSITORIO ?? "leorock7-sketch/crm-estrategico-es-em-acao";
const FLUXO = "monitoramento.yml";
/** Três execuções por dia: mais de 26 horas sem nenhuma concluída indica problema. */
export const IDADE_MAXIMA_HORAS = 26;

/**
 * @param {{ state?: string }} fluxo
 * @param {{ workflow_runs?: { status: string, conclusion: string | null, updated_at: string }[] }} execucoes
 * @param {Date} agora
 */
export function avaliarAutomacao(fluxo, execucoes, agora = new Date()) {
  const concluidas = (execucoes.workflow_runs ?? []).filter((e) => e.status === "completed");
  const ultima = concluidas[0];
  const idadeHoras = ultima ? Math.round(((agora.getTime() - new Date(ultima.updated_at).getTime()) / 36e5) * 10) / 10 : null;
  const problemas = [];
  if (fluxo.state !== "active") problemas.push(`fluxo-${fluxo.state ?? "desconhecido"}`);
  if (idadeHoras === null) problemas.push("sem-execucoes");
  else if (idadeHoras > IDADE_MAXIMA_HORAS) problemas.push("execucao-atrasada");
  if (ultima && ultima.conclusion !== "success") problemas.push(`ultima-execucao-${ultima.conclusion}`);
  return { estado: fluxo.state ?? "desconhecido", ultimaConclusao: ultima?.conclusion ?? null, idadeHoras, problemas };
}

async function principal() {
  const base = `https://api.github.com/repos/${REPOSITORIO}/actions/workflows/${FLUXO}`;
  const cabecalhos = { Accept: "application/vnd.github+json", "User-Agent": "crm-monitor-conferencia" };
  const [fluxo, execucoes] = await Promise.all([
    fetch(base, { headers: cabecalhos, signal: AbortSignal.timeout(15_000) }).then((r) => (r.ok ? r.json() : { state: `http-${r.status}` })),
    fetch(`${base}/runs?per_page=10`, { headers: cabecalhos, signal: AbortSignal.timeout(15_000) }).then((r) => (r.ok ? r.json() : {})),
  ]);
  const resultado = avaliarAutomacao(fluxo, execucoes);
  console.log(JSON.stringify({ data: new Date().toISOString(), verificacao: "automacao", ...resultado }));
  process.exitCode = resultado.problemas.length > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/").replace(/^\/?/, "/")}` || process.argv[1]?.endsWith("conferir-automacao.mjs")) {
  principal().catch(() => {
    console.log(JSON.stringify({ data: new Date().toISOString(), verificacao: "automacao", problemas: ["consulta-indisponivel"] }));
    process.exitCode = 1;
  });
}
