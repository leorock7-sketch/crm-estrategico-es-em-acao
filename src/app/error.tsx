"use client";

import { useEffect } from "react";
import { classeBotaoSecundario } from "@/componentes/estilos";

export default function ErroInesperado({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-xl py-12 text-center">
      <h1 className="text-2xl font-semibold">Ocorreu um erro inesperado</h1>
      <p className="mt-2 text-texto-secundario">
        Tente novamente. Se o problema persistir, registre o que estava fazendo quando ele
        ocorreu.
      </p>
      <button type="button" onClick={() => retry()} className={`${classeBotaoSecundario} mt-6`}>
        Tentar novamente
      </button>
    </div>
  );
}
