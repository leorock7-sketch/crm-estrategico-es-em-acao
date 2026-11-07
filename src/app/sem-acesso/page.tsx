import type { Metadata } from "next";
import { classeBotaoSecundario, classeCartao } from "@/componentes/estilos";
import { sair } from "@/lib/autenticacao/acoes";

export const metadata: Metadata = { title: "Sem acesso" };

/** Conta válida não basta: é preciso cadastro interno prévio e ativo (D-074, D1). */
export default function PaginaSemAcesso() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Sem acesso</h1>
      <div className={`${classeCartao} flex flex-col gap-4`}>
        <p className="text-sm">
          Sua conta foi reconhecida, mas não há cadastro ativo autorizado para ela neste sistema. Procure o administrador
          do sistema.
        </p>
        <form action={sair}>
          <button type="submit" className={classeBotaoSecundario}>
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
