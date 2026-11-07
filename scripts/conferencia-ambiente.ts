/**
 * Regras da conferência do projeto Supabase de desenvolvimento (D-075). Os textos
 * devolvidos dizem apenas o que está certo ou o que corrigir: nunca contêm valores
 * das variáveis, porque o resultado aparece na tela e em relatórios.
 */
import { randomBytes } from "node:crypto";
import { closeSync, fstatSync, fsyncSync, openSync, rmSync, writeSync } from "node:fs";

export type SituacaoItem = "ok" | "pendente" | "problema";
export type ItemConferido = { item: string; situacao: SituacaoItem; detalhe: string };
export type Ambiente = Record<string, string | undefined>;

const REGIAO = "sa-east-1";
const POOLER_DA_REGIAO = new RegExp(`^aws-\\d+-${REGIAO}\\.pooler\\.supabase\\.com$`);

function preenchido(valor: string | undefined): valor is string {
  return Boolean(valor && valor.trim());
}

/** Identificador do projeto, tirado do endereço https://<identificador>.supabase.co. */
function referenciaDoProjeto(endereco: string | undefined): string | null {
  if (!preenchido(endereco)) return null;
  try {
    const url = new URL(endereco);
    const referencia = /^([a-z0-9]+)\.supabase\.co$/.exec(url.hostname)?.[1];
    return url.protocol === "https:" && url.pathname === "/" && referencia ? referencia : null;
  } catch {
    return null;
  }
}

/** Quem cola a linha inteira depois do sinal de igual fica com NOME=NOME=valor. */
const NOME_COLADO: Omit<ItemConferido, "item"> = {
  situacao: "problema",
  detalhe: "o nome do campo foi colado junto: deixe só o valor depois do sinal de igual",
};

function conferirEndereco(valor: string | undefined): ItemConferido {
  const item = "Endereço do projeto";
  if (!preenchido(valor)) return { item, situacao: "pendente", detalhe: "campo vazio" };
  if (valor.startsWith("NEXT_PUBLIC_")) return { item, ...NOME_COLADO };
  return referenciaDoProjeto(valor)
    ? { item, situacao: "ok", detalhe: "formato correto" }
    : { item, situacao: "problema", detalhe: "use somente o endereço https://....supabase.co, sem nada depois" };
}

function conferirChavePublica(valor: string | undefined): ItemConferido {
  const item = "Chave publishable";
  if (!preenchido(valor)) return { item, situacao: "pendente", detalhe: "campo vazio" };
  if (valor.startsWith("NEXT_PUBLIC_")) return { item, ...NOME_COLADO };
  if (valor.startsWith("sb_secret_")) {
    return { item, situacao: "problema", detalhe: "a chave secreta está neste campo, que vai para o navegador: corrija agora" };
  }
  if (valor.startsWith("sb_publishable_")) return { item, situacao: "ok", detalhe: "formato correto" };
  return { item, situacao: "problema", detalhe: "copie a chave que começa com sb_publishable_ (não a chave antiga anon)" };
}

function conferirChaveSecreta(valor: string | undefined): ItemConferido {
  const item = "Chave secreta";
  if (!preenchido(valor)) return { item, situacao: "pendente", detalhe: "campo vazio" };
  if (valor.startsWith("sb_secret_")) return { item, situacao: "ok", detalhe: "formato correto" };
  return { item, situacao: "problema", detalhe: "copie a chave que começa com sb_secret_ (não a chave antiga service_role)" };
}

function conferirConexaoAdministrativa(valor: string | undefined, referencia: string | null): ItemConferido {
  const item = "Conexão administrativa";
  if (!preenchido(valor)) return { item, situacao: "pendente", detalhe: "campo vazio" };
  if (valor.includes("[") || valor.includes("]")) {
    return { item, situacao: "problema", detalhe: "troque [YOUR-PASSWORD], inclusive os colchetes, pela senha do banco" };
  }
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return { item, situacao: "problema", detalhe: "não é uma conexão válida: copie novamente a opção Session pooler" };
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    return { item, situacao: "problema", detalhe: "não é uma conexão de banco: copie novamente a opção Session pooler" };
  }
  if (!url.hostname.endsWith(".pooler.supabase.com")) {
    return { item, situacao: "problema", detalhe: "esta é a conexão direta: copie a opção Session pooler" };
  }
  if (!POOLER_DA_REGIAO.test(url.hostname)) {
    return { item, situacao: "problema", detalhe: `o projeto não está em ${REGIAO}: interrompa e avise` };
  }
  if (url.port !== "5432") {
    return { item, situacao: "problema", detalhe: "esta é a opção Transaction pooler: copie a opção Session pooler" };
  }
  if (!url.password) return { item, situacao: "problema", detalhe: "falta a senha do banco na conexão" };
  if (referencia && url.username !== `postgres.${referencia}`) {
    return { item, situacao: "problema", detalhe: "a conexão não corresponde ao endereço do projeto informado acima" };
  }
  return { item, situacao: "ok", detalhe: `Session pooler, região ${REGIAO}` };
}

function conferirConexaoDaAplicacao(valor: string | undefined): ItemConferido {
  const item = "Conexão da aplicação (crm_app)";
  if (!preenchido(valor)) {
    return { item, situacao: "pendente", detalhe: "será preenchida pelo Claude ao criar o papel crm_app; deixe em branco" };
  }
  try {
    return new URL(valor).username.startsWith("crm_app.")
      ? { item, situacao: "ok", detalhe: "usa o papel crm_app" }
      : { item, situacao: "problema", detalhe: "a aplicação só pode usar o papel crm_app, nunca um papel privilegiado" };
  } catch {
    return { item, situacao: "problema", detalhe: "não é uma conexão válida" };
  }
}

