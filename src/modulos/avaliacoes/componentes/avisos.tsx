import Link from "next/link";
import { Alerta } from "@/componentes/alerta";
import { AVISO_NAO_HOMOLOGADO, AVISO_SEGURANCA } from "../rotulos";

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

/** Lembrete de que a segurança multiusuário ainda não foi homologada (D-034). */
export function AvisoSeguranca() {
  return <p className="text-xs text-texto-secundario">{AVISO_SEGURANCA}</p>;
}
