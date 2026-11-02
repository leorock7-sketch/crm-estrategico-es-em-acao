/**
 * Conexão com o banco de dados de desenvolvimento (PGlite — decisão D-018).
 *
 * O PGlite é um PostgreSQL completo executado dentro da própria aplicação; os
 * dados ficam na pasta .dados/pglite (ignorada pelo Git). Ao abrir o banco, os
 * scripts de ./migracoes ainda não aplicados são executados automaticamente.
 *
 * Uso exclusivo em desenvolvimento e testes, com dados fictícios. Na etapa de
 * hospedagem, esta conexão será substituída pela do Supabase, reaproveitando
 * os mesmos scripts de criação.
 */
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as esquema from "./esquema";
import { alinharValoresNormalizados } from "./normalizacao";
import { adquirirTrava, liberarTrava } from "./trava";

function criarBanco(cliente: PGlite) {
  return drizzle(cliente, { schema: esquema });
}

export type Banco = ReturnType<typeof criarBanco>;
export type Transacao = Parameters<Parameters<Banco["transaction"]>[0]>[0];
/** Banco ou transação: as consultas funcionam com qualquer um dos dois. */
export type Executor = Banco | Transacao;

const PASTA_MIGRACOES = path.join(process.cwd(), "src", "lib", "banco", "migracoes");

/** Pasta dos dados locais (caminho fixo, para que o Next.js não inclua o projeto inteiro na compilação). */
export function diretorioDoBanco(): string {
  return path.join(process.cwd(), ".dados", "pglite");
}

/**
 * Proteção de ambiente (correção C3): em produção, o banco local só é aceito
 * com autorização explícita (CRM_BANCO=pglite), destinada a testes locais da
 * versão compilada. Assim, dados reais nunca são gravados nele por engano.
 */
export function verificarUsoDoBancoLocal(ambiente: NodeJS.ProcessEnv = process.env): void {
  if (ambiente.NODE_ENV === "production" && ambiente.CRM_BANCO !== "pglite") {
    throw new Error(
      "O banco local de desenvolvimento (PGlite) não pode ser usado em produção. Configure a " +
        "conexão definitiva do banco ou, apenas para testes locais da versão compilada, defina " +
        "CRM_BANCO=pglite no arquivo .env.local.",
    );
  }
}

const pastasAbertas = new WeakMap<Banco, string>();

/** Aplica os scripts pendentes e realinha os valores normalizados (ver normalizacao.ts). */
async function prepararBanco(banco: Banco, pastaMigracoes: string) {
  await migrate(banco, { migrationsFolder: pastaMigracoes });
  await alinharValoresNormalizados(banco);
}

/** Copia a pasta de dados; usada antes de aplicar atualizações pendentes (T-1). */
export type Copiadora = (origem: string, destino: string) => void;

const copiarPasta: Copiadora = (origem, destino) => cpSync(origem, destino, { recursive: true, errorOnExist: true, force: false });

/** Pasta da cópia de segurança, ao lado dos dados: por exemplo, .dados/copias/antes-migracao-<data e hora>. */
export function pastaDaCopiaAntesDeMigrar(diretorio: string, agora = new Date()): string {
  return path.join(path.dirname(diretorio), "copias", `antes-migracao-${agora.toISOString().replace(/[:.]/g, "-")}`);
}

/**
 * Quantas atualizações do diário já foram aplicadas e quantas estão pendentes.
 * O migrador do Drizzle aplica as que têm data posterior à última registrada.
 */
