/**
 * Retenção das cópias (D-082): 7 diárias, 4 semanais e 3 mensais. Fica a mais recente de cada dia
 * dos últimos 7 dias, de cada semana das últimas 4 semanas e de cada mês dos últimos 3 meses; a
 * cópia mais recente nunca é descartada. Só considera pastas com o nome padrão das cópias.
 */
import { PREFIXO_COPIA } from "./comum";

const PADRAO = /^crm-backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})$/;

/** Data da cópia, no horário de Brasília em que o nome foi gravado (tratado como UTC só para contar). */
function dataDaCopia(nome: string): Date | null {
  const m = PADRAO.exec(nome);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
}

function semanaIso(data: Date): string {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-S${Math.ceil(((d.getTime() - inicioAno.getTime()) / 864e5 + 1) / 7)}`;
}

export function selecionarParaManter(nomes: readonly string[], agora: Date, regra = { diarias: 7, semanais: 4, mensais: 3 }): Set<string> {
  const copias = nomes
    .filter((n) => n.startsWith(PREFIXO_COPIA))
    .map((nome) => ({ nome, data: dataDaCopia(nome) }))
    .filter((c): c is { nome: string; data: Date } => c.data !== null)
    .sort((a, b) => b.data.getTime() - a.data.getTime());
  const manter = new Set<string>();
  if (copias[0]) manter.add(copias[0].nome);
  // Mesmo referencial do nome (Brasília), para comparar datas na mesma base.
  const referencia = agora.getTime() - 3 * 36e5;
  const escolher = (dias: number, chave: (d: Date) => string, quantidade: number) => {
    const vistos = new Set<string>();
    for (const c of copias) {
      if (referencia - c.data.getTime() > dias * 864e5) break;
      const k = chave(c.data);
      if (vistos.has(k) || vistos.size >= quantidade) continue;
      vistos.add(k);
      manter.add(c.nome);
    }
  };
  escolher(regra.diarias, (d) => d.toISOString().slice(0, 10), regra.diarias);
  escolher(regra.semanais * 7, semanaIso, regra.semanais);
  escolher(regra.mensais * 31, (d) => d.toISOString().slice(0, 7), regra.mensais);
  return manter;
}
