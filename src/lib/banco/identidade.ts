/**
 * Conexões com identidade (Etapa 5, D-074 e D-075). É aqui que a identidade autenticada
 * chega ao PostgreSQL: toda operação feita por um banco devolvido por comIdentidade() ocorre
 * em uma transação que, antes de qualquer coisa, informa o usuário ao banco. As regras de
 * acesso (RLS, migração 0009) leem esse dado e, sem ele, devolvem zero linhas.
 *
 * Não há como executar uma consulta desse banco fora da transação com identidade: o desvio
 * é feito no cliente do driver, abaixo de todas as consultas do Drizzle, inclusive as da
 * aplicação que não sabem nada sobre sessão.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { Sql, TransactionSql } from "postgres";
import type { Banco } from "./conexao";
import { iniciarMedicao, type Medicao } from "./instrumentacao";
import * as esquema from "./esquema";

/** Registra o fim da transação medida (laboratório, P-071); o resultado e os erros passam intactos. */
function concluirMedicao<T>(execucao: Promise<T>, medicao: Medicao): Promise<T> {
  return execucao.then(
    (resultado) => {
      medicao.concluir();
      return resultado;
    },
    (erro: unknown) => {
      medicao.concluir(true);
      throw erro;
    },
  );
}

type Parametros = Parameters<Sql["unsafe"]>[1];
type Opcoes = Parameters<Sql["unsafe"]>[2];

/** O driver postgres devolve uma lista; o Drizzle com PGlite, um objeto com rows. Aceita-se os dois formatos. */
function comRows<T extends object>(resultado: T): T {
  Object.defineProperty(resultado, "rows", { value: resultado, enumerable: false, configurable: true });
  return resultado;
}

/** Consulta adiada no formato que o Drizzle espera: aguardar, ou pedir .values(). */
function consultaAdiada(executar: (comoValores: boolean) => Promise<object>) {
  return {
    values: () => executar(true),
    then: <A, B>(aoConcluir: (v: never) => A, aoFalhar?: (e: unknown) => B) =>
      executar(false)
        .then((r) => comRows(r) as never)
        .then(aoConcluir, aoFalhar),
  };
}

/** Cliente de transação do driver postgres, com o formato comum de resultado. */
export function transacaoPostgres(tx: TransactionSql, medicao?: Medicao | null): TransactionSql {
  return new Proxy(tx, {
    get(alvo, propriedade, receptor) {
      if (propriedade === "unsafe") {
        return (consulta: string, parametros?: Parametros, opcoes?: Opcoes) =>
          consultaAdiada((comoValores) => {
            medicao?.contarConsulta();
            const pendente = alvo.unsafe(consulta, parametros, opcoes);
            return comoValores ? pendente.values() : pendente;
          });
      }
      if (propriedade === "savepoint") {
        return (operacao: (t: TransactionSql) => unknown) =>
          alvo.savepoint((t) => operacao(transacaoPostgres(t as unknown as TransactionSql)) as never);
      }
      return Reflect.get(alvo, propriedade, receptor);
    },
  });
}

/** Cliente do driver postgres sem identidade, para os comandos administrativos: só uniformiza os resultados. */
export function clientePostgresBase(sql: Sql): Sql {
  return new Proxy(sql, {
    get(alvo, propriedade, receptor) {
      if (propriedade === "unsafe") {
        return (consulta: string, parametros?: Parametros, opcoes?: Opcoes) =>
          consultaAdiada((comoValores) => {
            const pendente = alvo.unsafe(consulta, parametros, opcoes);
            return comoValores ? pendente.values() : pendente;
          });
      }
      if (propriedade === "begin") {
        return (...argumentos: unknown[]) => {
          const operacao = argumentos[argumentos.length - 1] as (tx: TransactionSql) => unknown;
          const prefixo = argumentos.slice(0, -1) as [string];
          return alvo.begin(...prefixo, (tx: TransactionSql) => operacao(transacaoPostgres(tx)));
        };
      }
      return Reflect.get(alvo, propriedade, receptor);
    },
  });
}

