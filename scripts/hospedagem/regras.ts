/**
 * Regras da hospedagem de testes (Etapa 7B, D-087), sem rede nem banco: quais variáveis vão para o
 * Netlify, conferência da conexão da aplicação, cabeçalhos de segurança, busca de segredos em
 * arquivos públicos, vazamento de detalhes técnicos em páginas de erro e estatísticas de tempo.
 */

/** As únicas variáveis que vão para o Netlify; a conexão administrativa nunca vai. */
export const VARIAVEIS_DA_HOSPEDAGEM = ["CRM_BANCO_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"] as const;

/** A conexão da aplicação: papel crm_app, pooler de transações (porta 6543), referência do projeto. */
export function motivosContraConexaoDaAplicacao(conexao: string | undefined, referencia: string): string[] {
  if (!conexao) return ["Falta CRM_BANCO_URL."];
  try {
    const url = new URL(conexao);
    const [papel, ref] = decodeURIComponent(url.username).split(".");
    const motivos: string[] = [];
    if (papel !== "crm_app") motivos.push("A conexão da aplicação não usa o papel restrito crm_app.");
    if (ref !== referencia) motivos.push("A conexão da aplicação é de outro projeto.");
    if (url.port !== "6543" || !url.hostname.endsWith(".pooler.supabase.com")) motivos.push("A conexão da aplicação não passa pelo pooler de transações do Supabase.");
    return motivos;
  } catch {
    return ["A conexão da aplicação não é um endereço válido."];
  }
}

type Cabecalhos = { get(nome: string): string | null };

/** Cabeçalhos de segurança esperados em toda resposta da hospedagem. */
export const CABECALHOS_ESPERADOS: { nome: string; aceito: (valor: string | null) => boolean; descricao: string }[] = [
  { nome: "strict-transport-security", aceito: (v) => /max-age=\d{7,}/.test(v ?? ""), descricao: "HTTPS obrigatório (HSTS)" },
  { nome: "x-content-type-options", aceito: (v) => v === "nosniff", descricao: "sem adivinhação de tipo de arquivo" },
  { nome: "x-frame-options", aceito: (v) => v === "DENY", descricao: "não pode ser embutido em outra página" },
  { nome: "content-security-policy", aceito: (v) => /frame-ancestors 'none'/.test(v ?? ""), descricao: "não pode ser embutido em outra página (CSP)" },
  { nome: "referrer-policy", aceito: (v) => v === "strict-origin-when-cross-origin" || v === "no-referrer", descricao: "endereços internos não vazam para outros sites" },
  { nome: "x-robots-tag", aceito: (v) => /noindex/.test(v ?? ""), descricao: "fora dos buscadores" },
  { nome: "x-powered-by", aceito: (v) => v === null, descricao: "sem anunciar a tecnologia do servidor" },
];

export function avaliarCabecalhos(cabecalhos: Cabecalhos) {
  return CABECALHOS_ESPERADOS.map((c) => ({ nome: c.nome, descricao: c.descricao, ok: c.aceito(cabecalhos.get(c.nome)) }));
}

/** Valores que nunca podem aparecer em arquivos entregues ao navegador (só os longos, para evitar falso alarme). */
export function valoresSensiveis(ambiente: Record<string, string | undefined>): { nome: string; valor: string }[] {
  const senha = (conexao: string | undefined) => {
    try {
      return conexao ? decodeURIComponent(new URL(conexao).password) : "";
    } catch {
      return "";
    }
  };
  return [
    { nome: "chave secreta do Supabase", valor: ambiente.SUPABASE_SECRET_KEY ?? "" },
    { nome: "senha do papel crm_app", valor: senha(ambiente.CRM_BANCO_URL) },
    { nome: "senha administrativa do banco", valor: senha(ambiente.CRM_BANCO_ADMIN_URL) },
    { nome: "conexão da aplicação", valor: ambiente.CRM_BANCO_URL ?? "" },
  ].filter((s) => s.valor.length >= 12);
}

const PADROES_DE_SEGREDO: { nome: string; padrao: RegExp }[] = [
  { nome: "chave secreta do Supabase (formato)", padrao: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { nome: "endereço de conexão PostgreSQL", padrao: /postgres(?:ql)?:\/\/[^\s"'`]+@/ },
  { nome: "chave service_role antiga", padrao: /"role"\s*:\s*"service_role"/ },
];

/** Nomes dos segredos encontrados no texto; nunca os valores. */
export function procurarSegredos(texto: string, sensiveis: { nome: string; valor: string }[]): string[] {
  const achados = sensiveis.filter((s) => texto.includes(s.valor)).map((s) => s.nome);
  for (const p of PADROES_DE_SEGREDO) if (p.padrao.test(texto)) achados.push(p.nome);
  return [...new Set(achados)];
}

/** Página de erro não pode mostrar pilha de chamadas, caminhos do servidor nem detalhes da conexão. */
export function detalhesTecnicosNoErro(corpo: string): string[] {
  const sinais: [string, RegExp][] = [
    ["pilha de chamadas", /\n\s+at [\w$.<>[\] ]+ \(/],
    ["caminho do servidor", /\/var\/task|node_modules\/|webpack-internal:|[A-Z]:\\\\/],
    ["erro de conexão", /ECONNREFUSED|ENOTFOUND|password authentication failed/i],
  ];
  return sinais.filter(([, padrao]) => padrao.test(corpo)).map(([nome]) => nome);
}

/** Mediana e percentil 90 (arredondados), para os tempos de resposta. */
export function estatisticas(valores: number[]): { n: number; mediana: number; p90: number; minimo: number; maximo: number } {
  if (valores.length === 0) return { n: 0, mediana: 0, p90: 0, minimo: 0, maximo: 0 };
  const ordenados = [...valores].sort((a, b) => a - b);
  const quantil = (q: number) => ordenados[Math.min(ordenados.length - 1, Math.ceil(q * ordenados.length) - 1)];
  return { n: ordenados.length, mediana: Math.round(quantil(0.5)), p90: Math.round(quantil(0.9)), minimo: Math.round(ordenados[0]), maximo: Math.round(ordenados.at(-1) as number) };
}