const TAMANHO_MINIMO_SENHA = 16;

/** Só o tamanho: o valor nunca sai daqui. */
function conferirForcaDaSenha(conexao: string | undefined): ItemConferido {
  const item = "Força da senha administrativa";
  if (!preenchido(conexao)) return { item, situacao: "pendente", detalhe: "conexão não informada" };
  try {
    const tamanho = decodeURIComponent(new URL(conexao).password).length;
    return tamanho >= TAMANHO_MINIMO_SENHA
      ? { item, situacao: "ok", detalhe: `${TAMANHO_MINIMO_SENHA} caracteres ou mais` }
      : { item, situacao: "problema", detalhe: `menos de ${TAMANHO_MINIMO_SENHA} caracteres: troque por uma senha forte, gerada aleatoriamente` };
  } catch {
    return { item, situacao: "problema", detalhe: "não foi possível conferir" };
  }
}

/** Senha forte, aleatória, só com letras e números: dispensa qualquer ajuste na conexão. */
export function gerarSenhaForte(bytesAleatorios: (quantidade: number) => Uint8Array, tamanho = 40): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // Descarta os valores que tornariam algumas letras mais prováveis do que outras.
  const limite = 256 - (256 % alfabeto.length);
  let senha = "";
  while (senha.length < tamanho) {
    for (const byte of bytesAleatorios(tamanho * 2)) {
      if (byte < limite && senha.length < tamanho) senha += alfabeto[byte % alfabeto.length];
    }
  }
  return senha;
}

/**
 * Sobrescreve o conteúdo com valores aleatórios, grava em disco e só então apaga. Melhor esforço:
 * em discos SSD, o sistema pode manter cópias físicas antigas, fora do alcance de um programa.
 */
export function eliminarArquivoComSobrescrita(caminho: string) {
  const descritor = openSync(caminho, "r+");
  try {
    writeSync(descritor, randomBytes(Math.max(fstatSync(descritor).size, 64)));
    fsyncSync(descritor);
  } finally {
    closeSync(descritor);
  }
  rmSync(caminho);
}

/** Conexão igual à atual, com outra senha, já no formato aceito em conexões. */
export function conexaoComNovaSenha(conexao: string, senha: string): string {
  const url = new URL(conexao);
  url.password = encodeURIComponent(senha);
  return url.toString();
}

/** Nada que vá para o navegador (prefixo NEXT_PUBLIC_) pode conter segredo. */
function conferirCamposPublicos(ambiente: Ambiente): ItemConferido {
  const item = "Campos enviados ao navegador";
  const expostos = Object.entries(ambiente).filter(
    ([nome, valor]) => nome.startsWith("NEXT_PUBLIC_") && valor && /sb_secret_|postgres(ql)?:\/\//.test(valor),
  );
  return expostos.length === 0
    ? { item, situacao: "ok", detalhe: "nenhum segredo neles" }
    : { item, situacao: "problema", detalhe: `há segredo em: ${expostos.map(([nome]) => nome).join(", ")}` };
}

export function conferirVariaveis(ambiente: Ambiente): ItemConferido[] {
  const endereco = ambiente.NEXT_PUBLIC_SUPABASE_URL;
  return [
    conferirEndereco(endereco),
    conferirChavePublica(ambiente.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    conferirChaveSecreta(ambiente.SUPABASE_SECRET_KEY),
    conferirConexaoAdministrativa(ambiente.CRM_BANCO_ADMIN_URL, referenciaDoProjeto(endereco)),
    conferirForcaDaSenha(ambiente.CRM_BANCO_ADMIN_URL),
    conferirConexaoDaAplicacao(ambiente.CRM_BANCO_URL),
    conferirCamposPublicos(ambiente),
  ];
}

/** Interpreta a resposta pública de /auth/v1/settings: acesso fechado, com e-mail e senha ligado. */
export function conferirAjustesDeAutenticacao(ajustes: {
  disable_signup?: boolean;
  external?: { email?: boolean };
}): ItemConferido[] {
  return [
    ajustes.disable_signup === true
      ? { item: "Autocadastro público", situacao: "ok", detalhe: "desligado" }
      : { item: "Autocadastro público", situacao: "problema", detalhe: "desligue Allow new users to sign up" },
    ajustes.external?.email === true
      ? { item: "Login por e-mail e senha", situacao: "ok", detalhe: "ligado" }
      : { item: "Login por e-mail e senha", situacao: "problema", detalhe: "mantenha ligado o provedor Email" },
  ];
}

/** Explica a falha de conexão só pelo código do erro: a mensagem original pode conter dados da conexão. */
export function explicarFalhaDeConexao(codigo: unknown): string {
  switch (codigo) {
    case "28P01":
      return "senha do banco recusada: confira a senha colocada na conexão";
    case "XX000":
      return "projeto ou usuário não reconhecido: copie novamente a opção Session pooler";
    case "ENOTFOUND":
      return "endereço não encontrado: copie novamente a opção Session pooler";
    case "ECONNREFUSED":
    case "ETIMEDOUT":
    case "CONNECT_TIMEOUT":
      return "sem resposta: confira a internet e se o projeto não está pausado";
    default:
      return "não foi possível conectar: copie novamente a opção Session pooler";
  }
}