/** Cliente do driver postgres em que tudo passa por uma transação preparada antes da operação. */
function clientePostgres(sql: Sql, preparar: (tx: TransactionSql) => Promise<unknown>): Sql {
  return new Proxy(sql, {
    get(alvo, propriedade, receptor) {
      if (propriedade === "unsafe") {
        return (consulta: string, parametros?: Parametros, opcoes?: Opcoes) =>
          consultaAdiada((comoValores) => {
            const medicao = iniciarMedicao("consulta", consulta);
            const execucao = alvo.begin(async (tx) => {
              medicao?.ponto("transacao");
              await preparar(tx);
              medicao?.ponto("identidade");
              const pendente = tx.unsafe(consulta, parametros, opcoes);
              if (!medicao) return comoValores ? pendente.values() : pendente;
              const resultado = await (comoValores ? pendente.values() : pendente);
              medicao.ponto("consultas");
              return resultado;
            }) as unknown as Promise<object>;
            return medicao ? concluirMedicao(execucao, medicao) : execucao;
          });
      }
      if (propriedade === "begin") {
        return (...argumentos: unknown[]) => {
          const operacao = argumentos[argumentos.length - 1] as (tx: TransactionSql) => unknown;
          const prefixo = argumentos.slice(0, -1) as [string];
          const medicao = iniciarMedicao("transacao");
          const execucao = alvo.begin(...prefixo, async (tx: TransactionSql) => {
            medicao?.ponto("transacao");
            await preparar(tx);
            medicao?.ponto("identidade");
            return operacao(transacaoPostgres(tx, medicao));
          });
          return medicao ? concluirMedicao(execucao, medicao) : execucao;
        };
      }
      return Reflect.get(alvo, propriedade, receptor);
    },
  });
}

/** Mesmo desvio para o PGlite, que conecta como superusuário: por isso, troca o papel na transação. */
function clientePglite(cliente: PGlite, preparar: (tx: { query: PGlite["query"] }) => Promise<unknown>): PGlite {
  return new Proxy(cliente, {
    get(alvo, propriedade) {
      if (propriedade === "query") {
        return (consulta: string, parametros?: unknown[], opcoes?: object) =>
          alvo.transaction(async (tx) => {
            await preparar(tx as never);
            return tx.query(consulta, parametros, opcoes);
          });
      }
      if (propriedade === "transaction") {
        return (operacao: (tx: unknown) => unknown) =>
          alvo.transaction(async (tx) => {
            await preparar(tx as never);
            return operacao(tx);
          });
      }
      const valor = Reflect.get(alvo, propriedade, alvo);
      return typeof valor === "function" ? valor.bind(alvo) : valor;
    },
  });
}

const bancosComIdentidade = new WeakSet<object>();

/** Indica se o banco informado já opera com identidade (ou seja, sob as regras de acesso). */
export function temIdentidade(banco: object): boolean {
  return bancosComIdentidade.has(banco);
}

/**
 * Banco cujas operações ocorrem no contexto de um usuário. Com `usuarioId` nulo, nenhuma
 * identidade é informada: as regras negam tudo, o que é o comportamento esperado de
 * qualquer erro de programação (nega o acesso, em vez de abrir).
 */
export function comIdentidade(banco: Banco, usuarioId: string | null): Banco {
  const identidade = usuarioId ?? "";
  const cliente = banco.$client as unknown;

  if (cliente instanceof PGlite) {
    const comContexto = clientePglite(cliente, async (tx) => {
      await tx.query("set local role crm_app");
      await tx.query("select set_config('app.usuario_id', $1, true)", [identidade]);
    });
    const bancoLocal = drizzlePglite({ client: comContexto, schema: esquema }) as unknown as Banco;
    bancosComIdentidade.add(bancoLocal);
    return bancoLocal;
  }

  const comContexto = clientePostgres(cliente as Sql, (tx) => tx`select set_config('app.usuario_id', ${identidade}, true)`);
  const bancoPostgres = drizzlePostgres({ client: comContexto, schema: esquema }) as unknown as Banco;
  bancosComIdentidade.add(bancoPostgres);
  return bancoPostgres;
}
