import { type ReactNode, Suspense } from "react";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { ehAdministrador, podeRegistrarNoCadastro } from "../capacidades";

/**
 * Mostram um trecho da tela só a quem pode usá-lo. É apenas apresentação: a recusa efetiva está
 * nas operações do servidor e nas regras do banco. Por lerem a sessão, ficam em Suspense.
 */
async function ConformeRegistro({ children }: { children: ReactNode }) {
  const banco = await bancoDaRequisicao();
  return (await podeRegistrarNoCadastro(banco)) ? children : null;
}

async function ConformeAdministrador({ children }: { children: ReactNode }) {
  const banco = await bancoDaRequisicao();
  return (await ehAdministrador(banco)) ? children : null;
}

export function SeRegistra({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ConformeRegistro>{children}</ConformeRegistro>
    </Suspense>
  );
}

export function SeAdministrador({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ConformeAdministrador>{children}</ConformeAdministrador>
    </Suspense>
  );
}
