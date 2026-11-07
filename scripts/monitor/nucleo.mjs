/**
 * Núcleo do monitoramento gratuito (Etapa 7, Fase 7A; autorização A3 da D-082).
 *
 * O que comprova: que o banco, o login e, quando hospedada, a aplicação RESPONDEM. Não comprova que a
 * atividade produzida baste para evitar a suspensão do projeto gratuito: o próprio Supabase informa
 * que algumas consultas por dia costumam bastar, sem garantia. São perguntas diferentes.
 *
 * Regras:
 *  - conecta só com o papel crm_monitor, sem acesso a tabelas; recusa qualquer credencial com privilégio;
 *  - não grava nada, não gera dados artificiais;
 *  - registra somente data, verificação, resultado, duração e categoria do erro; no consumo, também
 *    o percentual do limite. Nunca a mensagem original do erro, que pode conter endereço ou usuário.
 *
 * Sem dependências além do driver postgres, recebido por parâmetro (o GitHub Actions instala só ele).
 */

/** Supabase Free: 500 MB de banco por projeto (página de preços, consultada em 07/11/2026). */
export const LIMITE_BANCO_BYTES = 500 * 1024 * 1024;

/** Alertas de consumo: parâmetros de gestão da D-082, e não regras do fornecedor. */
export const ALERTAS_CONSUMO = { atencao: 0.7, critico: 0.85 };

/**
 * Tabelas sem as proteções do banco: regras de acesso ligadas e forçadas, gatilho de auditoria e
 * bloqueio de esvaziamento (C6). Sem gatilho de auditoria por desenho: a própria auditoria e a tabela-mãe
 * stakeholder (só identificador e tipo; as alterações ficam auditadas em pessoa e instituicao). Lê só o catálogo do PostgreSQL,
 * aberto a qualquer papel; nenhum dado de negócio.
 */
export const CONSULTA_PROTECOES = `
select count(*)::int as tabelas_sem_protecao
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and (
  not c.relrowsecurity or not c.relforcerowsecurity
  or (c.relname not in ('registro_auditoria', 'stakeholder') and not exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = c.oid and t.tgenabled <> 'D' and p.proname = 'registrar_auditoria'))
  or not exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = c.oid and t.tgenabled <> 'D' and p.proname = 'impedir_esvaziamento')
)`;

/**
 * @typedef {{ data: string, verificacao: string, resultado: "ok" | "falha" | "alerta" | "ignorada",
 *   duracao_ms: number | null, categoria: string | null, percentual_do_limite?: number }} Linha
 */

/**
 * @param {string} verificacao
 * @param {Linha["resultado"]} resultado
 * @param {number | null} duracaoMs
 * @param {string | null} [categoria]
 * @returns {Linha}
 */
export function linha(verificacao, resultado, duracaoMs, categoria = null) {
  return { data: new Date().toISOString(), verificacao, resultado, duracao_ms: duracaoMs, categoria };
}

/**
 * Classifica a falha sem reproduzir a mensagem original.
 * @param {unknown} erro
 * @returns {string}
 */
export function categorizarErro(erro) {
  const e = /** @type {{ code?: string, name?: string, message?: string, errno?: string }} */ (erro ?? {});
  const codigo = String(e.code ?? e.errno ?? "");
  const mensagem = String(e.message ?? "");
  if (e.name === "AbortError" || e.name === "TimeoutError" || codigo === "CONNECT_TIMEOUT" || codigo === "57014" || /timeout|timed out/i.test(mensagem)) return "tempo-esgotado";
  if (codigo === "28P01" || codigo === "28000" || /password authentication failed/i.test(mensagem)) return "autenticacao-recusada";
  if (/paused|pausad/i.test(mensagem)) return "projeto-pausado";
  if (/tenant or user not found/i.test(mensagem)) return "projeto-inexistente-ou-pausado";
  if (codigo === "ENOTFOUND" || codigo === "EAI_AGAIN") return "endereco-nao-encontrado";
  if (codigo === "ECONNREFUSED" || codigo === "ECONNRESET" || codigo === "EPIPE") return "conexao-recusada";
  if (codigo === "53300" || /too many connections|max client connections/i.test(mensagem)) return "limite-de-conexoes";
  if (codigo === "42501") return "permissao-negada";
  return "desconhecida";
}

/**
 * @param {number} bytes
 * @param {number} [limite]
 */
export function avaliarConsumo(bytes, limite = LIMITE_BANCO_BYTES) {
  const fracao = bytes / limite;
  const percentual = Math.round(fracao * 1000) / 10;
  if (fracao >= ALERTAS_CONSUMO.critico) return { percentual, resultado: /** @type {const} */ ("alerta"), categoria: "acima-de-85-por-cento" };
  if (fracao >= ALERTAS_CONSUMO.atencao) return { percentual, resultado: /** @type {const} */ ("alerta"), categoria: "acima-de-70-por-cento" };
  return { percentual, resultado: /** @type {const} */ ("ok"), categoria: null };
}

const agora = () => performance.now();

