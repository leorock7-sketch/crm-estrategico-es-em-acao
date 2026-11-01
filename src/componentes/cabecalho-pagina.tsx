import Link from "next/link";
import type { ReactNode } from "react";

type PropriedadesCabecalho = {
  titulo: string;
  descricao?: ReactNode;
  /** Link de retorno exibido acima do título. */
  voltar?: { href: string; rotulo: string };
  acoes?: ReactNode;
};

export function CabecalhoPagina({ titulo, descricao, voltar, acoes }: PropriedadesCabecalho) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {voltar && (
          <Link href={voltar.href} className="text-sm text-texto-secundario hover:underline">
            ← {voltar.rotulo}
          </Link>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
          {titulo}
        </h1>
        {descricao && <div className="mt-1 text-texto-secundario">{descricao}</div>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </header>
  );
}
