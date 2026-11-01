import type { ReactNode } from "react";

type PropriedadesCampo = {
  /** Identificador do elemento de entrada (input, select ou textarea) envolvido. */
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  ajuda?: string;
  erros?: string[];
  children: ReactNode;
};

/** Identificador da mensagem de erro de um campo, para uso em aria-describedby. */
export function idErroCampo(id: string) {
  return `${id}-erro`;
}

/** Rótulo, campo de entrada, texto de ajuda e mensagens de erro. */
export function Campo({ id, rotulo, obrigatorio, ajuda, erros, children }: PropriedadesCampo) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
        {obrigatorio && (
          <span className="text-red-700 dark:text-red-400" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {ajuda && <p className="text-xs text-texto-secundario">{ajuda}</p>}
      {erros && erros.length > 0 && (
        <p id={idErroCampo(id)} className="text-sm text-red-700 dark:text-red-400">
          {erros.join(" ")}
        </p>
      )}
    </div>
  );
}
