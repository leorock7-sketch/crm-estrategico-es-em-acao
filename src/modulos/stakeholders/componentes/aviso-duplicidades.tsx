import Link from "next/link";
import { Alerta } from "@/componentes/alerta";
import type { PossivelDuplicidade } from "../consultas";

type PropriedadesAviso = {
  duplicidades: PossivelDuplicidade[];
  /** Página padrão dos registros; cada item pode indicar a sua. */
  caminho?: "/pessoas" | "/instituicoes";
  titulo?: string;
  confirmacao?: string;
};

/** Lista registros parecidos e exige confirmação expressa para salvar. */
export function AvisoDuplicidades({
  duplicidades,
  caminho = "/pessoas",
  titulo = "Possível cadastro repetido",
  confirmacao = "Conferi e confirmo que não se trata do mesmo registro.",
}: PropriedadesAviso) {
  return (
    <Alerta tom="aviso" titulo={titulo}>
      <p>Encontramos registros parecidos. Confira antes de salvar (os links abrem em outra aba):</p>
      <ul className="mt-2 list-disc pl-5">
        {duplicidades.map((duplicidade, posicao) => (
          <li key={`${duplicidade.id}-${posicao}`}>
            <Link
              href={`${duplicidade.caminho ?? caminho}/${duplicidade.id}`}
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
        {confirmacao}
      </label>
    </Alerta>
  );
}