/**
 * Banco: responde, com o papel restrito; proteções ativas; tamanho em relação ao limite gratuito.
 * @param {(url: string, opcoes: object) => any} postgres
 * @param {string} url
 * @returns {Promise<Linha[]>}
 */
export async function verificarBanco(postgres, url) {
  const linhas = [];
  const inicio = agora();
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 2,
    onnotice: () => {},
    connection: { application_name: "crm-monitor" },
  });
  try {
    const [identidade] = await sql`
      select current_user as papel,
        (select rolsuper or rolbypassrls from pg_roles where rolname = current_user) as privilegiado,
        1 as resposta`;
    if (identidade.papel !== "crm_monitor" || identidade.privilegiado !== false) {
      linhas.push(linha("banco", "falha", Math.round(agora() - inicio), "credencial-indevida"));
      return linhas;
    }
    linhas.push(linha("banco", "ok", Math.round(agora() - inicio)));

    const inicioProtecoes = agora();
    const [protecoes] = await sql.unsafe(CONSULTA_PROTECOES);
    linhas.push(
      protecoes.tabelas_sem_protecao === 0
        ? linha("protecoes", "ok", Math.round(agora() - inicioProtecoes))
        : linha("protecoes", "falha", Math.round(agora() - inicioProtecoes), "protecao-desativada"),
    );

    const inicioConsumo = agora();
    const [tamanho] = await sql`select pg_database_size(current_database())::bigint as bytes`;
    const consumo = avaliarConsumo(Number(tamanho.bytes));
    linhas.push({ ...linha("consumo-banco", consumo.resultado, Math.round(agora() - inicioConsumo), consumo.categoria), percentual_do_limite: consumo.percentual });
  } catch (erro) {
    linhas.push(linha(linhas.length === 0 ? "banco" : "banco-consultas", "falha", Math.round(agora() - inicio), categorizarErro(erro)));
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
  return linhas;
}

/**
 * Serviço HTTP (login do Supabase ou rota de saúde da aplicação).
 * @param {string} verificacao
 * @param {string} url
 * @param {Record<string, string>} cabecalhos
 * @param {(corpo: unknown) => boolean} [aceitar]
 * @returns {Promise<Linha>}
 */
export async function verificarHttp(verificacao, url, cabecalhos = {}, aceitar = () => true) {
  const inicio = agora();
  try {
    const resposta = await fetch(url, { headers: cabecalhos, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const duracao = Math.round(agora() - inicio);
    if (resposta.status !== 200) return linha(verificacao, "falha", duracao, `http-${resposta.status}`);
    const corpo = await resposta.json().catch(() => null);
    return aceitar(corpo) ? linha(verificacao, "ok", duracao) : linha(verificacao, "falha", duracao, "resposta-inesperada");
  } catch (erro) {
    return linha(verificacao, "falha", Math.round(agora() - inicio), categorizarErro(erro));
  }
}

/**
 * @param {{ postgres: (url: string, opcoes: object) => any, env: Record<string, string | undefined> }} entrada
 * @returns {Promise<Linha[]>}
 */
export async function executarVerificacoes({ postgres, env }) {
  const linhas = [];
  if (env.CRM_MONITOR_URL) linhas.push(...(await verificarBanco(postgres, env.CRM_MONITOR_URL)));
  else linhas.push(linha("banco", "falha", null, "configuracao-ausente"));

  if (env.CRM_SUPABASE_URL && env.CRM_SUPABASE_CHAVE_PUBLICA) {
    const base = env.CRM_SUPABASE_URL.replace(/\/+$/, "");
    linhas.push(await verificarHttp("autenticacao", `${base}/auth/v1/health`, { apikey: env.CRM_SUPABASE_CHAVE_PUBLICA }));
  } else {
    linhas.push(linha("autenticacao", "falha", null, "configuracao-ausente"));
  }

  if (env.CRM_APP_URL) {
    const base = env.CRM_APP_URL.replace(/\/+$/, "");
    linhas.push(await verificarHttp("aplicacao", `${base}/saude`, {}, (corpo) => /** @type {{ situacao?: string } | null} */ (corpo)?.situacao === "ok"));
  } else {
    linhas.push(linha("aplicacao", "ignorada", null, "nao-hospedada"));
  }
  return linhas;
}

/**
 * Resumo para a página da execução no GitHub Actions: os mesmos campos, e nada mais.
 * @param {Linha[]} linhas
 */
export function resumoMarkdown(linhas) {
  const corpo = linhas
    .map((l) => `| ${l.data} | ${l.verificacao} | ${l.resultado} | ${l.duracao_ms ?? "—"} | ${l.categoria ?? "—"} | ${l.percentual_do_limite ?? "—"} |`)
    .join("\n");
  return `## Monitoramento do CRM\n\n| Data (UTC) | Verificação | Resultado | Duração (ms) | Categoria | % do limite |\n|---|---|---|---|---|---|\n${corpo}\n\nResponder não comprova, sozinho, que a atividade baste para evitar a suspensão do projeto gratuito.\n`;
}

/** @param {Linha[]} linhas */
export function houveProblema(linhas) {
  return linhas.some((l) => l.resultado === "falha" || l.resultado === "alerta");
}
