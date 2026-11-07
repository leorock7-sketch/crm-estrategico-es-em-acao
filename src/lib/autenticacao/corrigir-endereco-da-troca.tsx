"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DESTINO_DA_TROCA, PAGINA_DA_TROCA } from "./troca-obrigatoria";

/**
 * P-056: quando o proxy desvia uma navegação interna para a troca de senha, o navegador pode continuar
 * mostrando o endereço pedido. Este componente ajusta o endereço para a página da troca, para o
 * formulário ser enviado ao lugar certo. Não mostra nada.
 */
export function CorrigirEnderecoDaTroca() {
  const roteador = useRouter();
  useEffect(() => {
    if (window.location.pathname !== PAGINA_DA_TROCA) roteador.replace(DESTINO_DA_TROCA);
  }, [roteador]);
  return null;
}
