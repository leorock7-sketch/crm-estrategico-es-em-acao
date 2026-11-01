import Link from "next/link";
import { classeCelula, classeCelulaCabecalho, classeLink, classeTabela } from "@/componentes/estilos";
import { formatarData, formatarNumero } from "@/lib/formatacao";
import type { ClassificacaoMatriz } from "../matriz";
import { POSICIONAMENTOS, ROTULO_NAO_AVALIADO, ROTULOS_GRAU_CONFIANCA, ROTULOS_POSICIONAMENTO } from "../rotulos";
import { COR_POSICIONAMENTO, SeloPosicionamento } from "./selo-posicionamento";

type PontoDaMatriz = ClassificacaoMatriz["noGrafico"][number];

const LARGURA = 520;
const ALTURA = 420;
const MARGEM = { esquerda: 52, direita: 24, topo: 16, base: 56 };
const AREA_X = LARGURA - MARGEM.esquerda - MARGEM.direita;
const AREA_Y = ALTURA - MARGEM.topo - MARGEM.base;
const MARCAS = [0, 25, 50, 75, 100];

const xDe = (interesse: number) => MARGEM.esquerda + (interesse / 100) * AREA_X;
const yDe = (poder: number) => MARGEM.topo + AREA_Y - (poder / 100) * AREA_Y;

