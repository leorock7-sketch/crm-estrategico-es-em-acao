import Link from "next/link";
import type { ReactNode } from "react";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { formatarData, formatarDataHora, formatarNumero } from "@/lib/formatacao";
import type { Tendencia } from "../calculo";
import type { VersaoDaFicha } from "../consultas";
import { ROTULOS_DIMENSAO, ROTULOS_GRAU_CONFIANCA, ROTULOS_SITUACAO_VERSAO } from "../rotulos";
import { ListaEvidencias } from "./lista-evidencias";
import { SeloPosicionamento } from "./selo-posicionamento";

const ROTULOS_TENDENCIA: Record<Tendencia, string> = {
  mais_favoravel: "↑ Mais favorável que a versão anterior",
  estavel: "→ Mesmo posicionamento da versão anterior",
  menos_favoravel: "↓ Menos favorável que a versão anterior",
};

/** Conteúdo de uma versão da avaliação: resultado, justificativas, notas e evidências. */
export function ResumoVersao({
  versao,
  tendencia,
  hoje,
}: {
  versao: VersaoDaFicha;
  tendencia?: Tendencia | null;
  hoje: string;
}) {
  const revisaoVencida = versao.situacao === "vigente" && versao.proximaRevisao !== null && versao.proximaRevisao < hoje;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Versão {versao.numeroVersao}</span>
        <SeloSituacao tom={versao.situacao === "vigente" ? "sucesso" : versao.situacao === "rascunho" ? "aviso" : "neutro"}>
          {versao.arquivadoEm ? "Rascunho descartado" : ROTULOS_SITUACAO_VERSAO[versao.situacao]}
        </SeloSituacao>
        {versao.metodologiaId && versao.metodologiaSituacao !== "vigente" && versao.situacao !== "rascunho" && (
          <SeloSituacao tom="neutro">Metodologia anterior</SeloSituacao>
        )}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Item rotulo="Posicionamento">
          <SeloPosicionamento posicionamento={versao.posicionamento} />
          {tendencia && <span className="mt-0.5 block text-xs text-texto-secundario">{ROTULOS_TENDENCIA[tendencia]}</span>}
        </Item>
        <Item rotulo="Poder">{versao.poder === null ? "Sem pontuação" : formatarNumero(versao.poder)}</Item>
        <Item rotulo="Interesse">{versao.interesse === null ? "Sem pontuação" : formatarNumero(versao.interesse)}</Item>
        <Item rotulo="Grau de confiança">
          {versao.grauConfianca ? ROTULOS_GRAU_CONFIANCA[versao.grauConfianca] : "Não informado"}
        </Item>
        <Item rotulo="Data de referência">{formatarData(versao.dataReferencia)}</Item>
        <Item rotulo="Próxima revisão">
          {formatarData(versao.proximaRevisao)}
          {revisaoVencida && (
            <span className="mt-0.5 block text-xs font-medium" style={{ color: "var(--alerta-revisao)" }}>
              ⚠ Revisão anual vencida
            </span>
          )}
        </Item>
        <Item rotulo="Metodologia">
          {versao.metodologiaId ? (
            <Link href={`/metodologias/${versao.metodologiaId}`} className="underline">
              {versao.metodologiaNome}
            </Link>
          ) : (
            "Nenhuma (sem pontuação)"
          )}
          {versao.metodologiaId && !versao.metodologiaHomologada && (
            <span className="mt-0.5 block text-xs text-texto-secundario">Não homologada</span>
          )}
        </Item>
        <Item rotulo="Publicação">
          {versao.publicadaEm ? `${formatarDataHora(versao.publicadaEm)} · ${versao.avaliadorNome ?? "—"}` : "Não publicada"}
        </Item>
      </dl>

      <Bloco titulo="Justificativa">{versao.justificativa}</Bloco>
      {versao.grauConfianca && <Bloco titulo="Justificativa do grau de confiança">{versao.justificativaConfianca}</Bloco>}
      {versao.validacaoInstitucional && (
        <Bloco titulo="Validação institucional (fonte e justificativa)">{versao.validacaoInstitucional}</Bloco>
      )}

      {versao.notas.length > 0 && (
        <div>
          <h4 className="mb-1 font-medium">Notas por critério</h4>
          <ul className="grid gap-1 sm:grid-cols-2">
            {versao.notas.map((n) => (
              <li key={n.criterioId} className="text-texto-secundario">
                <span className="text-texto">{n.criterioNome}</span> ({ROTULOS_DIMENSAO[n.dimensao].toLowerCase()}): {formatarNumero(n.nota)}{" "}
                <span className="text-xs">
                  (escala {n.escalaMinima}–{n.escalaMaxima})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-1 font-medium">Evidências</h4>
        <ListaEvidencias evidencias={versao.evidencias} />
      </div>
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-texto-secundario">{rotulo}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: string | null }) {
  return (
    <div>
      <h4 className="mb-1 font-medium">{titulo}</h4>
      <p className="whitespace-pre-line break-words text-texto-secundario">{children || "—"}</p>
    </div>
  );
}
