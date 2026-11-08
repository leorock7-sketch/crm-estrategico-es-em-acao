import { appendFileSync } from "node:fs";

/**
 * Instrumentação de desempenho (P-071, E1). Desligada por padrão: só funciona quando
 * CRM_INSTRUMENTACAO aponta para um arquivo local (laboratório de latência). Registra, por transação,
 * apenas tempos e contagens: momento do pedido, início da transação (conexão obtida e BEGIN
 * concluído), identidade definida, consultas concluídas e fim (COMMIT). Nunca registra texto SQL,
 * parâmetros, usuários, dados ou credenciais; o único rótulo é o nome da primeira tabela citada,
 * que faz parte do esquema público do repositório.
 */
const ARQUIVO = process.env.CRM_INSTRUMENTACAO;

export type Medicao = {
  ponto(nome: "transacao" | "identidade" | "consultas"): void;
  contarConsulta(): void;
  concluir(falhou?: boolean): void;
};

const agora = () => performance.timeOrigin + performance.now();

function rotulo(consulta: string | undefined): string {
  return consulta?.match(/\bfrom\s+"?([a-z_]+)"?/i)?.[1] ?? consulta?.match(/\b(identificar_usuario)\b/)?.[1] ?? "-";
}

/** Inicia a medição de uma transação; devolve null (custo zero) quando a instrumentação está desligada. */
export function iniciarMedicao(tipo: "consulta" | "transacao", consulta?: string): Medicao | null {
  if (!ARQUIVO) return null;
  const inicio = agora();
  const marcas: Record<string, number> = {};
  let consultas = tipo === "consulta" ? 1 : 0;
  return {
    ponto(nome) {
      marcas[nome] = Math.round((agora() - inicio) * 10) / 10;
    },
    contarConsulta() {
      consultas++;
    },
    concluir(falhou = false) {
      const fim = Math.round((agora() - inicio) * 10) / 10;
      const registro = { t0: Math.round(inicio * 10) / 10, tipo, rotulo: rotulo(consulta), consultas, marcas, fim, falhou };
      try {
        appendFileSync(ARQUIVO, `${JSON.stringify(registro)}\n`);
      } catch {
        // A instrumentação nunca interfere na operação.
      }
    },
  };
}
