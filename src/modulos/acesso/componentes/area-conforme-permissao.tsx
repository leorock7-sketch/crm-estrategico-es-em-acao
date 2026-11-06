import type { ReactNode } from "react";
import { Alerta } from "@/componentes/alerta";

/**
 * Para quem só pode consultar, desativa de uma vez os controles da página (o campo agrupador
 * desativado alcança todos os internos) e esconde formulários e atalhos de edição (globals.css),
 * sem esconder as informações. É só apresentação: a recusa efetiva está nas operações do servidor
 * e nas regras do banco.
 */
export function AreaConformePermissao({ podeEditar, children }: { podeEditar: boolean; children: ReactNode }) {
  return (
    <fieldset disabled={!podeEditar} className="contents">
      {!podeEditar && (
        <div className="mb-6">
          <Alerta tom="aviso">Seu perfil permite apenas consulta neste registro.</Alerta>
        </div>
      )}
      {children}
    </fieldset>
  );
}
