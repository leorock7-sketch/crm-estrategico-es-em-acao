import Link from "next/link";
import { classeCelula, classeCelulaCabecalho, classeLink, classeTabela } from "@/componentes/estilos";
import { formatarData } from "@/lib/formatacao";
import { agruparPorCelula, type ClassificacaoMatriz, nomeDaCelula } from "../matriz";
import {
  type Nivel,
  POSICIONAMENTOS_VIGENTES,
  posicionamentoPreliminar,
  ROTULO_NAO_AVALIADO,
  ROTULOS_GRAU_CONFIANCA,
  ROTULOS_NIVEL,
  ROTULOS_POSICIONAMENTO,
} from "../rotulos";
import {
  COR_POSICIONAMENTO,
  SeloPosicionamento,
  SeloPreliminar,
  SIMBOLO_NAO_AVALIADO,
  SIMBOLO_POSICIONAMENTO,
} from "./selo-posicionamento";

type FichaDaGrade = ClassificacaoMatriz["noGrafico"][number];

/** Linhas de cima para baixo (poder) e colunas da esquerda para a direita (interesse). */
const PODER_DE_CIMA_PARA_BAIXO: Nivel[] = ["alto", "medio", "baixo"];
const INTERESSE_DA_ESQUERDA: Nivel[] = ["baixo", "medio", "alto"];

/**
 * Grade ordinal 3 × 3 de poder × interesse (D-058, T-5): células nomeadas como
 * na Metodologia (seção 6.1), com a quantidade e os nomes de cada célula. O
 * posicionamento é cor e símbolo, nunca eixo (D-059); o selo "preliminar"
 * marca a informação sem manifestação formal (D-068). A célula é uma leitura,
 * nunca uma conduta (RF-28). A tabela abaixo traz os mesmos dados.
 */
