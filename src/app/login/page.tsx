import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Carregando } from "@/componentes/carregando";
import { classeCartao } from "@/componentes/estilos";
import { FormularioLogin } from "@/lib/autenticacao/formulario-login";
import { modoDeAcesso } from "@/lib/banco/ambiente";

export const metadata: Metadata = { title: "Entrar" };

export default function PaginaLogin({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Entrar</h1>
      <p className="mb-6 text-sm text-texto-secundario">
        Acesso fechado: somente usuários previamente autorizados pelo administrador do sistema.
      </p>
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const parametros = await searchParams;
  if (modoDeAcesso() === "local") redirect("/");
  const destino = typeof parametros.destino === "string" ? parametros.destino : "/";
  return (
    <div className={`${classeCartao} flex flex-col gap-5`}>
      <FormularioLogin destino={destino} />
      <div className="border-t border-borda pt-4">
        <button
          type="button"
          disabled
          aria-describedby="aviso-microsoft"
          className="w-full cursor-not-allowed rounded-lg border border-borda px-4 py-2 text-sm text-texto-secundario"
        >
          Entrar com a conta Microsoft 365
        </button>
        <p id="aviso-microsoft" className="mt-2 text-xs text-texto-secundario">
          Pendente: depende da configuração pela TI institucional. Enquanto isso, usuários autorizados entram com e-mail e senha.
        </p>
      </div>
    </div>
  );
}
