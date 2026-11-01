import Link from "next/link";
import { Alerta } from "@/componentes/alerta";
import type { PossivelDuplicidade } from "../consultas";

type PropriedadesAviso = {
  duplicidades: PossivelDuplicidade[];
  caminho: "/pessoas" | "/instituicoes";
};

/** Lista registros parecidos e exige confirmação expressa para salvar. */
export function AvisoDuplicidades({ duplicidades, caminho }: PropriedadesAviso) {
  return (
    <Alerta tom="aviso" titulo="Possível cadastro repetido">
      <p>Encontramos registros parecidos. Confira antes de salvar (os links abrem em outra aba):</p>
      <ul className="mt-2 list-disc pl-5">
        {duplicidades.map((duplicidade) => (
          <li key={duplicidade.id}>
            <Link
              href={`${caminho}/${duplicidade.id}`}
              target="_blank"
              className="font-medium underline"
            >
              {duplicidade.nome}
            </Link>{" "}
            — {duplicidade.motivo}
            {duplicidade.arquivado && " (arquivado)"}
          </li>
        ))}
      </ul>
      <label className="mt-3 flex items-start gap-2 font-medium">
        <input
          type="checkbox"
          name="confirmarDuplicidade"
          value="sim"
          required
          className="mt-1 size-4"
        />
        Conferi e confirmo que não se trata do mesmo registro.
      </label>
    </Alerta>
  );
}