export function MatrizTresPorTres({
  fichas,
  caminhoFicha,
}: {
  fichas: FichaDaGrade[];
  caminhoFicha: (stakeholderId: string) => string;
}) {
  const celulas = agruparPorCelula(fichas);
  return (
    <figure className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda do posicionamento">
        {POSICIONAMENTOS_VIGENTES.map((p) => (
          <li key={p}>
            <SeloPosicionamento posicionamento={p} />
          </li>
        ))}
        <li>
          <SeloPosicionamento posicionamento={null} />
        </li>
        <li className="inline-flex items-center gap-1.5 text-sm">
          <SeloPreliminar /> sem manifestação formal (no celular, contorno tracejado no marcador)
        </li>
        <li className="inline-flex items-center gap-1.5 text-sm">
          <span aria-hidden="true" style={{ color: "var(--alerta-revisao)" }}>
            ⚠
          </span>
          Revisão anual vencida
        </li>
      </ul>

      <p className="text-xs text-texto-secundario sm:hidden">
        No celular, a grade mostra a quantidade e os marcadores de cada célula; os nomes estão na tabela abaixo.
      </p>
      <div className="overflow-x-auto">
        <div
          className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1 text-sm"
          role="table"
          aria-label={`Matriz de poder e interesse com ${fichas.length} stakeholders. Os mesmos dados estão na tabela abaixo.`}
        >
          <div role="row" className="contents">
            <div role="columnheader" className="p-1 text-xs text-texto-secundario sm:p-2">
              <span className="sm:hidden">P ↓ · I →</span>
              <span className="hidden sm:inline">Poder ↓ · Interesse →</span>
            </div>
            {INTERESSE_DA_ESQUERDA.map((interesse) => (
              <div key={interesse} role="columnheader" className="p-1 text-center text-xs font-semibold sm:p-2">
                <span className="sm:hidden">I. {ROTULOS_NIVEL[interesse].toLowerCase()}</span>
                <span className="hidden sm:inline">Interesse {ROTULOS_NIVEL[interesse].toLowerCase()}</span>
              </div>
            ))}
          </div>
          {PODER_DE_CIMA_PARA_BAIXO.map((poder) => (
            <div key={poder} role="row" className="contents">
              <div role="rowheader" className="flex items-center p-1 text-xs font-semibold sm:p-2">
                <span className="sm:hidden">P. {ROTULOS_NIVEL[poder].toLowerCase()}</span>
                <span className="hidden sm:inline">Poder {ROTULOS_NIVEL[poder].toLowerCase()}</span>
              </div>
              {INTERESSE_DA_ESQUERDA.map((interesse) => {
                const daCelula = celulas.get(`${poder}|${interesse}`) ?? [];
                const canto = poder !== "medio" && interesse !== "medio";
                return (
                  <div
                    key={interesse}
                    role="cell"
                    data-celula={`${poder}|${interesse}`}
                    title={nomeDaCelula(poder, interesse)}
                    className={`flex min-h-16 flex-col gap-1 rounded-md border p-1.5 sm:min-h-24 sm:p-2 ${canto ? "border-borda bg-superficie" : "border-dashed border-borda bg-fundo"}`}
                  >
                    <span className="text-xs font-medium text-texto-secundario">
                      <span className="hidden sm:inline">{nomeDaCelula(poder, interesse)} · </span>
                      <span className="tabular-nums">{daCelula.length}</span>
                    </span>
                    <ul className="flex flex-wrap gap-1 sm:flex-col">
                      {daCelula.map((f) => {
                        const preliminar = posicionamentoPreliminar(f.vigente.posicionamento, f.vigente.naturezaPosicionamento);
                        return (
                          <li key={f.stakeholderId} className="flex flex-wrap items-center gap-1">
                            <Link
                              href={caminhoFicha(f.stakeholderId)}
                              aria-label={`${f.nome}${preliminar ? ", avaliação preliminar" : ""}`}
                              className={`${classeLink} inline-flex items-center gap-1 break-words text-sm`}
                            >
                              <MarcadorPosicionamento ficha={f} preliminar={preliminar} />
                              <span className="hidden sm:inline">{f.nome}</span>
                            </Link>
                            {preliminar && (
                              <span className="hidden sm:inline-flex">
                                <SeloPreliminar />
                              </span>
                            )}
                            {f.revisaoVencida && (
                              <span title="Revisão anual vencida" style={{ color: "var(--alerta-revisao)" }}>
                                ⚠
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="text-xs text-texto-secundario">
        Os quatro cantos são as combinações extremas; as cinco células com Médio são posições intermediárias. A célula é
        uma leitura, nunca uma conduta: a Conduta do ES em Ação não é derivada da matriz. O posicionamento (cor e
        símbolo) é avaliado separadamente do poder e do interesse.
      </figcaption>

      <div className="overflow-x-auto rounded-lg border border-borda">
        <table className={classeTabela}>
          <caption className="sr-only">Avaliações da matriz</caption>
          <thead>
            <tr>
              <th scope="col" className={classeCelulaCabecalho}>Stakeholder</th>
              <th scope="col" className={classeCelulaCabecalho}>Poder</th>
              <th scope="col" className={classeCelulaCabecalho}>Interesse</th>
              <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>Célula</th>
              <th scope="col" className={classeCelulaCabecalho}>Posicionamento</th>
              <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>Confiança</th>
              <th scope="col" className={`${classeCelulaCabecalho} hidden md:table-cell`}>Referência</th>
            </tr>
          </thead>
          <tbody>
            {fichas.map((f) => (
              <tr key={f.stakeholderId}>
                <td className={classeCelula}>
                  <Link href={caminhoFicha(f.stakeholderId)} className={classeLink}>
                    {f.nome}
                  </Link>
                  {f.revisaoVencida && (
                    <span className="mt-0.5 block text-xs font-medium" style={{ color: "var(--alerta-revisao)" }}>
                      ⚠ Revisão anual vencida
                    </span>
                  )}
                </td>
                <td className={classeCelula}>{f.vigente.nivelPoder ? ROTULOS_NIVEL[f.vigente.nivelPoder] : ROTULO_NAO_AVALIADO}</td>
                <td className={classeCelula}>
                  {f.vigente.nivelInteresse ? ROTULOS_NIVEL[f.vigente.nivelInteresse] : ROTULO_NAO_AVALIADO}
                </td>
                <td className={`${classeCelula} hidden md:table-cell`}>
                  {f.vigente.nivelPoder && f.vigente.nivelInteresse
                    ? nomeDaCelula(f.vigente.nivelPoder, f.vigente.nivelInteresse)
                    : "—"}
                </td>
                <td className={classeCelula}>
                  <SeloPosicionamento posicionamento={f.vigente.posicionamento} natureza={f.vigente.naturezaPosicionamento} />
                </td>
                <td className={`${classeCelula} hidden md:table-cell`}>
                  {f.vigente.grauConfianca ? ROTULOS_GRAU_CONFIANCA[f.vigente.grauConfianca] : "Não informado"}
                </td>
                <td className={`${classeCelula} hidden md:table-cell`}>{formatarData(f.vigente.dataReferencia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Marcador do posicionamento (cor e símbolo); contorno tracejado quando a avaliação é preliminar. */
function MarcadorPosicionamento({ ficha, preliminar }: { ficha: FichaDaGrade; preliminar: boolean }) {
  const posicao = ficha.vigente.posicionamento;
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.6rem]"
      style={{
        ...(posicao
          ? { background: COR_POSICIONAMENTO[posicao], borderColor: "var(--texto-secundario)", color: "var(--superficie)" }
          : { borderStyle: "dashed", borderColor: "var(--texto-secundario)" }),
        ...(preliminar ? { outline: "2px dashed var(--alerta-revisao)", outlineOffset: "1px" } : {}),
      }}
      title={`${posicao ? ROTULOS_POSICIONAMENTO[posicao] : ROTULO_NAO_AVALIADO}${preliminar ? " (preliminar)" : ""}`}
    >
      <span aria-hidden="true">{posicao ? SIMBOLO_POSICIONAMENTO[posicao] : SIMBOLO_NAO_AVALIADO}</span>
      <span className="sr-only">{posicao ? ROTULOS_POSICIONAMENTO[posicao] : ROTULO_NAO_AVALIADO}</span>
    </span>
  );
}