async function situacaoDasMigracoes(cliente: PGlite, pastaMigracoes: string) {
  const diario = JSON.parse(readFileSync(path.join(pastaMigracoes, "meta", "_journal.json"), "utf8")) as {
    entries: { when: number }[];
  };
  const tabela = await cliente.query<{ existe: boolean }>(
    "select to_regclass('drizzle.__drizzle_migrations') is not null as existe",
  );
  if (!tabela.rows[0]?.existe) return { aplicadas: 0, pendentes: diario.entries.length };
  const ultima = await cliente.query<{ quando: string | null; total: number }>(
    "select max(created_at)::text as quando, count(*)::int as total from drizzle.__drizzle_migrations",
  );
  const quando = Number(ultima.rows[0]?.quando ?? 0);
  return { aplicadas: ultima.rows[0]?.total ?? 0, pendentes: diario.entries.filter((e) => e.when > quando).length };
}

export type OpcoesAbertura = {
  /** Pasta dos scripts (os testes de atualização usam uma pasta parcial). */
  pastaMigracoes?: string;
  /** Substitui a cópia da pasta de dados (usado nos testes). */
  copiar?: Copiadora;
};

/**
 * Abre um banco e aplica os scripts pendentes. Sem diretório, o banco fica
 * apenas na memória (usado nos testes automatizados). Com diretório, obtém
 * antes a trava exclusiva da pasta (ver trava.ts) e, se um banco já existente
 * tiver atualizações pendentes, copia a pasta de dados antes de aplicá-las;
 * se a cópia falhar, nada é aplicado (T-1).
 */
export async function abrirBanco(diretorio?: string, opcoes: OpcoesAbertura = {}): Promise<Banco> {
  const pastaMigracoes = opcoes.pastaMigracoes ?? PASTA_MIGRACOES;
  if (!diretorio) {
    const banco = criarBanco(new PGlite());
    await prepararBanco(banco, pastaMigracoes);
    return banco;
  }

  mkdirSync(diretorio, { recursive: true });
  adquirirTrava(diretorio);
  try {
    let cliente = new PGlite(diretorio);
    const { aplicadas, pendentes } = await situacaoDasMigracoes(cliente, pastaMigracoes);
    if (aplicadas > 0 && pendentes > 0) {
      await cliente.close();
      const destino = pastaDaCopiaAntesDeMigrar(diretorio);
      try {
        (opcoes.copiar ?? copiarPasta)(diretorio, destino);
      } catch (erro) {
        throw new Error(
          `Há ${pendentes} atualização(ões) pendente(s) do banco local, mas a cópia de segurança em ${destino} ` +
            "falhou. Nenhuma atualização foi aplicada: resolva o problema (por exemplo, espaço em disco) e tente novamente.",
          { cause: erro },
        );
      }
      cliente = new PGlite(diretorio);
    }
    const banco = criarBanco(cliente);
    await prepararBanco(banco, pastaMigracoes);
    pastasAbertas.set(banco, diretorio);
    return banco;
  } catch (erro) {
    liberarTrava(diretorio);
    throw erro;
  }
}

/** Fecha o banco e libera a trava da pasta (usado pelos scripts de manutenção). */
export async function fecharBanco(banco: Banco): Promise<void> {
  await banco.$client.close();
  const diretorio = pastasAbertas.get(banco);
  if (diretorio) liberarTrava(diretorio);
}

const global = globalThis as typeof globalThis & { __bancoCrm?: Promise<Banco> };

/** Banco compartilhado pela aplicação (uma única conexão por processo). */
export function obterBanco(): Promise<Banco> {
  verificarUsoDoBancoLocal();
  global.__bancoCrm ??= abrirBanco(diretorioDoBanco()).catch((erro) => {
    // Permite nova tentativa depois que o outro programa liberar o banco.
    global.__bancoCrm = undefined;
    throw erro;
  });
  return global.__bancoCrm;
}

/**
 * Executa operações em uma transação, registrando o usuário responsável. Os
 * gatilhos do banco usam essa informação na trilha de auditoria.
 */
export async function comoUsuario<T>(
  banco: Banco,
  usuarioId: string,
  operacao: (tx: Transacao) => Promise<T>,
): Promise<T> {
  return banco.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.usuario_id', ${usuarioId}, true)`);
    return operacao(tx);
  });
}
