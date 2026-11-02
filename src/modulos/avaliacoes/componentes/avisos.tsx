import Link from "next/link";
import { Alerta } from "@/componentes/alerta";
import { AVISO_DADOS_FICTICIOS, AVISO_NAO_HOMOLOGADO, AVISO_SEGURANCA } from "../rotulos";

/** Aviso obrigatório junto a resultados de metodologia não homologada (D-034). */
export function AvisoNaoHomologado({ metodologia }: { metodologia?: { id: string; nome: string } | null }) {
  return (
    <Alerta tom="aviso" titulo="Resultados não homologados">
      {AVISO_NAO_HOMOLOGADO}
      {metodologia && (
        <>
          {" "}
          Metodologia usada:{" "}
          <Link href={`/metodologias/${metodologia.id}`} className="font-medium underline">
            {metodologia.nome}
          </Link>
          .
        </>
      )}
    </Alerta>
  );
}

/** Aviso da metodologia V2.2 homologada, ainda só com dados fictícios (D-005, D-068). */
export function AvisoDadosFicticios({ metodologia }: { metodologia?: { id: string; nome: string } | null }) {
  return (
    <Alerta tom="aviso" titulo="Metodologia V2.2 — dados fictícios">
      {AVISO_DADOS_FICTICIOS}
      {metodologia && (
        <>
          {" "}
          Metodologia:{" "}
          <Link href={`/metodologias/${metodologia.id}`} className="font-medium underline">
            {metodologia.nome}
          </Link>
          .
        </>
      )}
    </Alerta>
  );
}

/** Aviso adequado à metodologia: V2.2 homologada ou demonstração não homologada. */
export function AvisoDaMetodologia({
  metodologia,
}: {
  metodologia?: { id: string; nome: string; homologada: boolean } | null;
}) {
  return metodologia?.homologada ? (
    <AvisoDadosFicticios metodologia={metodologia} />
  ) : (
    <AvisoNaoHomologado metodologia={metodologia} />
  );
}

/** Lembrete de que a segurança multiusuário ainda não foi homologada (D-034). */
export function AvisoSeguranca() {
  return <p className="text-xs text-texto-secundario">{AVISO_SEGURANCA}</p>;
}