/** Afasta pontos com valores iguais, para que nenhum fique escondido atrás de outro. */
function posicoes(pontos: PontoDaMatriz[]) {
  const grupos = new Map<string, number[]>();
  pontos.forEach((p, indice) => {
    const chave = `${p.vigente.interesse}|${p.vigente.poder}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), indice]);
  });
  const resultado: { x: number; y: number }[] = [];
  for (const indices of grupos.values()) {
    indices.forEach((indice, ordem) => {
      const p = pontos[indice];
      const base = { x: xDe(p.vigente.interesse ?? 0), y: yDe(p.vigente.poder ?? 0) };
      if (indices.length === 1) {
        resultado[indice] = base;
        return;
      }
      const angulo = (2 * Math.PI * ordem) / indices.length;
      resultado[indice] = { x: base.x + 14 * Math.cos(angulo), y: base.y + 14 * Math.sin(angulo) };
    });
  }
  return resultado;
}

/**
 * Matriz de poder × interesse de um contexto: somente avaliações da metodologia
 * vigente. Os eixos são separados do posicionamento (cor do ponto). Não há
 * pontos de corte homologados, por isso não há quadrantes nomeados (Q-05).
 * Cada ponto tem número (ligado à tabela), dica ao passar o mouse e link para a ficha.
 */
export function MatrizPoderInteresse({
  pontos,
  caminhoFicha,
}: {
  pontos: PontoDaMatriz[];
  caminhoFicha: (stakeholderId: string) => string;
}) {
  const coordenadas = posicoes(pontos);
  return (
    <figure className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda do posicionamento">
        {POSICIONAMENTOS.map((p) => (
          <li key={p}>
            <SeloPosicionamento posicionamento={p} />
          </li>
        ))}
        <li>
          <SeloPosicionamento posicionamento={null} />
        </li>
        <li className="inline-flex items-center gap-1.5 text-sm">
          <span
            aria-hidden="true"
            className="inline-block size-3 rounded-full border-2 border-dashed"
            style={{ borderColor: "var(--alerta-revisao)" }}
          />
          Revisão anual vencida
        </li>
      </ul>

      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="h-auto w-full max-w-3xl"
        role="img"
        aria-label={`Matriz de poder e interesse com ${pontos.length} stakeholders. Os mesmos dados estão na tabela abaixo.`}
      >
        {MARCAS.map((m) => (
          <g key={m}>
            <line x1={xDe(m)} x2={xDe(m)} y1={MARGEM.topo} y2={MARGEM.topo + AREA_Y} stroke="var(--borda)" />
            <line x1={MARGEM.esquerda} x2={MARGEM.esquerda + AREA_X} y1={yDe(m)} y2={yDe(m)} stroke="var(--borda)" />
            <text x={xDe(m)} y={MARGEM.topo + AREA_Y + 22} textAnchor="middle" fontSize="14" fill="var(--texto-secundario)">
              {m}
            </text>
            <text x={MARGEM.esquerda - 8} y={yDe(m) + 4} textAnchor="end" fontSize="14" fill="var(--texto-secundario)">
              {m}
            </text>
          </g>
        ))}
        <text
          x={MARGEM.esquerda + AREA_X / 2}
          y={ALTURA - 10}
          textAnchor="middle"
          fontSize="15"
          fill="var(--texto)"
        >
          Interesse →
        </text>
        <text
          x={16}
          y={MARGEM.topo + AREA_Y / 2}
          textAnchor="middle"
          fontSize="15"
          fill="var(--texto)"
          transform={`rotate(-90 16 ${MARGEM.topo + AREA_Y / 2})`}
        >
          Poder →
        </text>

        {pontos.map((p, indice) => {
          const { x, y } = coordenadas[indice];
          const numero = indice + 1;
          const posicao = p.vigente.posicionamento;
          return (
            <a key={p.stakeholderId} href={caminhoFicha(p.stakeholderId)}>
              <title>
                {`${numero}. ${p.nome} — poder ${formatarNumero(p.vigente.poder ?? 0)}, interesse ${formatarNumero(p.vigente.interesse ?? 0)}; ${
                  posicao ? ROTULOS_POSICIONAMENTO[posicao] : ROTULO_NAO_AVALIADO
                }${p.vigente.grauConfianca ? `; confiança ${ROTULOS_GRAU_CONFIANCA[p.vigente.grauConfianca].toLowerCase()}` : ""}${
                  p.revisaoVencida ? "; revisão anual vencida" : ""
                }`}
              </title>
              {/* Área de toque maior que o ponto. */}
              <circle cx={x} cy={y} r={18} fill="transparent" />
              {p.revisaoVencida && (
                <circle cx={x} cy={y} r={14} fill="none" stroke="var(--alerta-revisao)" strokeWidth={2} strokeDasharray="3 3" />
              )}
              <circle
                cx={x}
                cy={y}
                r={10}
                fill={posicao ? COR_POSICIONAMENTO[posicao] : "var(--superficie)"}
                stroke={posicao ? "var(--superficie)" : "var(--texto-secundario)"}
                strokeWidth={2}
                strokeDasharray={posicao ? undefined : "3 2"}
              />
              <text x={x + 14} y={y - 10} fontSize="15" fontWeight="600" fill="var(--texto)">
                {numero}
              </text>
            </a>
          );
        })}
      </svg>
      <figcaption className="text-xs text-texto-secundario">
        Eixos de 0 a 100. Não há pontos de corte homologados: as linhas são apenas referência de escala, sem
        quadrantes. A cor indica o posicionamento, que é avaliado separadamente do poder e do interesse.
      </figcaption>

      <div className="overflow-x-auto rounded-lg border border-borda">
        <table className={classeTabela}>
          <caption className="sr-only">Avaliações da matriz</caption>
          <thead>
            <tr>
              <th scope="col" className={classeCelulaCabecalho}>#</th>
              <th scope="col" className={classeCelulaCabecalho}>Stakeholder</th>
              <th scope="col" className={`${classeCelulaCabecalho} text-right`}>Poder</th>
              <th scope="col" className={`${classeCelulaCabecalho} text-right`}>Interesse</th>
              <th scope="col" className={classeCelulaCabecalho}>Posicionamento</th>
              <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>Confiança</th>
              <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>Referência</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p, indice) => (
              <tr key={p.stakeholderId}>
                <td className={`${classeCelula} tabular-nums`}>{indice + 1}</td>
                <td className={classeCelula}>
                  <Link href={caminhoFicha(p.stakeholderId)} className={classeLink}>
                    {p.nome}
                  </Link>
                  {p.revisaoVencida && (
                    <span className="mt-0.5 block text-xs font-medium" style={{ color: "var(--alerta-revisao)" }}>
                      ⚠ Revisão anual vencida
                    </span>
                  )}
                </td>
                <td className={`${classeCelula} text-right tabular-nums`}>{formatarNumero(p.vigente.poder ?? 0)}</td>
                <td className={`${classeCelula} text-right tabular-nums`}>{formatarNumero(p.vigente.interesse ?? 0)}</td>
                <td className={classeCelula}>
                  <SeloPosicionamento posicionamento={p.vigente.posicionamento} />
                </td>
                <td className={`${classeCelula} hidden md:table-cell`}>
                  {p.vigente.grauConfianca ? ROTULOS_GRAU_CONFIANCA[p.vigente.grauConfianca] : "Não informado"}
                </td>
                <td className={`${classeCelula} hidden md:table-cell`}>{formatarData(p.vigente.dataReferencia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
