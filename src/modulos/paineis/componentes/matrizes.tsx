import Link from "next/link";
import { classeCelula, classeCelulaCabecalho, classeLink, classeTabela } from "@/componentes/estilos";
import { ComparacaoInerenteResidual, LegendaFaixas, MatrizRiscos, ResumoAvaliacao } from "@/modulos/riscos/componentes/matriz-riscos";
import type { RiscoDoPainel } from "../dados";

/** As duas matrizes 5 × 5, com as faixas aprovadas: inerente e residual, sem percentuais (D-072). */
export function MatrizesDeRiscos({ riscos }: { riscos: RiscoDoPainel[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <MatrizRiscos titulo="Risco inerente" descricao="Última avaliação inerente de cada risco." avaliacoes={riscos.map((r) => r.inerente)} />
        <MatrizRiscos titulo="Risco residual" descricao="Última avaliação residual, quando registrada." avaliacoes={riscos.map((r) => r.residual)} />
      </div>
      <LegendaFaixas />
    </div>
  );
}

/** Inerente e residual de cada risco, lado a lado, em pontos e faixas. */
export function ComparacaoDosRiscos({ riscos }: { riscos: RiscoDoPainel[] }) {
  if (riscos.length === 0) return <p className="text-sm text-texto-secundario">Nenhum risco registrado.</p>;
  return (
    <div className="overflow-x-auto">
      <table className={classeTabela}>
        <thead>
          <tr>
            {["Risco", "Inerente", "Residual", "Comparação"].map((c) => (
              <th key={c} scope="col" className={classeCelulaCabecalho}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {riscos.map((r) => (
            <tr key={r.id}>
              <th scope="row" className={`${classeCelula} font-normal`}>
                <Link href={`/riscos/${r.id}`} className={classeLink}>
                  {r.codigo} — {r.titulo}
                </Link>
              </th>
              <td className={classeCelula}>{r.inerente ? <ResumoAvaliacao avaliacao={r.inerente} /> : "Sem avaliação"}</td>
              <td className={classeCelula}>{r.residual ? <ResumoAvaliacao avaliacao={r.residual} /> : "Sem avaliação residual"}</td>
              <td className={classeCelula}>
                <ComparacaoInerenteResidual inerente={r.inerente} residual={r.residual} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
